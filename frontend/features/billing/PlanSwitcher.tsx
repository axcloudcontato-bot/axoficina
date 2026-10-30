'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { MODULES, PLAN_CODES, PLANS, planPriceCents, resolvePlan, YEARLY_MONTHS_CHARGED, type BillingCycle, type PlanCode } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { useWorkshopSubscription } from '@/features/settings/hooks/use-settings';
import { useBillingStatus, useCancelSubscription, useCheckout, usePaymentPortal } from './use-billing';

const isStripePage = (value: string) => { try { const url = new URL(value); return url.protocol === 'https:' && /(^|\.)stripe\.com$/.test(url.hostname); } catch { return false; } };

// Choose or change the plan. A new subscription goes to the payment page; a change on a paid one adjusts the next charges.
export function PlanSwitcher() {
  const billing = useBillingStatus();
  const subscription = useWorkshopSubscription();
  const checkout = useCheckout();
  const cancel = useCancelSubscription();
  const portal = usePaymentPortal();
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const current = resolvePlan(subscription.data?.plan).code;
  const busy = checkout.isPending || cancel.isPending || portal.isPending;

  async function choose(plan: PlanCode) {
    const name = PLANS[plan].name;
    if (billing.data?.hasSubscription && !window.confirm(`Mudar para o plano ${name}? ${PLANS[plan].monthlyPriceCents > PLANS[current].monthlyPriceCents ? 'O novo plano vale agora e as próximas cobranças usam o novo valor.' : 'O plano atual segue até o próximo pagamento e depois muda para o novo.'}`)) return;
    try {
      const result = await checkout.mutateAsync({ plan, cycle });
      if (result.checkoutUrl && isStripePage(result.checkoutUrl)) { window.location.assign(result.checkoutUrl); return; }
      toast.success(result.appliedNow ? `Plano ${name} ativado.` : `Plano ${name} agendado para o próximo pagamento.`);
    } catch (error) { toast.error(extractErrorMessage(error, 'Não foi possível contratar agora.')); }
  }

  async function openPortal() {
    try {
      const { url } = await portal.mutateAsync(undefined);
      if (isStripePage(url)) window.location.assign(url);
    } catch (error) { toast.error(extractErrorMessage(error, 'Não foi possível abrir a página de pagamento.')); }
  }

  async function stop() {
    if (!window.confirm('Cancelar a assinatura? O sistema continua funcionando até o fim do período já pago e depois fica só para consulta. Seus dados continuam guardados.')) return;
    try { await cancel.mutateAsync(undefined); toast.success('Assinatura cancelada.'); } catch (error) { toast.error(extractErrorMessage(error, 'Não foi possível cancelar agora.')); }
  }

  if (billing.isLoading || subscription.isLoading) return <div role="status" className="h-40 animate-pulse rounded-card bg-muted" />;
  if (billing.isError) return <section aria-label="Planos" className="rounded-card border border-border bg-card p-5 shadow-sm"><p role="alert" className="text-sm text-danger">Não foi possível carregar os planos. <button className="underline" onClick={() => billing.refetch()}>Tentar novamente</button></p></section>;

  return <section aria-label="Planos" className="rounded-card border border-border bg-card p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-bold">Planos</h2>
      <div role="group" aria-label="Periodicidade" className="inline-flex rounded-button border border-border p-0.5 text-sm font-semibold">
        {(['monthly', 'yearly'] as const).map((option) => <button key={option} type="button" aria-pressed={cycle === option} onClick={() => setCycle(option)} className={`rounded-button px-3 py-1 ${cycle === option ? 'bg-primary text-primary-foreground' : 'text-text-muted'}`}>{option === 'monthly' ? 'Mensal' : `Anual (${12 - YEARLY_MONTHS_CHARGED} meses grátis)`}</button>)}
      </div>
    </div>
    {billing.data?.pendingPlan && <p role="status" className="mt-3 rounded-button bg-selection p-3 text-sm">Troca para o plano {PLANS[billing.data.pendingPlan].name} agendada para o próximo pagamento.</p>}
    <ul className="mt-4 grid gap-3 md:grid-cols-3">{PLAN_CODES.map((code) => {
      const plan = PLANS[code];
      const isCurrent = code === current && (subscription.data?.cycle ?? 'monthly') === cycle && subscription.data?.status !== 'canceled';
      return <li key={code} className={`flex flex-col rounded-card border p-4 ${code === current ? 'border-primary' : 'border-border'}`}>
        <h3 className="font-bold">{plan.name}{code === current && <span className="ml-2 text-xs font-semibold text-primary">seu plano</span>}</h3>
        <p className="mt-1 text-2xl font-bold">{formatCurrencyBRL(planPriceCents(code, cycle))}<span className="text-xs font-normal text-text-muted"> por {cycle === 'monthly' ? 'mês' : 'ano'}</span></p>
        <p className="mt-2 text-xs text-text-muted">{plan.tagline}</p>
        <ul className="mt-3 flex-1 space-y-1 text-xs"><li>{plan.limits.users ?? 'Usuários sem limite'}{plan.limits.users ? ' usuários' : ''}</li><li>{plan.limits.ordersPerMonth ? `${plan.limits.ordersPerMonth} OS por mês` : 'OS sem limite'}</li>{plan.modules.map((key) => <li key={key}>✓ {MODULES[key].label}</li>)}</ul>
        {billing.data?.enabled && <Button className="mt-4" size="sm" variant={isCurrent ? 'outline' : 'default'} disabled={busy || isCurrent} onClick={() => choose(code)}>{isCurrent ? 'Plano atual' : billing.data.hasSubscription ? `Mudar para ${plan.name}` : `Contratar ${plan.name}`}</Button>}
      </li>;
    })}</ul>
    {!billing.data?.enabled && <p className="mt-4 text-sm text-text-muted">Para contratar ou trocar de plano, fale com o suporte do Ofix.</p>}
    {billing.data?.enabled && billing.data.hasCustomer && <p className="mt-4 text-xs text-text-muted">O pagamento é feito na página segura do Stripe. <button type="button" className="font-semibold underline" disabled={busy} onClick={openPortal}>Forma de pagamento e recibos</button>{billing.data.hasSubscription && <> · <button type="button" className="font-semibold underline" disabled={busy} onClick={stop}>Cancelar assinatura</button></>}</p>}
  </section>;
}
