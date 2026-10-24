import { Injectable } from '@nestjs/common';
import type { CustomerMessage, Prisma } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class CustomerMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.CustomerMessageCreateInput): Promise<CustomerMessage> {
    return this.prisma.client.customerMessage.create({ data });
  }

  list(serviceOrderId: string): Promise<CustomerMessage[]> {
    return this.prisma.client.customerMessage.findMany({ where: { serviceOrderId }, orderBy: { createdAt: 'desc' }, take: 50 });
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
    return order && customer && tenant ? { message, companyName: tenant.name } : null;
  }

  answer(id: string, tenantId: string, tokenHash: string, selectedOption: number): Promise<Prisma.BatchPayload> {
    return this.prisma.unscoped.customerMessage.updateMany({
      where: { id, tenantId, tokenHash, answeredAt: null, expiresAt: { gt: new Date() } },
      data: { selectedOption, answeredAt: new Date() },
    });
  }
}
