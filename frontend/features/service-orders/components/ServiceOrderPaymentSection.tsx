'use client';

import { useEffect, useState } from 'react';
import { useOrderDefaults } from '@/features/settings/hooks/use-settings';
import type { PaymentMethod, ServiceOrderResponse } from '@oficina/contracts';
import { Money, CheckCircle, Clock, ArrowCounterClockwise } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { parseMoneyToCents } from '@/lib/parse-money';
import { extractErrorMessage } from '@/lib/api/client';
import { useConfigureServiceOrderPayment, useConfirmServiceOrderInstallment, useConfirmServiceOrderReceipt, useDeleteServiceOrderReceipt } from '../hooks/use-service-orders';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: 'PIX', CASH: 'Dinheiro', DEBIT_CARD: 'Cartão de débito', CREDIT_CARD: 'Cartão de crédito',
  BANK_TRANSFER: 'Transferência bancária', BOLETO: 'Boleto', OTHER: 'Outro',
};
const METHODS = Object.entries(METHOD_LABELS) as Array<[PaymentMethod, string]>;
const CREDIT_INSTALLMENTS = Array.from({ length: 24 }, (_, index) => index + 1);

export function ServiceOrderPaymentSection({ serviceOrder }: { serviceOrder: ServiceOrderResponse }) {
  const configure = useConfigureServiceOrderPayment();
  const confirmInstallment = useConfirmServiceOrderInstallment(serviceOrder.id);
  const confirm = useConfirmServiceOrderReceipt();
  const reverse = useDeleteServiceOrderReceipt(serviceOrder.id);
  const accepted = useOrderDefaults().acceptedPaymentMethods;
  const offeredMethods = METHODS.filter(([value]) => !accepted.length || accepted.includes(value) || value === serviceOrder.paymentMethod);
  const [plannedMethod, setPlannedMethod] = useState<PaymentMethod | ''>(serviceOrder.paymentMethod ?? '');
  const [paymentInstallments, setPaymentInstallments] = useState(String(serviceOrder.paymentInstallments ?? 1));
  const [anticipated, setAnticipated] = useState(serviceOrder.paymentAnticipated ?? false);
  const [firstDueAt, setFirstDueAt] = useState(serviceOrder.paymentFirstDueAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod | ''>(serviceOrder.paymentMethod ?? '');
  const [amount, setAmount] = useState((serviceOrder.outstandingAmountCents / 100).toFixed(2));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setPlannedMethod(serviceOrder.paymentMethod ?? '');
    setPaymentInstallments(String(serviceOrder.paymentInstallments ?? 1));
    setAnticipated(serviceOrder.paymentAnticipated ?? false);
    setFirstDueAt(serviceOrder.paymentFirstDueAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setMethod(serviceOrder.paymentMethod ?? '');
    setAmount((serviceOrder.outstandingAmountCents / 100).toFixed(2));
  }, [serviceOrder.paymentMethod, serviceOrder.paymentInstallments, serviceOrder.paymentAnticipated, serviceOrder.paymentFirstDueAt, serviceOrder.outstandingAmountCents]);

  function saveMethod() {
    if (!plannedMethod) return toast.error('Selecione a forma de pagamento combinada.');
    const installments = Number(paymentInstallments);
    if (plannedMethod === 'CREDIT_CARD' && (!Number.isInteger(installments) || installments < 1 || installments > 24)) {
      return toast.error('Selecione a quantidade de parcelas.');
    }
    if (!anticipated && !firstDueAt) return toast.error('Informe a data da primeira parcela.');
    configure.mutate({
      serviceOrderId: serviceOrder.id,
      method: plannedMethod,
      installments: plannedMethod === 'CREDIT_CARD' ? installments : 1,
      anticipated,
      firstDueAt: anticipated ? undefined : new Date(`${firstDueAt}T12:00:00`).toISOString(),
    }, {
      onSuccess: () => toast.success(anticipated ? 'Recebimento integral lançado no caixa.' : 'Parcelas geradas com sucesso.'),
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }
  function confirmReceipt() {
    const amountCents = parseMoneyToCents(amount);
    if (!method || !Number.isFinite(amountCents) || amountCents <= 0) return toast.error('Informe método e valor recebidos.');
    confirm.mutate({ serviceOrderId: serviceOrder.id, method, amountCents, notes: notes.trim() || undefined }, {
      onSuccess: () => { toast.success('Recebimento confirmado e lançado no caixa.'); setNotes(''); },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  const status = serviceOrder.paymentStatus === 'PAID'
    ? { label: 'Recebido', icon: CheckCircle, tone: 'text-success bg-success-subtle' }
    : serviceOrder.paymentStatus === 'PARTIALLY_PAID'
      ? { label: 'Recebido parcialmente', icon: Clock, tone: 'text-warning bg-warning-subtle' }
      : { label: 'Aguardando recebimento', icon: Clock, tone: 'text-warning bg-warning-subtle' };
  const StatusIcon = status.icon;
  const installmentPreview = plannedMethod === 'CREDIT_CARD'
    ? calculateInstallments(serviceOrder.totalAmountCents, Number(paymentInstallments))
    : null;

  return <section className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-text">Pagamento e recebimento</h3><p className="mt-1 text-sm text-text-muted">O valor só entra no caixa depois da confirmação abaixo.</p></div><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${status.tone}`}><StatusIcon className="size-4" />{status.label}</span></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><Amount label="Total da OS" value={serviceOrder.totalAmountCents} /><Amount label="Já recebido" value={serviceOrder.receivedAmountCents} positive /><Amount label="Saldo pendente" value={serviceOrder.outstandingAmountCents} warning={serviceOrder.outstandingAmountCents > 0} /></div>

    <details open={!serviceOrder.paymentMethod && serviceOrder.outstandingAmountCents > 0 || undefined} className="mt-5 rounded-button border border-border p-4">
      <summary className="cursor-pointer text-sm font-semibold text-text">{serviceOrder.paymentMethod ? 'Consultar ou ajustar a condição de pagamento' : '1. Combinar a forma de pagamento'}</summary>
      <p className="mt-2 text-xs text-text-muted">Registrar a condição cria as parcelas a receber. A entrada no caixa exige a confirmação do recebimento.</p>
      <div className={`mt-4 grid gap-3 ${plannedMethod === 'CREDIT_CARD' ? 'sm:grid-cols-2' : ''}`}>
        <div><Label>Forma de pagamento combinada</Label><Select value={plannedMethod} onValueChange={(value) => setPlannedMethod(value as PaymentMethod)}><SelectTrigger className="mt-2"><SelectValue placeholder="Selecione a forma combinada" /></SelectTrigger><SelectContent>{offeredMethods.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        {plannedMethod === 'CREDIT_CARD' && <div><Label>Quantidade de parcelas</Label><Select value={paymentInstallments} onValueChange={setPaymentInstallments}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent>{CREDIT_INSTALLMENTS.map((installment) => <SelectItem key={installment} value={String(installment)}>{installment}x</SelectItem>)}</SelectContent></Select></div>}
      </div>
      {installmentPreview && <div className="mt-3 rounded-button border border-primary/20 bg-selection/20 px-4 py-3">
        <p className="text-sm font-bold text-text">{installmentPreview.count}x de {formatCurrencyBRL(installmentPreview.regularAmountCents)}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          Total de {formatCurrencyBRL(serviceOrder.totalAmountCents)}
          {installmentPreview.lastAmountCents !== installmentPreview.regularAmountCents && ` · última parcela de ${formatCurrencyBRL(installmentPreview.lastAmountCents)}`}
        </p>
      </div>}
      {plannedMethod && <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="flex cursor-pointer items-start gap-3 rounded-button border border-border p-3">
          <input className="mt-1 size-4 accent-primary" type="checkbox" checked={anticipated} onChange={(event) => setAnticipated(event.target.checked)} />
          <span><span className="block text-sm font-bold text-text">Já recebi o valor integral</span><span className="mt-0.5 block text-xs text-text-muted">Marque somente após receber. Ao confirmar abaixo, o total será lançado no caixa.</span></span>
        </label>
        {!anticipated && <div><Label>Vencimento da primeira parcela</Label><Input className="mt-2" type="date" value={firstDueAt} onChange={(event) => setFirstDueAt(event.target.value)} /></div>}
      </div>}
      <div className="mt-4 flex justify-end"><Button variant="outline" onClick={saveMethod} disabled={configure.isPending}>{configure.isPending ? 'Registrando...' : anticipated ? 'Confirmar recebimento integral' : 'Registrar condição e parcelas'}</Button></div>
      {serviceOrder.paymentMethod === 'CREDIT_CARD' && serviceOrder.paymentInstallments && <p className="mt-3 text-xs font-semibold text-text-muted">Condição salva: cartão de crédito em {serviceOrder.paymentInstallments}x.</p>}
    </details>

    {(serviceOrder.installments?.length ?? 0) > 0 && <div className="mt-4 rounded-button border border-border p-4"><h4 className="font-bold text-text">Cronograma de recebimento</h4><div className="mt-3 divide-y divide-border">{serviceOrder.installments?.map((installment) => <div key={installment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold text-text">Parcela {installment.installmentNumber}/{installment.installmentCount} · {formatCurrencyBRL(installment.amountCents)}</p><p className="mt-0.5 text-xs text-text-muted">Vencimento: {new Date(installment.dueAt).toLocaleDateString('pt-BR')}</p></div>{installment.status === 'PAID' ? <span className="rounded-full bg-success-subtle px-3 py-1 text-xs font-bold text-success">Recebida</span> : <Button size="sm" onClick={() => confirmInstallment.mutate({ id: installment.id }, { onSuccess: () => toast.success('Parcela confirmada e lançada no caixa.'), onError: (error) => toast.error(extractErrorMessage(error)) })} disabled={confirmInstallment.isPending}>Confirmar recebimento</Button>}</div>)}</div></div>}

    {serviceOrder.outstandingAmountCents > 0 && !(serviceOrder.installments?.length) && <div className="mt-4 rounded-button border border-primary/25 bg-selection/20 p-4"><div className="flex items-center gap-2"><Money className="size-5 text-primary" /><h4 className="font-bold text-text">Confirmar recebimento</h4></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label>Método recebido</Label><Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}><SelectTrigger className="mt-2"><SelectValue placeholder="Método" /></SelectTrigger><SelectContent>{METHODS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Label>Valor recebido</Label><Input className="mt-2" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><div className="sm:col-span-2"><Label>Observação</Label><Textarea className="mt-2 min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: PIX identificado..." /></div></div><div className="mt-4 flex justify-end"><Button onClick={confirmReceipt} disabled={confirm.isPending || !serviceOrder.paymentMethod}>{confirm.isPending ? 'Confirmando...' : 'Confirmar entrada no caixa'}</Button></div>{!serviceOrder.paymentMethod && <p className="mt-2 text-right text-xs text-warning">Salve primeiro a forma combinada.</p>}</div>}

    {(serviceOrder.receipts?.length ?? 0) > 0 && <div className="mt-5"><h4 className="text-sm font-bold text-text">Recebimentos confirmados</h4><div className="mt-2 divide-y divide-border rounded-button border border-border">{serviceOrder.receipts?.map((receipt) => <div key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-semibold text-text">{METHOD_LABELS[receipt.method]} · {formatCurrencyBRL(receipt.amountCents)}</p><p className="text-xs text-text-muted">{new Date(receipt.receivedAt).toLocaleString('pt-BR')}{receipt.notes ? ` · ${receipt.notes}` : ''}</p></div><Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => window.confirm('Estornar este recebimento do caixa?') && reverse.mutate({ id: receipt.id })}><ArrowCounterClockwise className="size-4" />Estornar</Button></div>)}</div></div>}
  </section>;
}

function Amount({ label, value, positive, warning }: { label: string; value: number; positive?: boolean; warning?: boolean }) { return <div className="rounded-button bg-muted/50 p-3"><p className="text-xs font-bold uppercase text-text-muted">{label}</p><p className={`mt-1 text-lg font-bold ${positive ? 'text-success' : warning ? 'text-warning' : 'text-text'}`}>{formatCurrencyBRL(value)}</p></div>; }

function calculateInstallments(totalCents: number, count: number) {
  if (!Number.isInteger(count) || count < 1) return null;
  const regularAmountCents = Math.floor(totalCents / count);
  return {
    count,
    regularAmountCents,
    lastAmountCents: totalCents - regularAmountCents * (count - 1),
  };
}
