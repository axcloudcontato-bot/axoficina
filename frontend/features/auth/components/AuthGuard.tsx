'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@oficina/contracts';
import { useAuthStore } from '@/stores/auth-store';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  /**
   * Para onde mandar um usuário autenticado mas sem o papel exigido.
   * Default '/usuarios' só faz sentido porque hoje essa é a única página
   * usando `allowedRoles` — se uma página futura com papéis diferentes
   * (ex: /customers) usar este guard, passe um destino explícito para não
   * arriscar redirecionar para outra página que também bloqueie o papel.
   */
  redirectOnForbiddenTo?: string;
}

// Substitui o `middleware.ts` do Next.js do plano original: tokens vivem em
// localStorage (via zustand persist), e o Edge Middleware do Next.js não
// tem acesso a localStorage (só a cookies/headers) — então a proteção de
// rota tem que ser um guard client-side, não um middleware de verdade.
export function AuthGuard({ children, allowedRoles, redirectOnForbiddenTo = '/usuarios' }: AuthGuardProps) {
  const router = useRouter();
  // Nunca ler `.persist.hasHydrated()` no initializer do useState — isso
  // roda durante o SSR do Next.js, onde localStorage/`persist` ainda não
  // existe. Só é seguro acessar dentro de useEffect (client-only).
  const [hasHydrated, setHasHydrated] = useState(false);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    setHasHydrated(useAuthStore.persist.hasHydrated());
    return useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));
  }, []);

  const isForbidden = Boolean(allowedRoles && user && !allowedRoles.includes(user.role));

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }
    if (!accessToken) {
      router.replace('/entrar');
      return;
    }
    if (isForbidden) {
      router.replace(redirectOnForbiddenTo);
    }
  }, [hasHydrated, accessToken, isForbidden, redirectOnForbiddenTo, router]);

  if (!hasHydrated || !accessToken) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-text-muted">Carregando...</div>;
  }

  if (isForbidden) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-text-muted">
        Você não tem permissão para acessar esta página.
      </div>
    );
  }

  return <>{children}</>;
}
