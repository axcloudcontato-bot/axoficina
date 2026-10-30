import { ForbiddenException, Injectable } from '@nestjs/common';
import { limitStatus, type LimitKind, type PlanUsage } from '@oficina/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from './entitlements.service';

// Start of the current month in São Paulo (UTC-3), which is when "orders per month" restarts.
export function monthStart(now: Date = new Date()): Date {
  const local = new Date(now.getTime() - 3 * 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 3));
}

const LIMIT_TEXT: Record<LimitKind, (plan: string, limit: number) => string> = {
  users: (plan, limit) => `O plano ${plan} permite até ${limit} usuários, contando os convites pendentes. Desative alguém ou fale com o suporte para ampliar o plano.`,
  orders: (plan, limit) => `O plano ${plan} permite até ${limit} ordens de serviço por mês e esse limite já foi atingido. Fale com o suporte para ampliar o plano.`,
  photos: (plan, limit) => `O plano ${plan} permite até ${Math.round(limit / 1024)} GB de fotos e o espaço acabou. Fale com o suporte para ampliar o plano.`,
};

@Injectable()
export class PlanUsageService {
  constructor(private readonly prisma: PrismaService, private readonly entitlements: EntitlementsService) {}

  // Counts always carry the tenant explicitly: this runs from guards, before any tenant context exists.
  async usage(tenantId: string): Promise<PlanUsage> {
    const db = this.prisma.unscoped;
    const [users, orders, photos] = await Promise.all([
      db.user.count({ where: { tenantId, deletedAt: null, status: { in: ['active', 'invited'] } } }),
      db.serviceOrder.count({ where: { tenantId, deletedAt: null, createdAt: { gte: monthStart() } } }),
      db.serviceOrderPhoto.aggregate({ where: { tenantId, deletedAt: null }, _sum: { sizeBytes: true } }),
    ]);
    return { users, ordersThisMonth: orders, photoStorageMb: Math.round((photos._sum.sizeBytes ?? 0) / 1_048_576) };
  }

  // Refuses creating something new when the account is view-only or the plan's limit for it is used up.
  async assertCanAdd(tenantId: string, kind: LimitKind | 'write'): Promise<void> {
    const { access, limits, planName } = await this.entitlements.forTenant(tenantId);
    if (access.state === 'suspended') {
      throw new ForbiddenException('A assinatura da oficina está suspensa e o sistema está só para consulta. Fale com o suporte do Ofix para regularizar.');
    }
    if (kind === 'write') return;
    const limit = { users: limits.users, orders: limits.ordersPerMonth, photos: limits.photoStorageMb }[kind];
    if (limit === null) return;
    const usage = await this.usage(tenantId);
    const used = { users: usage.users, orders: usage.ordersThisMonth, photos: usage.photoStorageMb }[kind];
    if (limitStatus(used, limit) === 'over') throw new ForbiddenException(LIMIT_TEXT[kind](planName, limit));
  }
}
