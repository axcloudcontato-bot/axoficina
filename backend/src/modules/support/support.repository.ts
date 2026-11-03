import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { SupportTicket } from '@oficina/database';
import type { CreateSupportTicketDto, SupportTicketListDto, UpdateSupportTicketDto } from './support.dto';

@Injectable()
export class SupportRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, userId: string, input: CreateSupportTicketDto): Promise<SupportTicket> {
    return this.prisma.client.supportTicket.create({ data: { tenantId, createdById: userId, subject: input.subject, description: input.description, priority: input.priority } });
  }

  async listOwn(tenantId: string, userId: string, offset: number) {
    const where = { tenantId, createdById: userId };
    const [items, total] = await Promise.all([
      this.prisma.client.supportTicket.findMany({ where, orderBy: { createdAt: 'desc' }, skip: offset, take: 20 }),
      this.prisma.client.supportTicket.count({ where }),
    ]);
    return { items, total };
  }

  // Cross-workshop reads are exclusive to the SaaS admin controller and include only ticket authors.
  listAdmin(query: SupportTicketListDto) {
    return this.prisma.unscoped.$transaction(async (tx) => {
      const where = query.status ? { status: query.status } : {};
      const [items, total] = await Promise.all([
        tx.supportTicket.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: query.offset, take: 30 }),
        tx.supportTicket.count({ where }),
      ]);
      const tenantIds = [...new Set(items.map((item) => item.tenantId))];
      const userIds = [...new Set(items.map((item) => item.createdById))];
      const [tenants, users] = await Promise.all([
        tx.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } }),
        tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true, tenantId: true, name: true, email: true } }),
      ]);
      const tenantNames = new Map(tenants.map((item) => [item.id, item.name]));
      const authors = new Map(users.map((item) => [item.id, item]));
      return { items: items.map((item) => ({ ...item, tenantName: tenantNames.get(item.tenantId) ?? 'Oficina removida', authorName: authors.get(item.createdById)?.name ?? 'Usuário removido', authorEmail: authors.get(item.createdById)?.email ?? null })), total };
    });
  }

  updateAdmin(id: string, input: UpdateSupportTicketDto) {
    return this.prisma.unscoped.$transaction(async (tx) => {
      const current = await tx.supportTicket.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Chamado não encontrado.');
      if (input.status === 'RESOLVED' && !input.response && !current.response) throw new BadRequestException('Responda ao chamado antes de marcá-lo como resolvido.');
      return tx.supportTicket.update({ where: { id }, data: { ...(input.status ? { status: input.status } : {}), ...(input.response ? { response: input.response, respondedAt: new Date() } : {}) } });
    });
  }
}
