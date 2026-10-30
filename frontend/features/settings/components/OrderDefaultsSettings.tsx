'use client';

import { useEffect, useId, useState } from 'react';
import { FloppyDisk, Receipt } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { PAYMENT_METHODS, type PaymentMethod } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { parseMoneyToCents } from '@/lib/parse-money';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { useBranding, useLaborRate, useMaintenanceAlertMonths, useOrderDefaults, useUpdateLaborRate, useUpdateMaintenanceAlertMonths, useUpdateOrderDefaults } from '../hooks/use-settings';
import { useUnsavedSettings } from '../hooks/use-unsaved-settings';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: 'PIX', CASH: 'Dinheiro', DEBIT_CARD: 'Cartão de débito', CREDIT_CARD: 'Cartão de crédito',
  BANK_TRANSFER: 'Transferência', BOLETO: 'Boleto', OTHER: 'Outro',
};
const toText = (value: number | null) => value == null ? '' : String(value);
const toNumber = (value: string) => value.trim() === '' ? null : Number(value);

// What every new order and printed document starts with, plus the reference values that used to live in other screens.
export function OrderDefaultsSettings() {
  const branding = useBranding();
  const saved = useOrderDefaults();
  const update = useUpdateOrderDefaults();
  const user = useAuthStore((state) => state.user);
  const canManage = hasPermission(user, 'settings.manage');
  const id = useId();
  const [warranty, setWarranty] = useState('');
  const [validity, setValidity] = useState('');
  const [terms, setTerms] = useState('');
  const [methods, setMethods] = useState<string[]>([]);
  const savedKey = JSON.stringify(saved);
  useEffect(() => { setWarranty(toText(saved.defaultWarrantyDays)); setValidity(toText(saved.quoteValidityDays)); setTerms(saved.documentTerms ?? ''); setMethods(saved.acceptedPaymentMethods); }, [savedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = toNumber(warranty) !== saved.defaultWarrantyDays || toNumber(validity) !== saved.quoteValidityDays || (terms.trim() || null) !== saved.documentTerms || [...methods].sort().join() !== [...saved.acceptedPaymentMethods].sort().join();
  useUnsavedSettings(dirty && !update.isPending);
  const warrantyValue = toNumber(warranty), validityValue = toNumber(validity);
  const problem = warrantyValue != null && (!Number.isInteger(warrantyValue) || warrantyValue < 0 || warrantyValue > 3650) ? 'A garantia deve ter de 0 a 3650 dias.'
    : validityValue != null && (!Number.isInteger(validityValue) || validityValue < 1 || validityValue > 365) ? 'A validade do orçamento deve ter de 1 a 365 dias.'
    : null;

  function save() {
    if (!canManage || problem) return;
    update.mutate({ defaultWarrantyDays: warrantyValue, quoteValidityDays: validityValue, documentTerms: terms.trim() || null, acceptedPaymentMethods: methods }, {
      onSuccess: () => toast.success('Padrões da OS atualizados.'),
      onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível salvar os padrões.')),
    });
  }

  if (branding.isPending) return <div role="status" className="h-48 animate-pulse rounded-card bg-muted" />;
  return <div className="space-y-6">
    <fieldset disabled={!canManage || update.isPending} className="rounded-card border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-button bg-primary/10 text-primary"><Receipt className="size-5" aria-hidden="true" /></span><div><h3 className="text-lg font-bold">Padrões da ordem de serviço</h3><p className="mt-1 text-sm text-text-muted">O que toda OS nova já traz e o que sai impresso no orçamento e na OS.</p></div></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 text-sm font-semibold"><label htmlFor={`${id}-warranty`} className="block">Garantia padrão (dias)</label><Input id={`${id}-warranty`} aria-describedby={`${id}-warranty-hint`} type="number" min={0} max={3650} inputMode="numeric" placeholder="Ex.: 90" value={warranty} onChange={(event) => setWarranty(event.target.value)} /><span id={`${id}-warranty-hint`} className="block text-xs font-normal text-text-muted">Já vem preenchida em cada OS nova; dá para mudar na própria OS.</span></div>
        <div className="space-y-1.5 text-sm font-semibold"><label htmlFor={`${id}-validity`} className="block">Validade do orçamento (dias)</label><Input id={`${id}-validity`} aria-describedby={`${id}-validity-hint`} type="number" min={1} max={365} inputMode="numeric" placeholder="Ex.: 7" value={validity} onChange={(event) => setValidity(event.target.value)} /><span id={`${id}-validity-hint`} className="block text-xs font-normal text-text-muted">Aparece no orçamento impresso e no PDF, com a data final.</span></div>
      </div>
      <div className="mt-4 space-y-1.5 text-sm font-semibold"><label htmlFor={`${id}-terms`} className="block">Termos e condições</label><Textarea id={`${id}-terms`} aria-describedby={`${id}-terms-hint`} maxLength={2000} rows={4} value={terms} onChange={(event) => setTerms(event.target.value)} placeholder="Ex.: Peças substituídas ficam à disposição do cliente por 30 dias. Veículos não retirados em até 5 dias após o aviso pagam estadia." /><span id={`${id}-terms-hint`} className="block text-xs font-normal text-text-muted">Sai no orçamento em PDF e na OS impressa. {terms.length}/2000</span></div>
      <fieldset className="mt-4"><legend className="mb-1.5 text-sm font-semibold">Formas de pagamento aceitas</legend><div className="flex flex-wrap gap-1.5">{PAYMENT_METHODS.map((method) => <label key={method} className={`cursor-pointer rounded-button border px-3 py-2 text-sm font-semibold ${methods.includes(method) ? 'border-primary/40 bg-selection text-primary' : 'border-border text-text-muted'}`}><input type="checkbox" className="sr-only" checked={methods.includes(method)} onChange={() => setMethods((current) => current.includes(method) ? current.filter((value) => value !== method) : [...current, method])} />{METHOD_LABELS[method]}</label>)}</div><p className="mt-1.5 text-xs text-text-muted">{methods.length ? 'Só estas aparecem ao combinar o pagamento na OS.' : 'Nenhuma marcada: todas aparecem na OS.'}</p></fieldset>
      {problem && <p role="alert" className="mt-3 text-sm text-danger">{problem}</p>}
      {!canManage && <p className="mt-3 text-sm text-text-muted">Seu perfil permite consultar estes padrões, mas não alterá-los.</p>}
      {canManage && <div className="mt-4 flex justify-end"><Button onClick={save} disabled={!dirty || Boolean(problem) || update.isPending}><FloppyDisk className="size-4" />{update.isPending ? 'Salvando...' : 'Salvar padrões'}</Button></div>}
    </fieldset>
    <ReferenceValues />
  </div>;
}

// Values that used to be scattered: the labor hour (Catalog) and the maintenance alert period (Alerts).
function ReferenceValues() {
  const user = useAuthStore((state) => state.user);
  const canPrices = hasPermission(user, 'service_orders.prices');
  const canManage = hasPermission(user, 'settings.manage');
  const laborRate = useLaborRate();
  const months = useMaintenanceAlertMonths();
  const saveRate = useUpdateLaborRate();
  const saveMonths = useUpdateMaintenanceAlertMonths();
  const [rate, setRate] = useState('');
  const [alertMonths, setAlertMonths] = useState('');
  useEffect(() => setRate(laborRate == null ? '' : (laborRate / 100).toFixed(2).replace('.', ',')), [laborRate]);
  useEffect(() => setAlertMonths(String(months)), [months]);
  if (!canPrices && !canManage) return null;
  const rateCents = rate.trim() === '' ? null : parseMoneyToCents(rate);
  const monthsValue = Number(alertMonths);
  return <section className="rounded-card border border-border bg-card p-5 shadow-sm">
    <h3 className="text-lg font-bold">Valores de referência</h3>
    <p className="mt-1 text-sm text-text-muted">Usados no catálogo, na produtividade e nos alertas de manutenção.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {canPrices && <div className="space-y-1.5 text-sm font-semibold"><label htmlFor="labor-rate" className="block">Valor da hora da oficina</label><div className="flex gap-2"><Input id="labor-rate" inputMode="decimal" placeholder="Ex.: 150,00" value={rate} onChange={(event) => setRate(event.target.value)} /><Button variant="outline" disabled={saveRate.isPending || Number.isNaN(rateCents) || rateCents === laborRate} onClick={() => saveRate.mutate({ laborRateCents: rateCents }, { onSuccess: () => toast.success(rateCents == null ? 'Valor da hora removido.' : `Valor da hora: ${formatCurrencyBRL(rateCents)}.`), onError: (error) => toast.error(extractErrorMessage(error)) })}>Salvar</Button></div><span className="block text-xs font-normal text-text-muted">Base dos serviços cobrados por hora e do valor por hora na Produtividade.</span></div>}
      {canManage && <div className="space-y-1.5 text-sm font-semibold"><label htmlFor="alert-months" className="block">Alerta de manutenção depois de (meses)</label><div className="flex gap-2"><Input id="alert-months" type="number" min={1} max={36} inputMode="numeric" value={alertMonths} onChange={(event) => setAlertMonths(event.target.value)} /><Button variant="outline" disabled={saveMonths.isPending || !Number.isInteger(monthsValue) || monthsValue < 1 || monthsValue > 36 || monthsValue === months} onClick={() => saveMonths.mutate({ months: monthsValue }, { onSuccess: () => toast.success('Prazo dos alertas atualizado.'), onError: (error) => toast.error(extractErrorMessage(error)) })}>Salvar</Button></div><span className="block text-xs font-normal text-text-muted">Tempo sem voltar à oficina até o veículo entrar em Alertas de manutenção.</span></div>}
    </div>
  </section>;
}
