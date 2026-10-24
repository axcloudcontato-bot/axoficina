import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@oficina/database';
import type { CustomerReplyNotification, CustomerReplyNotificationsResponse } from '@oficina/contracts';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { PrismaService } from '../../../shared/prisma/prisma.service';

type NotificationRow = Omit<CustomerReplyNotification, 'answeredAt' | 'readAt'> & { answeredAt: Date; readAt: Date | null };

@Injectable()
export class CustomerReplyNotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private source(user: AuthenticatedUser) {
    // Raw SQL does not receive the Prisma tenant extension. Every join and
    // predicate is explicitly scoped to the authenticated tenant and user.
    return Prisma.sql`
      FROM customer_messages m
      JOIN service_orders o ON o.id = m.service_order_id AND o.tenant_id = m.tenant_id AND o.deleted_at IS NULL
      JOIN customers c ON c.id = m.customer_id AND c.tenant_id = m.tenant_id AND c.deleted_at IS NULL
      LEFT JOIN customer_reply_reads r ON r.customer_message_id = m.id AND r.tenant_id = m.tenant_id AND r.user_id = ${user.userId}::uuid
      WHERE m.tenant_id = ${user.tenantId}::uuid AND m.answered_at IS NOT NULL AND m.selected_option IS NOT NULL`;
  }

  async list(user: AuthenticatedUser, cursor?: string): Promise<CustomerReplyNotificationsResponse> {
    const source = this.source(user);
    const before = cursor ? Prisma.sql`AND (m.answered_at, m.id) < (
      SELECT answered_at, id FROM customer_messages WHERE id = ${cursor}::uuid AND tenant_id = ${user.tenantId}::uuid
    )` : Prisma.empty;
    const [rows, counts] = await Promise.all([
      this.prisma.client.$queryRaw<NotificationRow[]>(Prisma.sql`
        SELECT m.id, m.service_order_id AS "serviceOrderId", o.order_number AS "orderNumber",
          c.name AS "customerName", m.question, m.options[m.selected_option + 1] AS "selectedOption",
          m.channel, m.answered_at AS "answeredAt", r.read_at AS "readAt"
        ${source} ${before} ORDER BY m.answered_at DESC, m.id DESC LIMIT 21`),
      this.prisma.client.$queryRaw<Array<{ unreadCount: bigint }>>(Prisma.sql`
        SELECT count(*) FILTER (WHERE r.read_at IS NULL) AS "unreadCount" ${source}`),
    ]);
    const items = rows.slice(0, 20).map((row) => ({ ...row, answeredAt: row.answeredAt.toISOString(), readAt: row.readAt?.toISOString() }));
    return { items, unreadCount: Number(counts[0].unreadCount), nextCursor: rows.length > 20 ? items.at(-1)!.id : undefined };
  }

  async markRead(user: AuthenticatedUser, id: string) {
    const found = await this.prisma.client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT m.id ${this.source(user)} AND m.id = ${id}::uuid LIMIT 1`);
    if (!found.length) throw new NotFoundException('Notificação não encontrada.');
    // skipDuplicates makes concurrent clicks idempotent without changing the
    // first read timestamp. Ownership comes only from the authenticated user.
    await this.prisma.client.customerReplyRead.createMany({
      data: [{ tenantId: user.tenantId, userId: user.userId, customerMessageId: id }], skipDuplicates: true,
    });
    return { read: true };
  }
}
