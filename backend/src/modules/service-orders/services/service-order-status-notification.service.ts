import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ListServiceOrderStatusNotificationsRequest, ServiceOrderStatusNotificationResponse, ServiceOrderStatusNotificationsResponse } from '@oficina/contracts';
import type { ServiceOrderStatusNotification } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import { WaAkgService } from '../../settings/services/wa-akg.service';
import { whatsappRecipient } from '../../settings/services/whatsapp-recipient';
import { ServiceOrderRepository } from '../repositories/service-order.repository';
import { ServiceOrderStatusNotificationRepository } from '../repositories/service-order-status-notification.repository';

const REASONS: Record<string, string> = {
  WHATSAPP_DISABLED: 'A integração WhatsApp da oficina está desativada.',
  CONNECTION_ERROR: 'Não foi possível carregar a conexão WhatsApp. Confira a configuração da oficina.',
  INVALID_PHONE: 'O cliente não possui um telefone válido para WhatsApp.',
  DELIVERY_UNCONFIRMED: 'O WhatsApp não confirmou o envio. Confira a conversa antes de reenviar.',
  INTERRUPTED: 'O processamento foi interrompido durante o envio. Confira a conversa antes de reenviar.',
  PREFERENCE_DISABLED: 'O cliente desativou os avisos de movimentação da OS.',
  CUSTOMER_UNAVAILABLE: 'O cadastro do cliente não está disponível.',
  PHONE_CHANGED: 'O telefone do cliente foi alterado após esta movimentação.',
  ORDER_UNAVAILABLE: 'A ordem de serviço não está disponível.',
};

@Injectable()
export class ServiceOrderStatusNotificationService {
  private readonly logger = new Logger(ServiceOrderStatusNotificationService.name);
  constructor(private readonly notifications: ServiceOrderStatusNotificationRepository, private readonly prisma: PrismaService,
    private readonly whatsapp: WaAkgService, private readonly orders: ServiceOrderRepository, private readonly audit: AuditLogService) {}

  async list(request: ListServiceOrderStatusNotificationsRequest): Promise<ServiceOrderStatusNotificationsResponse> {
    if (!await this.orders.byId(request.serviceOrderId)) throw new NotFoundException('Ordem de serviço não encontrada.');
    const { items, total } = await this.notifications.list(request.serviceOrderId, request.offset, request.limit);
    return { items: items.map(record => this.response(record)), total, offset: request.offset, limit: request.limit, hasMore: request.offset + items.length < total };
  }

  async retry(user: AuthenticatedUser, id: string) {
    const record = await this.notifications.byId(id);
    if (!record || !await this.orders.byId(record.serviceOrderId)) throw new NotFoundException('Aviso não encontrado nesta oficina.');
    const customer = await this.prisma.client.customer.findFirst({ where: { id: record.customerId, deletedAt: null } });
    if (!customer?.notifyServiceOrderUpdates) throw new BadRequestException('Os avisos de movimentação estão desativados no cadastro deste cliente.');
    if (!record.recipient || whatsappRecipient(customer.phone) !== record.recipient) throw new BadRequestException('O telefone deste aviso é inválido ou foi alterado. Os próximos avisos usarão o telefone atual.');
    const changed = await this.notifications.retry(id, user.tenantId);
    if (!changed.count) throw new ConflictException('Este aviso já está enviado, em processamento ou indisponível para reenvio.');
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'service_order.status_notification_retry', entity: 'service_order_status_notification', entityId: id, metadata: { serviceOrderId: record.serviceOrderId } });
    return { queued: true };
  }

  async dispatchPending() {
    await this.notifications.expireClaims();
    // Parallel orders can progress independently; the DB claim preserves the
    // movement order inside each OS even when multiple app replicas run.
    await Promise.all(Array.from({ length: 3 }, async () => {
      for (let count = 0; count < 5; count++) {
        const record = await this.notifications.claimNext();
        if (!record) return;
        try { await this.dispatch(record); }
        catch {
          // Keep a claim SENDING if persistence failed after a possible send.
          // Recovery marks it uncertain rather than silently sending twice.
          this.logger.warn(`Não foi possível finalizar o processamento do aviso ${record.id}.`);
        }
      }
    }));
  }

  private async dispatch(record: ServiceOrderStatusNotification) {
    // A worker has no request tenant context. Every operational lookup is
    // explicitly tied to the tenant/customer/order of the claimed event.
    const [customer, order, tenant] = await Promise.all([
      this.prisma.unscoped.customer.findFirst({ where: { id: record.customerId, tenantId: record.tenantId, deletedAt: null } }),
      this.prisma.unscoped.serviceOrder.findFirst({ where: { id: record.serviceOrderId, tenantId: record.tenantId, customerId: record.customerId, deletedAt: null } }),
      this.prisma.unscoped.tenant.findFirst({ where: { id: record.tenantId, deletedAt: null } }),
    ]);
    if (!customer) return this.notifications.finish(record, 'SKIPPED', 'CUSTOMER_UNAVAILABLE');
    if (!customer.notifyServiceOrderUpdates) return this.notifications.finish(record, 'SKIPPED', 'PREFERENCE_DISABLED');
    if (!order || !tenant) return this.notifications.finish(record, 'SKIPPED', 'ORDER_UNAVAILABLE');
    if (!record.recipient) return this.notifications.finish(record, 'FAILED', 'INVALID_PHONE');
    if (whatsappRecipient(customer.phone) !== record.recipient) return this.notifications.finish(record, 'SKIPPED', 'PHONE_CHANGED');
    let connection;
    try { connection = await this.whatsapp.getConnection(record.tenantId); }
    catch { return this.notifications.finish(record, 'FAILED', 'CONNECTION_ERROR'); }
    if (!connection) return this.notifications.finish(record, 'FAILED', 'WHATSAPP_DISABLED');
    try { await this.whatsapp.sendNotice(connection, record.recipient, record.message); }
    catch { return this.notifications.finish(record, 'FAILED', 'DELIVERY_UNCONFIRMED'); }
    return this.notifications.finish(record, 'SENT');
  }

  private response(record: ServiceOrderStatusNotification): ServiceOrderStatusNotificationResponse {
    return { id: record.id, fromStatus: record.fromStatus as ServiceOrderStatusNotificationResponse['fromStatus'] ?? undefined,
      toStatus: record.toStatus as ServiceOrderStatusNotificationResponse['toStatus'], status: record.status as ServiceOrderStatusNotificationResponse['status'],
      message: record.message, recipient: record.recipient.replace('@s.whatsapp.net', ''), attempts: record.attempts,
      failureReason: record.failureReason ? REASONS[record.failureReason] ?? 'Não foi possível confirmar o envio.' : undefined,
      occurredAt: record.occurredAt.toISOString(), sentAt: record.sentAt?.toISOString() };
  }
}
