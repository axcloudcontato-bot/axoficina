import { Injectable } from '@nestjs/common';
import type { PrismaClient, ServiceOrder, ServiceOrderStatusNotification } from '@oficina/database';
import type { ServiceOrderStatus } from '@oficina/contracts';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { whatsappRecipient } from '../../settings/services/whatsapp-recipient';
import { serviceOrderStatusMessage } from '../services/service-order-status-message';

@Injectable()
export class ServiceOrderStatusNotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(tx: PrismaClient, order: ServiceOrder, event: { id: string; fromStatus: ServiceOrderStatus | null; toStatus: ServiceOrderStatus; changedAt: Date }) {
    const customer = await tx.customer.findFirst({ where: { id: order.customerId, tenantId: order.tenantId, deletedAt: null } });
    if (!customer?.notifyServiceOrderUpdates) return;
    const [vehicle, tenant] = await Promise.all([
      tx.vehicle.findFirst({ where: { id: order.vehicleId, tenantId: order.tenantId, deletedAt: null } }),
      tx.tenant.findFirst({ where: { id: order.tenantId, deletedAt: null } }),
    ]);
    if (!vehicle || !tenant) return;
    await tx.serviceOrderStatusNotification.create({ data: {
      tenantId: order.tenantId, serviceOrderId: order.id, customerId: customer.id, historyId: event.id,
      fromStatus: event.fromStatus, toStatus: event.toStatus, occurredAt: event.changedAt,
      recipient: whatsappRecipient(customer.phone) ?? '',
      message: serviceOrderStatusMessage({ companyName: tenant.name, customerName: customer.name, orderNumber: order.orderNumber,
        vehicle: `${vehicle.brand} ${vehicle.model}`, plate: vehicle.plate, openedAt: order.openedAt,
        expectedDeliveryAt: order.expectedDeliveryAt, complaint: order.customerComplaint,
        fromStatus: event.fromStatus, toStatus: event.toStatus, occurredAt: event.changedAt }),
    } });
  }

  async list(serviceOrderId: string, offset: number, limit: number) {
    const where = { serviceOrderId };
    const [items, total] = await Promise.all([
      this.prisma.client.serviceOrderStatusNotification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: limit }),
      this.prisma.client.serviceOrderStatusNotification.count({ where }),
    ]);
    return { items, total };
  }

  byId(id: string): Promise<ServiceOrderStatusNotification | null> { return this.prisma.client.serviceOrderStatusNotification.findFirst({ where: { id } }); }

  async retry(id: string, tenantId: string) {
    return this.prisma.client.serviceOrderStatusNotification.updateMany({ where: { id, tenantId, status: 'FAILED' }, data: { status: 'PENDING', failureReason: null, attemptedAt: null } });
  }

  // Background worker only. The atomic claim serializes each order across
  // replicas. Raw SQL is deliberately cross-tenant; subsequent reads and
  // writes are bound to the claimed record's tenant.
  async claimNext(): Promise<ServiceOrderStatusNotification | null> {
    const claimed = await this.prisma.unscoped.$queryRaw<{ id: string }[]>`
      UPDATE service_order_status_notifications n SET status = 'SENDING', attempted_at = now(), attempts = attempts + 1
      WHERE n.status = 'PENDING' AND n.id = (
        SELECT candidate.id FROM service_order_status_notifications candidate
        WHERE candidate.status = 'PENDING' AND NOT EXISTS (
          SELECT 1 FROM service_order_status_notifications earlier
          WHERE earlier.tenant_id = candidate.tenant_id AND earlier.service_order_id = candidate.service_order_id
            AND (earlier.status = 'SENDING' OR (earlier.status = 'PENDING'
              AND (earlier.created_at, earlier.id) < (candidate.created_at, candidate.id)))
        ) ORDER BY candidate.created_at, candidate.id LIMIT 1 FOR UPDATE OF candidate SKIP LOCKED
      ) RETURNING n.id`;
    return claimed.length ? this.prisma.unscoped.serviceOrderStatusNotification.findFirst({ where: { id: claimed[0].id } }) : null;
  }

  async finish(record: ServiceOrderStatusNotification, status: 'SENT' | 'FAILED' | 'SKIPPED', failureReason?: string) {
    return this.prisma.unscoped.serviceOrderStatusNotification.updateMany({ where: { id: record.id, tenantId: record.tenantId, status: 'SENDING', attempts: record.attempts }, data: { status, failureReason: failureReason ?? null, ...(status === 'SENT' ? { sentAt: new Date() } : {}) } });
  }

  async expireClaims() {
    return this.prisma.unscoped.serviceOrderStatusNotification.updateMany({ where: { status: 'SENDING', attemptedAt: { lt: new Date(Date.now() - 10 * 60_000) } }, data: { status: 'FAILED', failureReason: 'INTERRUPTED' } });
  }
}
