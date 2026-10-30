import { useQuery } from '@tanstack/react-query';
import type { ModuleKey } from '@oficina/contracts';
import { useAuthStore } from '@/stores/auth-store';
import { planApi } from './plan-api';

// Which routes belong to a module sold separately. Routes outside this list are part of every plan.
const MODULE_ROUTES: ReadonlyArray<readonly [string, ModuleKey]> = [
  ['/financeiro', 'financeiro'],
  ['/produtividade', 'produtividade'],
  ['/alertas-de-manutencao', 'cuidado'],
  ['/relacionamento', 'cuidado'],
  ['/configuracoes/whatsapp', 'whatsapp'],
  ['/configuracoes/historico', 'governanca'],
];

export function moduleForPath(pathname: string | null): ModuleKey | null {
  if (!pathname) return null;
  return MODULE_ROUTES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? null;
}

export function useEntitlements() {
  const signedIn = useAuthStore((state) => Boolean(state.accessToken));
  const query = useQuery({ queryKey: ['plan'], queryFn: planApi.current, enabled: signedIn, staleTime: 60_000 });
  // While the answer is not here (or failed) nothing is locked: the server refuses what the plan does not include anyway.
  const hasModule = (module: ModuleKey | undefined) => !module || !query.data || query.data.modules.includes(module);
  return { ...query, hasModule };
}
