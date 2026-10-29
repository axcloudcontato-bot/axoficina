import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { CareSettings, CareTestSendRequest } from '@oficina/contracts';
import type { Customer, CustomerCareDelivery, Prisma, Tenant } from '@oficina/database';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { WaAkgService } from '../settings/services/wa-akg.service';
import { TenantMailerService } from '../settings/services/tenant-mailer.service';
import { SecretEncryptionService } from '../settings/services/secret-encryption.service';
import { whatsappRecipient } from '../settings/services/whatsapp-recipient';
import { CustomerCareService, hashCareToken } from './customer-care.service';
import { birthdayToday, careRecipient, careSettings, contactWindow, DAY_MS, escapeHtml, localClock, localMidnight, maintenanceEvent, renderCareMessage, type CareEvent } from './care-policy';

const RESERVED_STATUSES = ['PENDING', 'SENDING', 'SENT', 'UNKNOWN'];

@Injectable()
export class CustomerCareAutomationService {
  private readonly logger = new Logger(CustomerCareAutomationService.name);
  constructor(private readonly prisma: PrismaService, private readonly care: CustomerCareService, private readonly whatsapp: WaAkgService, private readonly mailer: TenantMailerService, private readonly secrets: SecretEncryptionService) {}

  async scan(now = new Date(), onlyTenantId?: string) {
    let cursor: string | undefined; let queued = 0;
    for (;;) {
      const records = await this.prisma.unscoped.customerCareSettings.findMany({ where: { enabled: true, ...(onlyTenantId ? { tenantId: onlyTenantId } : cursor ? { tenantId: { gt: cursor } } : {}) }, orderBy: { tenantId: 'asc' }, take: 50 });
      for (const record of records) {
        const tenant = await this.prisma.unscoped.tenant.findFirst({ where: { id: record.tenantId, status: 'active', deletedAt: null } });
        if (!tenant) continue;
        const settings = careSettings(record); let customerCursor: string | undefined;
        for (;;) {
          const customers = await this.prisma.unscoped.customer.findMany({ where: { tenantId: tenant.id, deletedAt: null, careMessagesEnabled: true, ...(customerCursor ? { id: { gt: customerCursor } } : {}) }, orderBy: { id: 'asc' }, take: 100 });
          for (const customer of customers) {
            try {
              const events = await this.candidates(tenant.id, customer, settings, now);
              if (events.length && contactWindow(settings, now, customer.preferredContactTime, events[0].campaignKey === 'BIRTHDAY') && await this.enqueue(tenant, customer, settings, events, now)) queued++;
            } catch { this.logger.warn(`Falha ao preparar cuidados para o cadastro ${customer.id}; será reavaliado no próximo ciclo.`); }
          }
          if (customers.length < 100) break;
          customerCursor = customers.at(-1)!.id;
        }
      }
      if (onlyTenantId || records.length < 50) break;
      cursor = records.at(-1)!.tenantId;
    }
    return { queued };
  }

  private async candidates(tenantId: string, customer: Customer, settings: CareSettings, now: Date): Promise<CareEvent[]> {
    const birthday = settings.campaigns.find(item => item.key === 'BIRTHDAY')!;
    if (birthday.enabled && customer.type === 'PF' && birthdayToday(customer.birthDate, now, settings.timeZone)) {
      const key = `birthday:${customer.id}:${localClock(now, settings.timeZone).year}`;
      if (!await this.prisma.unscoped.customerCareDelivery.findFirst({ where: { tenantId, customerId: customer.id, eventKeys: { has: key } } })) return [{ key, campaignKey: 'BIRTHDAY' }];
    }
    if (!contactWindow(settings, now, customer.preferredContactTime)) return [];
    if (settings.campaigns.some(item => item.key === 'PERIODIC_REVIEW' && item.enabled)) {
      // Existing workshops already have reliable visit dates. Bootstrap only
      // the general return from the latest delivered order; never infer an
      // oil/brake service from old free-text items, or overwrite a newer plan.
      await this.prisma.unscoped.$executeRaw`INSERT INTO customer_care_plans
        (tenant_id, customer_id, vehicle_id, service_key, completed_at, mileage, source_order_id)
        SELECT DISTINCT ON (o.vehicle_id) o.tenant_id, o.customer_id, o.vehicle_id, 'PERIODIC_REVIEW', o.closed_at, o.entry_mileage, o.id
        FROM service_orders o
        JOIN vehicles v ON v.id = o.vehicle_id AND v.tenant_id = o.tenant_id AND v.customer_id = o.customer_id AND v.deleted_at IS NULL
        JOIN customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id AND c.deleted_at IS NULL AND c.care_messages_enabled = true
        WHERE o.tenant_id = ${tenantId}::uuid AND o.customer_id = ${customer.id}::uuid
          AND o.status = 'DELIVERED' AND o.closed_at IS NOT NULL AND o.deleted_at IS NULL
        ORDER BY o.vehicle_id, o.closed_at DESC, o.id DESC
        ON CONFLICT (tenant_id, vehicle_id, service_key) DO NOTHING`;
    }
    const result: CareEvent[] = []; let cursor: string | undefined;
    for (;;) {
      const plans = await this.prisma.unscoped.customerCarePlan.findMany({ where: { tenantId, customerId: customer.id, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: 100 });
      const [vehicles, activeOrders] = await Promise.all([
        this.prisma.unscoped.vehicle.findMany({ where: { tenantId, customerId: customer.id, deletedAt: null, id: { in: plans.map(plan => plan.vehicleId) } } }),
        this.prisma.unscoped.serviceOrder.findMany({ where: { tenantId, customerId: customer.id, vehicleId: { in: plans.map(plan => plan.vehicleId) }, deletedAt: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } }, select: { vehicleId: true } }),
      ]);
      const candidates = plans.flatMap(plan => {
        const vehicle = vehicles.find(item => item.id === plan.vehicleId);
        const campaign = settings.campaigns.find(item => item.key === plan.serviceKey);
        if (!vehicle || !campaign || activeOrders.some(order => order.vehicleId === vehicle.id)) return [];
        const event = maintenanceEvent(plan, campaign, now, settings.timeZone, vehicle.mileage);
        return event ? [{ ...event, vehicleName: `${vehicle.brand} ${vehicle.model}`, plate: vehicle.plate }] : [];
      });
      const prior = candidates.length ? await this.prisma.unscoped.customerCareDelivery.findMany({ where: { tenantId, customerId: customer.id, eventKeys: { hasSome: candidates.map(event => event.key) } }, select: { eventKeys: true } }) : [];
      const used = new Set(prior.flatMap(item => item.eventKeys));
      result.push(...candidates.filter(event => !used.has(event.key)).slice(0, 5 - result.length));
      if (result.length === 5 || plans.length < 100) return result;
      cursor = plans.at(-1)!.id;
    }
  }

  private recipient(customer: Customer, settings: CareSettings, tenant: Tenant) {
    const target = careRecipient(customer, settings, tenant);
    return 'reason' in target ? null : target;
  }
  private async enqueue(tenant: Tenant, customer: Customer, settings: CareSettings, events: CareEvent[], now: Date) {
    const recipient = this.recipient(customer, settings, tenant); if (!recipient) return false;
    return this.prisma.unscoped.$transaction(async tx => {
      // Always tenant before customer: one lock order across replicas. The
      // tenant lock makes the daily budget atomic; the customer lock groups
      // concurrent candidates and prevents overlapping digests.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`care-tenant:${tenant.id}`}, 0))::text`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`care-customer:${tenant.id}:${customer.id}`}, 0))::text`;
      const current = await tx.customer.findFirst({ where: { id: customer.id, tenantId: tenant.id, deletedAt: null, careMessagesEnabled: true } });
      if (!current) return false;
      const midnight = localMidnight(now, settings.timeZone);
      if (await tx.customerCareDelivery.count({ where: { tenantId: tenant.id, status: { in: RESERVED_STATUSES }, OR: [{ createdAt: { gte: midnight } }, { sentAt: { gte: midnight } }] } }) >= settings.dailyLimit) return false;
      const birthday = events[0].campaignKey === 'BIRTHDAY';
      const since = birthday ? midnight : new Date(now.getTime() - settings.minGapDays * DAY_MS);
      if (await tx.customerCareDelivery.findFirst({ where: { tenantId: tenant.id, customerId: customer.id, OR: [{ status: { in: ['PENDING', 'SENDING'] } }, { status: { in: ['SENT', 'UNKNOWN'] }, OR: [{ sentAt: { gte: since } }, { createdAt: { gte: since } }] }] } })) return false;
      const prior = await tx.customerCareDelivery.findMany({ where: { tenantId: tenant.id, customerId: customer.id, eventKeys: { hasSome: events.map(event => event.key) } }, select: { eventKeys: true } });
      const used = new Set(prior.flatMap(item => item.eventKeys)); const pending = events.filter(event => !used.has(event.key));
      if (!pending.length) return false;
      const token = randomBytes(32).toString('hex');
      const content = renderCareMessage(settings, pending, { customerName: customer.name, workshopName: tenant.name, contact: tenant.whatsapp ?? tenant.phone, unsubscribeUrl: this.care.publicUrl(token) });
      await tx.customerCareDelivery.create({ data: { tenantId: tenant.id, customerId: customer.id, customerName: customer.name, campaignKeys: pending.map(event => event.campaignKey), eventKeys: pending.map(event => event.key), events: pending as unknown as Prisma.InputJsonValue,
        dedupeKey: hashCareToken(pending.map(event => event.key).sort().join('|')), ...recipient, ...content, unsubscribeHash: hashCareToken(token), unsubscribeToken: this.secrets.encrypt(token), scheduledAt: now } });
      return true;
    });
  }

  async dispatch(now = new Date()) {
    await this.prisma.unscoped.customerCareDelivery.updateMany({ where: { status: 'SENDING', attemptedAt: { lt: new Date(now.getTime() - 5 * 60_000) } }, data: { status: 'UNKNOWN', reason: 'Processamento interrompido. Confira a conversa antes de qualquer novo contato.' } });
    const pending = await this.prisma.unscoped.customerCareDelivery.findMany({ where: { status: 'PENDING', scheduledAt: { lte: now } }, orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }], take: 100 });
    for (const record of pending) {
      try { await this.deliver(record, now); }
      catch { this.logger.warn(`Disparo ${record.id} interrompido; a reconciliação verificará seu estado.`); }
    }
  }

  private finish(record: CustomerCareDelivery, status: string, reason?: string) {
    return this.prisma.unscoped.customerCareDelivery.updateMany({ where: { id: record.id, tenantId: record.tenantId, status: { in: ['PENDING', 'SENDING'] } }, data: { status, reason: reason ?? null, ...(status === 'SENT' ? { sentAt: new Date() } : {}) } });
  }

  private async deliver(record: CustomerCareDelivery, now: Date) {
    const settings = await this.care.settings(record.tenantId);
    const [tenant, customer] = await Promise.all([
      this.prisma.unscoped.tenant.findFirst({ where: { id: record.tenantId, status: 'active', deletedAt: null } }),
      this.prisma.unscoped.customer.findFirst({ where: { id: record.customerId, tenantId: record.tenantId, deletedAt: null, careMessagesEnabled: true } }),
    ]);
    if (!settings.enabled || !tenant || !customer) return this.finish(record, 'SKIPPED', 'Automação pausada ou cliente sem autorização ativa.');
    const events = record.events as unknown as CareEvent[]; const valid: CareEvent[] = [];
    for (const event of events) {
      const campaign = settings.campaigns.find(item => item.key === event.campaignKey); if (!campaign?.enabled) continue;
      if (event.campaignKey === 'BIRTHDAY') {
        if (customer.type === 'PF' && birthdayToday(customer.birthDate, now, settings.timeZone) && event.key === `birthday:${customer.id}:${localClock(now, settings.timeZone).year}`) valid.push(event);
      } else {
        const [plan, vehicle, activeOrder] = await Promise.all([
          this.prisma.unscoped.customerCarePlan.findFirst({ where: { id: event.planId, tenantId: tenant.id, customerId: customer.id, vehicleId: event.vehicleId } }),
          this.prisma.unscoped.vehicle.findFirst({ where: { id: event.vehicleId, tenantId: tenant.id, customerId: customer.id, deletedAt: null } }),
          this.prisma.unscoped.serviceOrder.findFirst({ where: { vehicleId: event.vehicleId, tenantId: tenant.id, deletedAt: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } } }),
        ]);
        if (plan && vehicle && !activeOrder && plan.completedAt.toISOString() === event.completedAt && maintenanceEvent(plan, campaign, now, settings.timeZone, vehicle.mileage)) valid.push({ ...event, vehicleName: `${vehicle.brand} ${vehicle.model}`, plate: vehicle.plate });
      }
    }
    if (!valid.length) return this.finish(record, 'SKIPPED', 'O cuidado já foi realizado, a campanha foi pausada ou a data mudou.');
    const birthday = valid[0].campaignKey === 'BIRTHDAY';
    if (!contactWindow(settings, now, customer.preferredContactTime, birthday)) {
      await this.prisma.unscoped.customerCareDelivery.updateMany({ where: { id: record.id, tenantId: tenant.id, status: 'PENDING' }, data: { scheduledAt: new Date(now.getTime() + 60 * 60_000) } }); return;
    }
    const recipient = this.recipient(customer, settings, tenant);
    if (!recipient || recipient.channel !== record.channel || recipient.recipient !== record.recipient) return this.finish(record, 'FAILED', 'O canal foi desativado ou o contato/preferência do cliente mudou. Revise o cadastro.');
    let connection;
    if (record.channel === 'WHATSAPP') {
      try { connection = await this.whatsapp.getConnection(tenant.id); }
      catch { return this.finish(record, 'FAILED', 'Confira a configuração do WhatsApp da oficina.'); }
      if (!connection) return this.finish(record, 'FAILED', 'O WhatsApp da oficina está desativado.');
    }
    if (record.channel === 'EMAIL' && (!tenant.smtpHost || !tenant.smtpFromEmail)) return this.finish(record, 'FAILED', 'Confira o servidor e o remetente de e-mail da oficina.');
    const claimed = await this.prisma.unscoped.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`care-tenant:${tenant.id}`}, 0))::text`;
      const since = birthday ? localMidnight(now, settings.timeZone) : new Date(now.getTime() - settings.minGapDays * DAY_MS);
      const recent = await tx.customerCareDelivery.findFirst({ where: { tenantId: tenant.id, customerId: customer.id, id: { not: record.id }, status: { in: ['SENDING', 'UNKNOWN', 'SENT'] }, OR: [{ sentAt: { gte: since } }, { attemptedAt: { gte: since } }] } });
      if (recent || await tx.customerCareDelivery.count({ where: { tenantId: tenant.id, status: { in: ['SENDING', 'UNKNOWN', 'SENT'] }, OR: [{ sentAt: { gte: localMidnight(now, settings.timeZone) } }, { attemptedAt: { gte: localMidnight(now, settings.timeZone) } }] } }) >= settings.dailyLimit) return false;
      const consent = await tx.customer.findFirst({ where: { id: customer.id, tenantId: tenant.id, deletedAt: null, careMessagesEnabled: true } });
      if (!consent) return false;
      return (await tx.customerCareDelivery.updateMany({ where: { id: record.id, tenantId: tenant.id, status: 'PENDING' }, data: { status: 'SENDING', attemptedAt: now } })).count === 1;
    });
    if (!claimed) {
      await this.prisma.unscoped.customerCareDelivery.updateMany({ where: { id: record.id, tenantId: tenant.id, status: 'PENDING' }, data: { scheduledAt: new Date(now.getTime() + 60 * 60_000) } });
      return;
    }
    const unsubscribeUrl = this.care.publicUrl(this.secrets.decrypt(record.unsubscribeToken));
    const content = renderCareMessage(settings, valid, { customerName: customer.name, workshopName: tenant.name, contact: tenant.whatsapp ?? tenant.phone, unsubscribeUrl });
    await this.prisma.unscoped.customerCareDelivery.updateMany({ where: { id: record.id, tenantId: tenant.id, status: 'SENDING' }, data: content });
    // Recheck consent immediately before the external side effect. An unknown
    // provider outcome is quarantined rather than blindly retried.
    if (!await this.prisma.unscoped.customer.findFirst({ where: { id: customer.id, tenantId: tenant.id, deletedAt: null, careMessagesEnabled: true } })) return this.finish(record, 'SKIPPED', 'O cliente pausou os lembretes antes do envio.');
    try {
      if (connection) await this.whatsapp.sendNotice(connection, record.recipient, content.message);
      else {
        const html = content.message.split('\n').map(line => line.startsWith('Preferências de contato: ') ? `<p><a href="${escapeHtml(unsubscribeUrl)}">Preferências de contato: pausar lembretes</a></p>` : `<div>${escapeHtml(line) || '<br>'}</div>`).join('');
        const result = await this.mailer.send(tenant.id, { to: record.recipient, subject: content.subject, text: content.message, html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f171f;line-height:1.7"><h2>${escapeHtml(content.subject)}</h2>${html}</div>` });
        if (!result.accepted?.length) throw new Error('SMTP did not accept the recipient');
      }
    } catch { return this.finish(record, 'UNKNOWN', 'O provedor não confirmou o resultado. Confira a conversa ou a caixa de saída; não haverá repetição automática.'); }
    return this.finish(record, 'SENT');
  }

  async retry(tenantId: string, id: string) {
    const settings = await this.care.settings(tenantId);
    if (!settings.enabled) throw new ConflictException('Ative a régua antes de tentar novamente.');
    const record = await this.prisma.unscoped.customerCareDelivery.findFirst({ where: { id, tenantId, status: 'FAILED' } });
    if (!record) throw new ConflictException('Somente falhas anteriores ao envio podem ser tentadas novamente.');
    const [tenant, customer] = await Promise.all([this.prisma.unscoped.tenant.findFirst({ where: { id: tenantId, status: 'active', deletedAt: null } }), this.prisma.unscoped.customer.findFirst({ where: { id: record.customerId, tenantId, deletedAt: null, careMessagesEnabled: true } })]);
    const recipient = tenant && customer ? this.recipient(customer, settings, tenant) : null;
    if (!recipient) throw new ConflictException('Revise a autorização, o contato e o canal do cliente antes de tentar novamente.');
    const result = await this.prisma.unscoped.customerCareDelivery.updateMany({ where: { id, tenantId, status: 'FAILED' }, data: { ...recipient, status: 'PENDING', reason: null, scheduledAt: new Date(), attemptedAt: null } });
    if (!result.count) throw new ConflictException('Somente falhas anteriores ao envio podem ser tentadas novamente.');
    return { queued: true };
  }

  // UNKNOWN means the sending was interrupted and nobody knows if it arrived. The team checks the conversation:
  // if it arrived it becomes SENT; if not it becomes FAILED, and the usual "try again" is offered.
  async resolveUnknown(tenantId: string, id: string, outcome: 'DELIVERED' | 'NOT_DELIVERED', now = new Date()) {
    const record = await this.prisma.unscoped.customerCareDelivery.findFirst({ where: { id, tenantId, status: 'UNKNOWN' } });
    if (!record) throw new ConflictException('Só envios com resultado incerto podem ser conferidos.');
    const data = outcome === 'DELIVERED'
      ? { status: 'SENT', sentAt: record.attemptedAt ?? now, reason: 'Entrega confirmada pela equipe.' }
      : { status: 'FAILED', reason: 'A equipe conferiu e a mensagem não chegou.' };
    const result = await this.prisma.unscoped.customerCareDelivery.updateMany({ where: { id, tenantId, status: 'UNKNOWN' }, data });
    if (!result.count) throw new ConflictException('Só envios com resultado incerto podem ser conferidos.');
    return { status: data.status };
  }

  // Sends the real message of a campaign (with sample data) to a number of the team, marked as a test, so the
  // workshop sees exactly what customers get before switching the automation on. Nothing is recorded as a delivery.
  async testSend(tenantId: string, input: CareTestSendRequest) {
    const recipient = whatsappRecipient(input.phone);
    if (!recipient) throw new BadRequestException('Informe um WhatsApp com DDD, como (11) 99999-8888.');
    const connection = await this.whatsapp.getConnection(tenantId);
    if (!connection) throw new ConflictException('Conecte o WhatsApp da oficina antes de enviar um teste.');
    const { message } = await this.care.preview(tenantId, { campaignKey: input.campaignKey, message: input.message });
    await this.whatsapp.sendNotice(connection, recipient, `🧪 *Mensagem de teste*\n\n${message}`);
    return { sent: true };
  }
}
