import { Injectable } from '@nestjs/common';
import { entitledModules, resolvePlan, type EntitlementsResponse } from '@oficina/contracts';
import { PrismaService } from '../prisma/prisma.service';

const TTL_MS = 30_000;

// What a workshop's plan lets it use. Read on every gated request, so it is cached for a few seconds;
// changing a plan calls forget() so the owner of the SaaS sees the change at once on this instance.
@Injectable()
export class EntitlementsService {
  private readonly cache = new Map<string, { value: EntitlementsResponse; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async forTenant(tenantId: string): Promise<EntitlementsResponse> {
    const hit = this.cache.get(tenantId);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    const tenant = await this.prisma.unscoped.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { plan: true, extraModules: true } });
    const plan = resolvePlan(tenant?.plan);
    const value: EntitlementsResponse = { plan: plan.code, planName: plan.name, modules: entitledModules(tenant?.plan, tenant?.extraModules ?? []), limits: plan.limits };
    this.cache.set(tenantId, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  }

  forget(tenantId: string) {
    this.cache.delete(tenantId);
  }
}
