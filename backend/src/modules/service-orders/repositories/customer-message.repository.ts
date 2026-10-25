import { Injectable } from '@nestjs/common';
import type { CustomerMessage, Prisma } from '@oficina/database';
import type { CustomerMessageQuote } from '@oficina/contracts';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { quotesMatch } from '../services/customer-message-quote';

@Injectable()
export class CustomerMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.CustomerMessageCreateInput): Promise<CustomerMessage> {
    return this.prisma.client.customerMessage.create({ data });
  }

  list(serviceOrderId: string): Promise<CustomerMessage[]> {
    return this.prisma.client.customerMessage.findMany({ where: { serviceOrderId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50 });
  }

  byId(id: string): Promise<CustomerMessage | null> { return this.prisma.client.customerMessage.findFirst({ where: { id } }); }

  latestQuote(serviceOrderId: string): Promise<CustomerMessage | null> {
    return this.prisma.client.customerMessage.findFirst({ where: { serviceOrderId, purpose: 'QUOTE' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  }

  remove(id: string): Promise<Prisma.BatchPayload> {
    return this.prisma.client.customerMessage.deleteMany({ where: { id } });
  }

  markSent(id: string, providerMessageId?: string): Promise<Prisma.BatchPayload> {
    return this.prisma.client.customerMessage.updateMany({ where: { id }, data: { sentAt: new Date(), providerMessageId } });
  }

  // The public route has no tenant context. Only the token hash can locate
  // a message; every subsequent lookup/write includes its recorded tenant.
  async byTokenHash(tokenHash: string) {
    const message = await this.prisma.unscoped.customerMessage.findUnique({ where: { tokenHash } });
    if (!message) return null;
    const [order, customer, tenant] = await Promise.all([
      this.prisma.unscoped.serviceOrder.findFirst({ where: { id: message.serviceOrderId, tenantId: message.tenantId, customerId: message.customerId, deletedAt: null, status: { not: 'CANCELLED' } } }),
      this.prisma.unscoped.customer.findFirst({ where: { id: message.customerId, tenantId: message.tenantId, deletedAt: null } }),
      this.prisma.unscoped.tenant.findFirst({ where: { id: message.tenantId, deletedAt: null } }),
    ]);
    if (!order || !customer || !tenant) return null;
    let quoteIsCurrent: boolean | undefined;
    let isLatestQuote = true;
    if (message.purpose === 'QUOTE' && message.quoteSnapshot) {
      // The token already established the order and tenant; items have no tenant column.
      const [items, latest] = await Promise.all([
        this.prisma.unscoped.serviceOrderItem.findMany({ where: { serviceOrderId: order.id, deletedAt: null } }),
        this.prisma.unscoped.customerMessage.findFirst({ where: { tenantId: message.tenantId, serviceOrderId: order.id, purpose: 'QUOTE' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } }),
      ]);
      const lines = items.map((item) => ({ id: item.id, type: item.type, description: item.description, quantity: item.quantity.toNumber(), unitPriceCents: item.unitPriceCents, lineTotalCents: Math.round(item.quantity.toNumber() * item.unitPriceCents) }));
      const snapshot = message.quoteSnapshot as unknown as CustomerMessageQuote;
      quoteIsCurrent = quotesMatch(snapshot, { ...snapshot, items: lines, totalAmountCents: lines.reduce((sum, item) => sum + item.lineTotalCents, 0) });
      isLatestQuote = latest?.id === message.id;
    }
    return { message, companyName: tenant.name, quoteIsCurrent, isLatestQuote, orderStatus: order.status };
  }

  answer(id: string, tenantId: string, tokenHash: string, selectedOption: number): Promise<Prisma.BatchPayload> {
    return this.prisma.unscoped.customerMessage.updateMany({
      where: { id, tenantId, tokenHash, answeredAt: null, expiresAt: { gt: new Date() } },
      data: { selectedOption, answeredAt: new Date() },
    });
  }
}
