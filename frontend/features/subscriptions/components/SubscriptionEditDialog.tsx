'use client';

import { useState, type FormEvent } from 'react';
import { MODULE_KEYS, MODULES, PLAN_CODES, PLANS, resolvePlan, SUBSCRIPTION_STATUSES } from '@oficina/contracts';
import type { BillingCycle, ModuleKey, PlanCode, SubscriptionResponse, SubscriptionStatus } from '@oficina/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { useUpdateSubscription } from '../hooks/use-subscriptions';
import { SUBSCRIPTION_LABELS } from '../subscription-labels';

const selectClass = 'h-10 w-full rounded-button border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export function SubscriptionEditDialog({ subscription, onClose }: { subscription: SubscriptionResponse; onClose: () => void }) {
  const [plan, setPlan] = useState<PlanCode>(resolvePlan(subscription.plan).code);
  const [extraModules, setExtraModules] = useState<ModuleKey[]>(subscription.extraModules ?? []);
  const [status, setStatus] = useState<SubscriptionStatus>(subscription.subscriptionStatus);
  const [amount, setAmount] = useState((subscription.subscriptionAmountCents / 100).toFixed(2).replace('.', ','));
  const [cycle, setCycle] = useState<BillingCycle>(subscription.subscriptionCycle);
  const [dueAt, setDueAt] = useState(subscription.subscriptionDueAt?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(subscription.subscriptionNotes ?? '');
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateSubscription();

  const formatAmount = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
  // Picking a plan fills in its price, unless a negotiated value was typed in.
  function pickPlan(next: PlanCode) {
    const previous = PLANS[plan].monthlyPriceCents;
    if (cycle === 'monthly' && (amount === formatAmount(previous) || Number(amount.replace(',', '.')) === 0)) setAmount(formatAmount(PLANS[next].monthlyPriceCents));
    setPlan(next);
    setExtraModules((current) => current.filter((key) => !PLANS[next].modules.includes(key)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = amount.trim().replace(',', '.');
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized) || Number(normalized) > 1_000_000) {
      setError('Informe um valor entre R$ 0,00 e R$ 1.000.000,00, com até duas casas decimais.');
      return;
    }
    setError(null);
    try {
      await mutation.mutateAsync({ id: subscription.id, input: {
        plan, extraModules, subscriptionStatus: status, subscriptionAmountCents: Math.round(Number(normalized) * 100),
        subscriptionCycle: cycle, subscriptionDueAt: dueAt ? `${dueAt}T12:00:00.000Z` : null,
        subscriptionNotes: notes.trim() || null, expectedUpdatedAt: subscription.updatedAt,
      } });
      toast.success('Assinatura atualizada.');
      onClose();
    } catch (failure) {
      setError(extractErrorMessage(failure, 'Não foi possível salvar a assinatura. Tente novamente.'));
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent onEscapeKeyDown={(event) => { if (mutation.isPending) event.preventDefault(); }} onInteractOutside={(event) => { if (mutation.isPending) event.preventDefault(); }}>
      <DialogHeader>
        <DialogTitle>Gerenciar assinatura</DialogTitle>
        <DialogDescription>{subscription.name} · Atualize as condições comerciais desta oficina.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={mutation.isPending} className="space-y-4 disabled:opacity-60">
          <div className="space-y-1.5"><Label htmlFor="subscription-plan">Plano</Label><select id="subscription-plan" className={selectClass} value={plan} onChange={(event) => pickPlan(event.target.value as PlanCode)}>{PLAN_CODES.map((code) => <option key={code} value={code}>{PLANS[code].name} · {formatCurrencyBRL(PLANS[code].monthlyPriceCents)}/mês</option>)}</select></div>
          <fieldset className="space-y-1.5"><legend className="text-sm font-medium">Módulos vendidos à parte</legend>{MODULE_KEYS.filter((key) => !PLANS[plan].modules.includes(key)).map((key) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={extraModules.includes(key)} onChange={(event) => setExtraModules((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))} />{MODULES[key].label}</label>)}{MODULE_KEYS.every((key) => PLANS[plan].modules.includes(key)) && <p className="text-xs text-text-muted">Este plano já inclui todos os módulos.</p>}</fieldset>
          <div className="space-y-1.5"><Label htmlFor="subscription-status">Situação da assinatura</Label><select id="subscription-status" className={selectClass} value={status} onChange={(event) => setStatus(event.target.value as SubscriptionStatus)}>{SUBSCRIPTION_STATUSES.map((key) => <option key={key} value={key}>{SUBSCRIPTION_LABELS[key].label}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label htmlFor="subscription-amount">Valor por período (R$)</Label><Input id="subscription-amount" required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-describedby="subscription-amount-help" /><p id="subscription-amount-help" className="text-xs text-text-muted">Valor total {cycle === 'yearly' ? 'do ano' : 'do mês'}.</p></div>
            <div className="space-y-1.5"><Label htmlFor="subscription-cycle">Periodicidade</Label><select id="subscription-cycle" className={selectClass} value={cycle} onChange={(event) => setCycle(event.target.value as BillingCycle)}><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="subscription-due">Próximo vencimento</Label><Input id="subscription-due" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="subscription-notes">Observações internas</Label><Textarea id="subscription-notes" maxLength={2000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Condições negociadas, descontos ou observações..." /></div>
        </fieldset>
        <p className="text-xs leading-relaxed text-text-muted">Registro administrativo manual. Salvar não realiza cobranças. O plano e os módulos escolhidos passam a valer na hora para a oficina.</p>
        {error && <p role="alert" className="rounded-button border border-danger/20 bg-danger-subtle p-3 text-sm text-danger-strong">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando...' : 'Salvar alterações'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
