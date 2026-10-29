import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CARE_SERVICE_KEYS, type CareContactOutcome, type CarePlanContactsResponse, type CarePlanResponse, type CarePlansRequest, type CarePlansResponse, type CareServiceKey, type RecordCarePlanContactRequest, type RecordCareServiceRequest } from '@oficina/contracts';
import { Prisma } from '@oficina/database';
import type { CustomerCarePlan, ServiceOrder } from '@oficina/database';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { AuditLogService } from '../../shared/audit-log/audit-log.service';
import { addMonthsClamped, careSettings, localClock } from './care-policy';

@Injectable()
export class CustomerCarePlansService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}

  async record(user: AuthenticatedUser, input: RecordCareServiceRequest) {
    const settings = careSettings(await this.prisma.unscoped.customerCareSettings.findFirst({ where: { tenantId: user.tenantId } }));
    const date = new Date(`${input.completedAt}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.completedAt || input.completedAt > localClock(new Date(), settings.timeZone).date || input.completedAt < '1970-01-01') throw new BadRequestException('Informe a data real de um serviço já realizado.');
    const vehicle = await this.prisma.client.vehicle.findFirst({ where: { id: input.vehicleId, tenantId: user.tenantId, deletedAt: null } });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
    const customer = await this.prisma.client.customer.findFirst({ where: { id: vehicle.customerId, tenantId: user.tenantId, deletedAt: null } });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');
    const plan = await this.prisma.unscoped.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`care-plan:${user.tenantId}:${vehicle.id}:${input.serviceKey}`}, 0))::text`;
      const where = { tenantId: user.tenantId, vehicleId: vehicle.id, serviceKey: input.serviceKey };
      const existing = await tx.customerCarePlan.findFirst({ where });
      if (existing && existing.completedAt > date) throw new BadRequestException('Já existe um cuidado mais recente para este veículo. Use a data do último serviço.');
      const data = { customerId: customer.id, completedAt: date, mileage: input.mileage ?? null, intervalMonths: input.intervalMonths ?? null, intervalKm: input.intervalKm ?? null, sourceOrderId: null };
      const saved = await tx.customerCarePlan.upsert({ where: { tenantId_vehicleId_serviceKey: where }, create: { ...where, ...data }, update: data });
      if (input.mileage !== undefined) await tx.vehicle.updateMany({ where: { id: vehicle.id, tenantId: user.tenantId, deletedAt: null, OR: [{ mileage: null }, { mileage: { lt: input.mileage } }] }, data: { mileage: input.mileage } });
      return saved;
    });
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'customer_care.service_recorded', entity: 'customer_care_plan', entityId: plan.id, metadata: { serviceKey: input.serviceKey, completedAt: input.completedAt } });
    return { id: plan.id };
  }

  // Runs inside the very same transaction as DELIVERED. Free-text descriptions
  // are deliberately never interpreted as completed mechanical services.
  async recordDelivered(tx: Prisma.TransactionClient, order: ServiceOrder, completedAt: Date) {
    const vehicle = await tx.vehicle.findFirst({ where: { id: order.vehicleId, tenantId: order.tenantId, customerId: order.customerId, deletedAt: null } });
    if (!vehicle) return;
    const items = await tx.serviceOrderItem.findMany({ where: { serviceOrderId: order.id, deletedAt: null, careServiceKey: { not: null } }, select: { careServiceKey: true } });
    const keys = new Set<CareServiceKey>(['PERIODIC_REVIEW']);
    for (const item of items) if (CARE_SERVICE_KEYS.includes(item.careServiceKey as CareServiceKey)) keys.add(item.careServiceKey as CareServiceKey);
    for (const key of [...keys].sort()) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`care-plan:${order.tenantId}:${order.vehicleId}:${key}`}, 0))::text`;
      const where = { tenantId: order.tenantId, vehicleId: order.vehicleId, serviceKey: key };
      const existing = await tx.customerCarePlan.findFirst({ where });
      if (existing && existing.completedAt > completedAt) continue;
      await tx.customerCarePlan.upsert({ where: { tenantId_vehicleId_serviceKey: where }, create: { ...where, customerId: order.customerId, completedAt, mileage: order.entryMileage, sourceOrderId: order.id }, update: { customerId: order.customerId, completedAt, mileage: order.entryMileage, sourceOrderId: order.id } });
    }
  }

  // Only plans whose car still belongs to the same active customer count, both in the page and in the total, so the
  // number on screen is the number of cards. Ordered by the date the care falls due; overdue = past the date, or past
  // the mileage when the odometer is known; upcoming = due in the next 30 days.
  async page(tenantId: string, request: CarePlansRequest, now = new Date()): Promise<CarePlansResponse> {
    const settings = careSettings(await this.prisma.unscoped.customerCareSettings.findFirst({ where: { tenantId } }));
    const offset = request.offset ?? 0; const limit = request.limit ?? 50;
    const due = Prisma.sql`(p.completed_at + make_interval(months => COALESCE(p.interval_months, (r->>'intervalMonths')::integer)))`;
    const kmDue = Prisma.sql`(p.mileage IS NOT NULL AND v.mileage >= p.mileage + COALESCE(p.interval_km, (r->>'intervalKm')::integer))`;
    const term = request.search?.trim();
    const plate = term ? term.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
    const search = term ? Prisma.sql`AND (c.name ILIKE ${`%${term}%`} OR v.model ILIKE ${`%${term}%`} OR v.brand ILIKE ${`%${term}%`}${plate ? Prisma.sql` OR v.plate ILIKE ${`%${plate}%`}` : Prisma.empty})` : Prisma.empty;
    const consent = request.consent ? Prisma.sql`AND c.care_messages_enabled = ${request.consent === 'GRANTED'}` : Prisma.empty;
    const filter = request.filter === 'DUE' ? Prisma.sql`AND (${due} <= ${new Date(now.getTime() + 30 * 86_400_000)} OR ${kmDue})`
      : request.filter === 'OVERDUE' ? Prisma.sql`AND (${due} <= ${now} OR ${kmDue})`
      : request.filter === 'UPCOMING' ? Prisma.sql`AND ${due} > ${now} AND ${due} <= ${new Date(now.getTime() + 30 * 86_400_000)} AND NOT ${kmDue}` : Prisma.empty;
    const from = Prisma.sql`FROM customer_care_plans p
      JOIN customers c ON c.id = p.customer_id AND c.tenant_id = p.tenant_id AND c.deleted_at IS NULL
      JOIN vehicles v ON v.id = p.vehicle_id AND v.tenant_id = p.tenant_id AND v.customer_id = p.customer_id AND v.deleted_at IS NULL
      JOIN jsonb_array_elements(${JSON.stringify(settings.campaigns)}::jsonb) r ON r->>'key' = p.service_key
      WHERE p.tenant_id = ${tenantId}::uuid ${search} ${filter} ${consent}`;
    const [rows, counted] = await Promise.all([
      this.prisma.unscoped.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT p.id ${from} ORDER BY ${due} ASC, p.id ASC LIMIT ${limit} OFFSET ${offset}`),
      this.prisma.unscoped.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT count(*) ${from}`),
    ]);
    const ids = rows.map((row) => row.id);
    const plans = ids.length ? await this.prisma.unscoped.customerCarePlan.findMany({ where: { tenantId, id: { in: ids } } }) : [];
    const [customers, vehicles] = await Promise.all([
      this.prisma.unscoped.customer.findMany({ where: { tenantId, id: { in: plans.map((plan) => plan.customerId) }, deletedAt: null } }),
      this.prisma.unscoped.vehicle.findMany({ where: { tenantId, id: { in: plans.map((plan) => plan.vehicleId) }, deletedAt: null } }),
    ]);
    const ordered = ids.flatMap((id) => {
      const plan = plans.find((item) => item.id === id); if (!plan) return [];
      const customer = customers.find((item) => item.id === plan.customerId); const vehicle = vehicles.find((item) => item.id === plan.vehicleId);
      return customer && vehicle ? [this.response(plan, settings, customer, vehicle, now)] : [];
    });
    return { plans: await this.withContacts(tenantId, ordered), total: Number(counted[0]?.count ?? 0) };
  }

  // The last attempt by the team and how many there were, so two people do not call the same customer.
  private async withContacts(tenantId: string, plans: CarePlanResponse[]): Promise<CarePlanResponse[]> {
    if (!plans.length) return plans;
    const contacts = await this.prisma.unscoped.customerCareContact.findMany({ where: { tenantId, planId: { in: plans.map((plan) => plan.id) } }, orderBy: { createdAt: 'desc' } });
    const names = await this.userNames(tenantId, contacts.map((contact) => contact.createdBy));
    return plans.map((plan) => {
      const own = contacts.filter((contact) => contact.planId === plan.id);
      const last = own[0];
      return { ...plan, contactCount: own.length, ...(last ? { lastContact: { outcome: last.outcome as CareContactOutcome, at: last.createdAt.toISOString(), byName: last.createdBy ? names.get(last.createdBy) : undefined, note: last.note ?? undefined } } : {}) };
    });
  }

  private async userNames(tenantId: string, ids: Array<string | null>): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return new Map();
    const users = await this.prisma.unscoped.user.findMany({ where: { tenantId, id: { in: unique } }, select: { id: true, name: true } });
    return new Map(users.map((user) => [user.id, user.name]));
  }

  async recordContact(user: AuthenticatedUser, request: RecordCarePlanContactRequest) {
    const plan = await this.prisma.unscoped.customerCarePlan.findFirst({ where: { id: request.id, tenantId: user.tenantId } });
    if (!plan) throw new NotFoundException('Plano de cuidado não encontrado.');
    const contact = await this.prisma.unscoped.customerCareContact.create({ data: { tenantId: user.tenantId, planId: plan.id, outcome: request.outcome, note: request.note?.trim() || null, createdBy: user.userId } });
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'customer_care.contact_recorded', entity: 'customer_care_plan', entityId: plan.id, metadata: {} });
    return { id: contact.id };
  }

  async contacts(tenantId: string, planId: string): Promise<CarePlanContactsResponse> {
    if (!(await this.prisma.unscoped.customerCarePlan.findFirst({ where: { id: planId, tenantId }, select: { id: true } }))) throw new NotFoundException('Plano de cuidado não encontrado.');
    const rows = await this.prisma.unscoped.customerCareContact.findMany({ where: { tenantId, planId }, orderBy: { createdAt: 'desc' }, take: 50 });
    const names = await this.userNames(tenantId, rows.map((row) => row.createdBy));
    return { contacts: rows.map((row) => ({ id: row.id, outcome: row.outcome as CareContactOutcome, at: row.createdAt.toISOString(), byName: row.createdBy ? names.get(row.createdBy) : undefined, note: row.note ?? undefined })) };
  }

  response(plan: CustomerCarePlan, settings: ReturnType<typeof careSettings>, customer: { name: string; careMessagesEnabled?: boolean | null; phone?: string }, vehicle: { brand: string; model: string; plate: string; mileage?: number | null }, now = new Date()): CarePlanResponse {
    const campaign = settings.campaigns.find(item => item.key === plan.serviceKey)!;
    const intervalMonths = plan.intervalMonths ?? campaign.intervalMonths;
    const intervalKm = plan.intervalKm ?? campaign.intervalKm;
    return { id: plan.id, customerId: plan.customerId, customerName: customer.name, vehicleId: plan.vehicleId, vehicleName: `${vehicle.brand} ${vehicle.model}`, plate: vehicle.plate, serviceKey: plan.serviceKey as CareServiceKey, serviceName: campaign.name, completedAt: plan.completedAt.toISOString(), mileage: plan.mileage ?? undefined, dueAt: addMonthsClamped(plan.completedAt, intervalMonths).toISOString(), dueMileage: plan.mileage !== null && intervalKm !== null ? plan.mileage + intervalKm : undefined, intervalMonths, intervalKm , customerCareEnabled: Boolean(customer.careMessagesEnabled), customerPhone: customer.phone, overdue: addMonthsClamped(plan.completedAt, intervalMonths).getTime() <= now.getTime() || (plan.mileage !== null && intervalKm !== null && vehicle.mileage != null && vehicle.mileage >= plan.mileage + intervalKm) };
  }
}
