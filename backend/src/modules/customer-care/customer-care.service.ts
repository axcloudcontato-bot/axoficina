import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { CARE_CAMPAIGN_KEYS, type CareDashboardResponse, type CareDeliveryResponse, type CarePreviewRequest, type CarePreviewResponse, type CareSettings, type UpdateCareSettingsRequest } from '@oficina/contracts';
import { Prisma } from '@oficina/database';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { AuditLogService } from '../../shared/audit-log/audit-log.service';
import { CustomerCarePlansService } from './customer-care-plans.service';
import { careSettings, DAY_MS, localClock, localMidnight, renderCareMessage } from './care-policy';

export const hashCareToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class CustomerCareService {
  constructor(private readonly prisma: PrismaService, private readonly plans: CustomerCarePlansService, private readonly config: ConfigService, private readonly audit: AuditLogService) {}

  async settings(tenantId: string): Promise<CareSettings> { return careSettings(await this.prisma.unscoped.customerCareSettings.findFirst({ where: { tenantId } })); }

  async update(user: AuthenticatedUser, input: UpdateCareSettingsRequest) {
    if (new Set(input.campaigns.map(item => item.key)).size !== CARE_CAMPAIGN_KEYS.length || CARE_CAMPAIGN_KEYS.some(key => !input.campaigns.some(item => item.key === key))) throw new BadRequestException('Informe uma configuração para cada campanha, sem repetições.');
    for (const campaign of input.campaigns) {
      const unknown = campaign.message.match(/\{[^{}]+\}/g)?.filter(token => !['{cliente}', '{oficina}', '{veiculo}', '{placa}', '{cuidados}'].includes(token));
      if (unknown?.length) throw new BadRequestException('Use apenas as variáveis de mensagem indicadas na tela.');
    }
    const data = { ...input, campaigns: input.campaigns as unknown as Prisma.InputJsonValue, updatedBy: user.userId };
    await this.prisma.unscoped.customerCareSettings.upsert({ where: { tenantId: user.tenantId }, create: { tenantId: user.tenantId, ...data }, update: data });
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'customer_care.settings_updated', entity: 'tenant', entityId: user.tenantId, metadata: { enabled: input.enabled, channel: input.channel } });
    return this.settings(user.tenantId);
  }

  async dashboard(tenantId: string, planOffset = 0, deliveryOffset = 0): Promise<CareDashboardResponse> {
    const settings = await this.settings(tenantId); const now = new Date();
    const month = localClock(now, settings.timeZone).month;
    const start = localMidnight(now, settings.timeZone);
    start.setUTCDate(start.getUTCDate() - localClock(now, settings.timeZone).day + 1);
    const [tenant, plans, totalPlans, deliveries, totalDeliveries, optedIn, birthdayCount, sentThisMonth, pending, failed] = await Promise.all([
      this.prisma.unscoped.tenant.findFirst({ where: { id: tenantId, deletedAt: null } }),
      this.prisma.unscoped.customerCarePlan.findMany({ where: { tenantId }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: planOffset, take: 50 }),
      this.prisma.unscoped.customerCarePlan.count({ where: { tenantId } }),
      this.prisma.unscoped.customerCareDelivery.findMany({ where: { tenantId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: deliveryOffset, take: 30 }),
      this.prisma.unscoped.customerCareDelivery.count({ where: { tenantId } }),
      this.prisma.unscoped.customer.count({ where: { tenantId, deletedAt: null, careMessagesEnabled: true } }),
      this.prisma.unscoped.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM customers WHERE tenant_id = ${tenantId}::uuid AND deleted_at IS NULL AND type = 'PF' AND care_messages_enabled = true AND EXTRACT(MONTH FROM birth_date) = ${month}`,
      this.prisma.unscoped.customerCareDelivery.count({ where: { tenantId, status: 'SENT', sentAt: { gte: start } } }),
      this.prisma.unscoped.customerCareDelivery.count({ where: { tenantId, status: { in: ['PENDING', 'SENDING'] } } }),
      this.prisma.unscoped.customerCareDelivery.count({ where: { tenantId, status: { in: ['FAILED', 'UNKNOWN'] } } }),
    ]);
    const [customers, vehicles, dueCount] = await Promise.all([
      this.prisma.unscoped.customer.findMany({ where: { tenantId, id: { in: plans.map(plan => plan.customerId) }, deletedAt: null } }),
      this.prisma.unscoped.vehicle.findMany({ where: { tenantId, id: { in: plans.map(plan => plan.vehicleId) }, deletedAt: null } }),
      this.prisma.unscoped.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT count(*) FROM customer_care_plans p
        JOIN customers c ON c.id = p.customer_id AND c.tenant_id = p.tenant_id AND c.deleted_at IS NULL
        JOIN vehicles v ON v.id = p.vehicle_id AND v.tenant_id = p.tenant_id AND v.customer_id = p.customer_id AND v.deleted_at IS NULL
        JOIN jsonb_array_elements(${JSON.stringify(settings.campaigns)}::jsonb) r ON r->>'key' = p.service_key
        WHERE p.tenant_id = ${tenantId}::uuid AND (r->>'enabled')::boolean = true
          AND ((p.completed_at + make_interval(months => COALESCE(p.interval_months, (r->>'intervalMonths')::integer))) <= ${new Date(now.getTime() + 30 * DAY_MS)}
            OR (p.mileage IS NOT NULL AND v.mileage >= p.mileage + COALESCE(p.interval_km, (r->>'intervalKm')::integer)))`),
    ]);
    const activePlans = plans.flatMap(plan => {
      const customer = customers.find(item => item.id === plan.customerId); const vehicle = vehicles.find(item => item.id === plan.vehicleId && item.customerId === plan.customerId);
      return customer && vehicle ? [this.plans.response(plan, settings, customer, vehicle)] : [];
    });
    return { settings, channels: { whatsapp: Boolean(tenant?.waAkgEnabled), email: Boolean(tenant?.smtpEnabled) }, stats: { optedIn, birthdaysThisMonth: Number(birthdayCount[0].count), dueThisMonth: Number(dueCount[0].count), sentThisMonth, pending, failed }, plans: activePlans, totalPlans, totalDeliveries,
      deliveries: deliveries.map(item => ({ id: item.id, customerName: item.customerName, campaignNames: item.campaignKeys.map(key => settings.campaigns.find(campaign => campaign.key === key)?.name ?? key), channel: item.channel as CareDeliveryResponse['channel'], status: item.status as CareDeliveryResponse['status'], message: item.message, reason: item.reason ?? undefined, scheduledAt: item.scheduledAt.toISOString(), sentAt: item.sentAt?.toISOString() })) };
  }

  async preview(tenantId: string, input: CarePreviewRequest): Promise<CarePreviewResponse> {
    const settings = await this.settings(tenantId);
    if (input.message) settings.campaigns = settings.campaigns.map(item => item.key === input.campaignKey ? { ...item, message: input.message! } : item);
    const tenant = await this.prisma.unscoped.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    const customer = input.customerId ? await this.prisma.unscoped.customer.findFirst({ where: { id: input.customerId, tenantId, deletedAt: null } }) : null;
    if (input.customerId && !customer) throw new NotFoundException('Cliente não encontrado.');
    const vehicle = input.vehicleId ? await this.prisma.unscoped.vehicle.findFirst({ where: { id: input.vehicleId, tenantId, ...(customer ? { customerId: customer.id } : {}), deletedAt: null } }) : null;
    if (input.vehicleId && !vehicle) throw new NotFoundException('Veículo não encontrado.');
    return renderCareMessage(settings, [{ key: 'preview', campaignKey: input.campaignKey, vehicleName: vehicle ? `${vehicle.brand} ${vehicle.model}` : 'carro', plate: vehicle?.plate }], { customerName: customer?.name ?? 'Mariana', workshopName: tenant?.name ?? 'Sua oficina', contact: tenant?.whatsapp ?? tenant?.phone, unsubscribeUrl: '[link pessoal para pausar os lembretes]' });
  }

  publicUrl(token: string) { return `${this.config.get<string>('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, '')}/preferencias-de-contato/${token}`; }

  async unsubscribeInfo(token: string) {
    const record = await this.prisma.unscoped.customerCareDelivery.findFirst({ where: { unsubscribeHash: hashCareToken(token) } });
    if (!record) throw new NotFoundException('Link de preferências não encontrado.');
    const [customer, tenant] = await Promise.all([this.prisma.unscoped.customer.findFirst({ where: { id: record.customerId, tenantId: record.tenantId, deletedAt: null } }), this.prisma.unscoped.tenant.findFirst({ where: { id: record.tenantId, deletedAt: null } })]);
    if (!customer || !tenant) throw new NotFoundException('Link de preferências não encontrado.');
    return { workshopName: tenant.name, enabled: customer.careMessagesEnabled };
  }

  async unsubscribe(token: string) {
    await this.unsubscribeInfo(token);
    const record = (await this.prisma.unscoped.customerCareDelivery.findFirst({ where: { unsubscribeHash: hashCareToken(token) } }))!;
    await this.prisma.unscoped.$transaction(async tx => {
      await tx.customer.updateMany({ where: { id: record.customerId, tenantId: record.tenantId, deletedAt: null }, data: { careMessagesEnabled: false } });
      await tx.customerCareDelivery.updateMany({ where: { tenantId: record.tenantId, customerId: record.customerId, status: 'PENDING' }, data: { status: 'SKIPPED', reason: 'O cliente pausou os lembretes.' } });
    });
    await this.audit.record({ tenantId: record.tenantId, action: 'customer_care.unsubscribed', entity: 'customer', entityId: record.customerId, metadata: {} });
    return { enabled: false };
  }
}
