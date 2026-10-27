import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CARE_SERVICE_KEYS, type CarePlanResponse, type CareServiceKey, type RecordCareServiceRequest } from '@oficina/contracts';
import type { CustomerCarePlan, Prisma, ServiceOrder } from '@oficina/database';
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

  response(plan: CustomerCarePlan, settings: ReturnType<typeof careSettings>, customer: { name: string }, vehicle: { brand: string; model: string; plate: string }): CarePlanResponse {
    const campaign = settings.campaigns.find(item => item.key === plan.serviceKey)!;
    const intervalMonths = plan.intervalMonths ?? campaign.intervalMonths;
    const intervalKm = plan.intervalKm ?? campaign.intervalKm;
    return { id: plan.id, customerId: plan.customerId, customerName: customer.name, vehicleId: plan.vehicleId, vehicleName: `${vehicle.brand} ${vehicle.model}`, plate: vehicle.plate, serviceKey: plan.serviceKey as CareServiceKey, serviceName: campaign.name, completedAt: plan.completedAt.toISOString(), mileage: plan.mileage ?? undefined, dueAt: addMonthsClamped(plan.completedAt, intervalMonths).toISOString(), dueMileage: plan.mileage !== null && intervalKm !== null ? plan.mileage + intervalKm : undefined, intervalMonths, intervalKm };
  }
}
