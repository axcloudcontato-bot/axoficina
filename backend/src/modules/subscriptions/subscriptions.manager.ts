import { Injectable } from '@nestjs/common';
import type { SubscriptionListResponse, SubscriptionResponse } from '@oficina/contracts';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { EntitlementsService } from '../../shared/plan/entitlements.service';
import type { SubscriptionListDto, UpdateSubscriptionDto } from './subscriptions.dto';
import { SubscriptionsRepository } from './subscriptions.repository';

type SubscriptionRecord = Awaited<ReturnType<SubscriptionsRepository['update']>>;

function serialize(item: SubscriptionRecord): SubscriptionResponse {
  return {
    ...item,
    extraModules: item.extraModules as SubscriptionResponse['extraModules'],
    subscriptionStatus: item.subscriptionStatus as SubscriptionResponse['subscriptionStatus'],
    subscriptionCycle: item.subscriptionCycle as SubscriptionResponse['subscriptionCycle'],
    subscriptionDueAt: item.subscriptionDueAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class SubscriptionsManager {
  constructor(private readonly repository: SubscriptionsRepository, private readonly entitlements: EntitlementsService) {}

  async list(query: SubscriptionListDto): Promise<SubscriptionListResponse> {
    const { items, total, groups } = await this.repository.list(query);
    const summary = { total: 0, active: 0, trial: 0, pastDue: 0, mrrCents: 0 };
    let mrr = 0;
    for (const group of groups) {
      summary.total += group._count._all;
      if (group.subscriptionStatus === 'trial') summary.trial += group._count._all;
      if (group.subscriptionStatus === 'past_due') summary.pastDue += group._count._all;
      if (group.subscriptionStatus === 'active') {
        summary.active += group._count._all;
        mrr += (group._sum.subscriptionAmountCents ?? 0) / (group.subscriptionCycle === 'yearly' ? 12 : 1);
      }
    }
    summary.mrrCents = Math.round(mrr);
    return { items: items.map(serialize), total, summary };
  }

  async update(id: string, input: UpdateSubscriptionDto, actor: AuthenticatedUser) {
    const updated = serialize(await this.repository.update(id, input, actor));
    this.entitlements.forget(id);
    return updated;
  }
}
