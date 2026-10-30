import Link from 'next/link';
import { Lock } from '@phosphor-icons/react';
import { MODULES, PLANS, type ModuleKey } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { formatCurrencyBRL } from '@/lib/format-currency';

export function ModuleLocked({ module }: { module: ModuleKey }) {
  const info = MODULES[module];
  const plan = PLANS[info.minPlan];
  return <section aria-label={`${info.label} não incluído no plano`} className="mx-auto mt-10 max-w-xl rounded-card border border-border bg-card p-8 text-center shadow-sm">
    <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Lock className="size-6" aria-hidden="true" /></span>
    <h1 className="mt-4 text-xl font-bold">{info.label} não faz parte do seu plano</h1>
    <p className="mt-2 text-sm text-text-muted">{info.description}</p>
    <p className="mt-4 text-sm">Disponível a partir do plano <strong>{plan.name}</strong>, por {formatCurrencyBRL(plan.monthlyPriceCents)} por mês.</p>
    <p className="mt-1 text-xs text-text-muted">Para contratar, fale com o suporte do Ofix. Seus dados continuam guardados.</p>
    <Button asChild variant="outline" size="sm" className="mt-5"><Link href="/configuracoes/assinatura">Ver minha assinatura</Link></Button>
  </section>;
}
