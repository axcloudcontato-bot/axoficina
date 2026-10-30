// What each plan sells. Kept in code, not in the database, so a price or module change goes through review and tests.
export const MODULE_KEYS = ['financeiro', 'produtividade', 'cuidado', 'whatsapp', 'governanca'] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const PLAN_CODES = ['essencial', 'profissional', 'completo'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

// null means no limit. Limits are shown today and enforced in a later phase.
export interface PlanLimits { users: number | null; ordersPerMonth: number | null; photoStorageMb: number | null }

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  monthlyPriceCents: number;
  tagline: string;
  modules: readonly ModuleKey[];
  limits: PlanLimits;
}

export const PLANS: Record<PlanCode, PlanDefinition> = {
  essencial: { code: 'essencial', name: 'Essencial', monthlyPriceCents: 12990, tagline: 'Para tocar a oficina: clientes, veículos, ordens de serviço e agenda.', modules: [], limits: { users: 3, ordersPerMonth: 150, photoStorageMb: 5 * 1024 } },
  profissional: { code: 'profissional', name: 'Profissional', monthlyPriceCents: 15990, tagline: 'Para organizar a equipe e o caixa.', modules: ['financeiro', 'produtividade', 'cuidado'], limits: { users: 8, ordersPerMonth: 600, photoStorageMb: 25 * 1024 } },
  completo: { code: 'completo', name: 'Completo', monthlyPriceCents: 19990, tagline: 'Para trazer o cliente de volta: WhatsApp, histórico e exportação.', modules: MODULE_KEYS, limits: { users: null, ordersPerMonth: null, photoStorageMb: 100 * 1024 } },
};

export interface ModuleInfo { label: string; description: string; minPlan: PlanCode }

export const MODULES: Record<ModuleKey, ModuleInfo> = {
  financeiro: { label: 'Financeiro', description: 'Contas a pagar e a receber, fluxo de caixa, fornecedores e comprovantes.', minPlan: 'profissional' },
  produtividade: { label: 'Produtividade', description: 'Metas, eficiência, comissões, garantia e retorno, e tempo ocioso dos técnicos.', minPlan: 'profissional' },
  cuidado: { label: 'Cuidado com o cliente', description: 'Alertas de manutenção, régua de lembretes e aniversários.', minPlan: 'profissional' },
  whatsapp: { label: 'WhatsApp', description: 'Conexão com o WhatsApp da oficina, mensagens e respostas dos clientes.', minPlan: 'completo' },
  governanca: { label: 'Histórico e exportação', description: 'Histórico de alterações, exportação dos dados e perfis de acesso personalizados.', minPlan: 'completo' },
};

// Workshops created before plans existed carry "free" or an empty value: they keep everything until a plan is chosen.
export function resolvePlan(code: string | null | undefined): PlanDefinition {
  return PLANS[code as PlanCode] ?? PLANS.completo;
}

export function entitledModules(plan: string | null | undefined, extra: readonly string[] = []): ModuleKey[] {
  const owned = new Set<string>([...resolvePlan(plan).modules, ...extra]);
  return MODULE_KEYS.filter(key => owned.has(key));
}

export interface EntitlementsResponse {
  plan: PlanCode;
  planName: string;
  modules: ModuleKey[];
  limits: PlanLimits;
}

// A late or ended subscription is not cut off at once: the workshop gets a few days, then can only look at what it has.
export const ACCESS_GRACE_DAYS = 7;
export type AccessState = 'active' | 'grace' | 'suspended';
export interface AccessStatus {
  state: AccessState;
  /** Days left before it turns to view-only; only while in grace and when a due date is known. */
  daysLeft: number | null;
  reason: 'past_due' | 'trial_ended' | 'canceled' | null;
}

export function accessStatus(subscription: { status: string; dueAt: Date | string | null }, now: Date = new Date()): AccessStatus {
  if (subscription.status === 'canceled') return { state: 'suspended', daysLeft: null, reason: 'canceled' };
  if (subscription.status !== 'past_due' && subscription.status !== 'trial') return { state: 'active', daysLeft: null, reason: null };
  const reason = subscription.status === 'trial' ? 'trial_ended' : 'past_due';
  if (!subscription.dueAt) return subscription.status === 'trial' ? { state: 'active', daysLeft: null, reason: null } : { state: 'grace', daysLeft: null, reason };
  const lateDays = (now.getTime() - new Date(subscription.dueAt).getTime()) / 86_400_000;
  if (lateDays <= 0) return { state: 'active', daysLeft: null, reason: null };
  if (lateDays >= ACCESS_GRACE_DAYS) return { state: 'suspended', daysLeft: null, reason };
  return { state: 'grace', daysLeft: Math.ceil(ACCESS_GRACE_DAYS - lateDays), reason };
}

export const LIMIT_KINDS = ['users', 'orders', 'photos'] as const;
export type LimitKind = (typeof LIMIT_KINDS)[number];

export interface PlanUsage { users: number; ordersThisMonth: number; photoStorageMb: number }

export const NEAR_LIMIT_RATIO = 0.8;
export type LimitStatus = 'ok' | 'near' | 'over';

export function limitStatus(used: number, limit: number | null): LimitStatus {
  if (limit === null) return 'ok';
  if (used >= limit) return 'over';
  return used >= limit * NEAR_LIMIT_RATIO ? 'near' : 'ok';
}

export interface PlanStatusResponse extends EntitlementsResponse { access: AccessStatus; usage: PlanUsage }
