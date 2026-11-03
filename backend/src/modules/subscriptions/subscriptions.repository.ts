import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@oficina/database';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { SubscriptionListDto, UpdateSubscriptionDto } from './subscriptions.dto';

export const SUBSCRIPTION_SELECT = {
  id: true, name: true, document: true, email: true, plan: true, extraModules: true,
  subscriptionStatus: true, subscriptionAmountCents: true, subscriptionCycle: true,
  subscriptionDueAt: true, subscriptionNotes: true, deletedAt: true, closedBy: true, closureReason: true, purgeAfter: true,
  waAkgSessionId: true, createdAt: true, updatedAt: true,
} satisfies Prisma.TenantSelect;

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: SubscriptionListDto) {
    const search = query.search?.trim();
    const document = search?.replace(/\D/g, '');
    const where: Prisma.TenantWhereInput = {
      deletedAt: query.scope === 'closed' ? { not: null } : null,
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
      const items = await tx.tenant.findMany({ where, select: SUBSCRIPTION_SELECT, orderBy: query.scope === 'closed' ? [{ purgeAfter: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }], skip: query.offset, take: query.limit });
      // The account owner is the first user of the workshop (the one created at sign-up).
      const users = items.length ? await tx.user.findMany({
        where: { tenantId: { in: items.map((item) => item.id) }, deletedAt: null },
        select: { tenantId: true, email: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }) : [];
      const ownerEmails = new Map<string, string>();
      for (const user of users) if (!ownerEmails.has(user.tenantId)) ownerEmails.set(user.tenantId, user.email);
      const total = await tx.tenant.count({ where });
      const groups = await tx.tenant.groupBy({
        by: ['subscriptionStatus', 'subscriptionCycle'], where: { deletedAt: null },
        _count: { _all: true }, _sum: { subscriptionAmountCents: true },
      });
      return { items, total, groups, ownerEmails };
    }, { isolationLevel: 'RepeatableRead' });
  }

  async update(id: string, input: UpdateSubscriptionDto, actor: AuthenticatedUser) {
    return this.prisma.unscoped.$transaction(async (tx) => {
      const before = await tx.tenant.findFirst({ where: { id, deletedAt: null }, select: SUBSCRIPTION_SELECT });
      if (!before) throw new NotFoundException('Oficina não encontrada.');
      if (input.expectedUpdatedAt === undefined || input.subscriptionDueAt === undefined || input.subscriptionNotes === undefined) {
        throw new ConflictException('Recarregue a assinatura antes de salvar.');
      }
      // The WhatsApp number is chosen here, never by the workshop: two workshops sharing a session would share a number.
      const session = input.whatsappSessionId === undefined ? undefined : input.whatsappSessionId?.trim() || null;
      const sessionChanged = session !== undefined && session !== before.waAkgSessionId;
      if (sessionChanged && session && await tx.tenant.findFirst({ where: { waAkgSessionId: session, id: { not: id } }, select: { id: true } })) {
        throw new ConflictException('Esta sessão do WhatsApp já está em uso por outra oficina.');
      }
      const result = await tx.tenant.updateMany({
        where: { id, deletedAt: null, updatedAt: input.expectedUpdatedAt ? new Date(input.expectedUpdatedAt) : null },
        data: {
          ...(sessionChanged ? {
            waAkgSessionId: session, waAkgTestedAt: null, waAkgTestSuccessAt: null, waAkgTestError: null,
            waWebhookTestedAt: null, waWebhookTestSuccessAt: null, waWebhookTestError: null,
            ...(session ? {} : { waAkgEnabled: false }),
          } : {}),
          plan: input.plan, extraModules: input.extraModules, subscriptionStatus: input.subscriptionStatus,
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
          before: { plan: before.plan, extraModules: before.extraModules, status: before.subscriptionStatus, amountCents: before.subscriptionAmountCents, cycle: before.subscriptionCycle, dueAt: before.subscriptionDueAt?.toISOString() ?? null },
          after: { plan: input.plan, extraModules: input.extraModules, status: input.subscriptionStatus, amountCents: input.subscriptionAmountCents, cycle: input.subscriptionCycle, dueAt: input.subscriptionDueAt },
        },
      } });
      return tx.tenant.findFirstOrThrow({ where: { id, deletedAt: null }, select: SUBSCRIPTION_SELECT });
    });
  }
}
