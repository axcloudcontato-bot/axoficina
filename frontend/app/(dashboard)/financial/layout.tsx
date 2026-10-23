'use client';

import { ShieldWarning } from '@phosphor-icons/react';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';

export default function FinancialLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (!hasPermission(user, 'finance.view')) return <div className="rounded-card border border-border bg-card p-10 text-center"><ShieldWarning className="mx-auto size-8 text-text-muted" /><h2 className="mt-3 font-bold text-text">Acesso restrito</h2><p className="mt-1 text-sm text-text-muted">Seu perfil não possui acesso às informações financeiras.</p></div>;
  return children;
}
