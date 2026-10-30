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
