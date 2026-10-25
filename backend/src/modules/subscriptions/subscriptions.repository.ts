import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@oficina/database';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { SubscriptionListDto, UpdateSubscriptionDto } from './subscriptions.dto';

export const SUBSCRIPTION_SELECT = {
  id: true, name: true, document: true, email: true, plan: true,
  subscriptionStatus: true, subscriptionAmountCents: true, subscriptionCycle: true,
  subscriptionDueAt: true, subscriptionNotes: true, createdAt: true, updatedAt: true,
} satisfies Prisma.TenantSelect;

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: SubscriptionListDto) {
    const search = query.search?.trim();
    const document = search?.replace(/\D/g, '');
    const where: Prisma.TenantWhereInput = {
      deletedAt: null,
      ...(query.status ? { subscriptionStatus: query.status } : {}),
      ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { document: { contains: search } },
        ...(document ? [{ document: { contains: document } }] : []),
      ] } : {}),
    };
    // Global access is intentional and only reachable behind SaasAdminGuard.
    return this.prisma.unscoped.$transaction(async (tx) => {
      const items = await tx.tenant.findMany({ where, select: SUBSCRIPTION_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: query.offset, take: query.limit });
      const total = await tx.tenant.count({ where });
      const groups = await tx.tenant.groupBy({
        by: ['subscriptionStatus', 'subscriptionCycle'], where: { deletedAt: null },
        _count: { _all: true }, _sum: { subscriptionAmountCents: true },
      });
      return { items, total, groups };
    }, { isolationLevel: 'RepeatableRead' });
  }

  async update(id: string, input: UpdateSubscriptionDto, actor: AuthenticatedUser) {
    return this.prisma.unscoped.$transaction(async (tx) => {
      const before = await tx.tenant.findFirst({ where: { id, deletedAt: null }, select: SUBSCRIPTION_SELECT });
      if (!before) throw new NotFoundException('Oficina não encontrada.');
      if (input.expectedUpdatedAt === undefined || input.subscriptionDueAt === undefined || input.subscriptionNotes === undefined) {
        throw new ConflictException('Recarregue a assinatura antes de salvar.');
      }
      const result = await tx.tenant.updateMany({
        where: { id, deletedAt: null, updatedAt: input.expectedUpdatedAt ? new Date(input.expectedUpdatedAt) : null },
        data: {
          plan: input.plan, subscriptionStatus: input.subscriptionStatus,
          subscriptionAmountCents: input.subscriptionAmountCents, subscriptionCycle: input.subscriptionCycle,
          subscriptionDueAt: input.subscriptionDueAt ? new Date(input.subscriptionDueAt) : null,
          subscriptionNotes: input.subscriptionNotes?.trim() || null,
        },
      });
      if (!result.count) throw new ConflictException('Esta oficina foi alterada por outra pessoa. Atualize a lista e abra a assinatura novamente.');
      // The audit and subscription commit together. Never copy free-form notes.
      await tx.auditLog.create({ data: {
        tenantId: id, userId: actor.userId, action: 'subscription.updated', entity: 'tenant', entityId: id,
        metadata: {
          before: { plan: before.plan, status: before.subscriptionStatus, amountCents: before.subscriptionAmountCents, cycle: before.subscriptionCycle, dueAt: before.subscriptionDueAt?.toISOString() ?? null },
          after: { plan: input.plan, status: input.subscriptionStatus, amountCents: input.subscriptionAmountCents, cycle: input.subscriptionCycle, dueAt: input.subscriptionDueAt },
        },
      } });
      return tx.tenant.findFirstOrThrow({ where: { id, deletedAt: null }, select: SUBSCRIPTION_SELECT });
    });
  }
}
