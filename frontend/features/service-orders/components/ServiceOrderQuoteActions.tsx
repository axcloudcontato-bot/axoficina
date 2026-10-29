'use client';

import { FileArrowDown, Envelope, ChatCircle, CheckCircle, Clock, WarningCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreatedCustomerMessageResponse, ServiceOrderResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCustomer } from '@/features/customers/hooks/use-customers';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { generateQuotePdf } from '../quote-pdf';
import { extractErrorMessage } from '@/lib/api/client';
import { customerMessagesApi } from '../api/customer-messages-api';
import { CustomerMessageComposer, type CustomerMessageDraft } from './CustomerMessageComposer';
import { CustomerMessageHistory } from './CustomerMessageHistory';
import { CUSTOMER_MESSAGE_PRESETS, validateCustomerMessage } from '../customer-message-presets';
import { quoteApprovalState } from '../service-order-workflow';
import { useCustomerMessages } from '../hooks/use-customer-messages';
import { useTransitionServiceOrder } from '../hooks/use-service-orders';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { useBranding } from '@/features/settings/hooks/use-settings';

const APPROVAL_COPY = {
  legacy: ['Consulte a resposta anterior', 'Esta mensagem foi enviada no fluxo anterior. Confira a resposta no histórico e os valores atuais antes de iniciar.'],
  'not-sent': ['Prepare a aprovação', 'Confira o orçamento e escolha como enviá-lo ao cliente.'],
  waiting: ['Aguardando o cliente', 'A resposta aparecerá aqui e no sino de notificações.'],
  prepared: ['Conclua o envio no WhatsApp', 'A mensagem foi preparada. Depois de enviá-la na conversa, confirme abaixo.'],
  uncertain: ['Confira o envio na conversa', 'O sistema não confirmou a entrega da mensagem. Confira o WhatsApp antes de enviar novamente.'],
  approved: ['Orçamento aprovado', 'O cliente autorizou esta versão do orçamento.'],
  declined: ['Orçamento não aprovado', 'Converse com o cliente ou revise os itens e envie uma nova solicitação.'],
  contact: ['O cliente quer conversar', 'Combine os ajustes com o cliente antes de iniciar o serviço.'],
  changed: ['O orçamento mudou', 'A resposta anterior se refere a outra versão. Confira os novos valores e solicite a aprovação novamente.'],
  expired: ['Solicitação expirada', 'Envie uma nova solicitação para o cliente responder.'],
};

export function ServiceOrderQuoteActions({ serviceOrder, beforeSend, entryReady = true, onGoToEntry, onGoToQuote, onStart, onCancelOrder }: {
  serviceOrder: ServiceOrderResponse; beforeSend?: () => Promise<boolean>; entryReady?: boolean;
  onGoToEntry?: () => void; onGoToQuote?: () => void; onStart?: (manual: boolean) => void; onCancelOrder?: () => void;
}) {
  const customer = useCustomer(serviceOrder.customerId);
  const history = useCustomerMessages(serviceOrder.id);
  const repairStatus = useTransitionServiceOrder();
  const client = useQueryClient();
  const branding = useBranding();
  const whatsappIntegrated = branding.data?.whatsappEnabled ?? false;
  const user = useAuthStore(state => state.user);
  const terminal = ['DELIVERED', 'CANCELLED'].includes(serviceOrder.status);
  const canSend = hasPermission(user, 'service_orders.manage') && !terminal;
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState<CreatedCustomerMessageResponse | null>(null);
  const [custom, setCustom] = useState<CustomerMessageDraft>({ enabled: true, preset: 'CUSTOM', question: '', options: ['Sim', 'Não'], includeQuote: false });
  const approval = quoteApprovalState(history.data?.messages ?? [], Date.now(), serviceOrder);
  const [title, description] = APPROVAL_COPY[approval.state];
  const hasItems = Boolean(serviceOrder.items?.length);
  const hasEmail = Boolean(customer.data?.customer.email?.trim());
  const ready = hasItems && (serviceOrder.status !== 'OPEN' || entryReady);
  const canStart = onStart && ['OPEN', 'AWAITING_APPROVAL'].includes(serviceOrder.status) && canSend;
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ['customer-messages', serviceOrder.id] }),
    client.invalidateQueries({ queryKey: ['service-order', serviceOrder.id] }),
    client.invalidateQueries({ queryKey: ['service-orders-list'] }),
  ]);

  async function send(quote: boolean) {
    if (!canSend || busy) return;
    if (quote && !ready) return;
    if (!quote) { const error = validateCustomerMessage(custom.question, custom.options); if (error) return toast.warning(error); }
    if (channel === 'EMAIL' && !hasEmail) return toast.warning('Cadastre o e-mail do cliente antes de enviar.');
    // Keep the browser gesture for the non-integrated WhatsApp handoff.
    const popup = channel === 'WHATSAPP' && !whatsappIntegrated ? window.open('about:blank', '_blank') : null;
    if (popup) popup.opener = null;
    setBusy(true);
    try {
      if (beforeSend && !await beforeSend()) { popup?.close(); return; }
      const result = await customerMessagesApi.create({ serviceOrderId: serviceOrder.id, channel,
        purpose: quote ? 'QUOTE' : custom.preset, expectedQuoteRevision: quote ? serviceOrder.quoteRevision : undefined,
        question: quote ? CUSTOMER_MESSAGE_PRESETS.QUOTE.question : custom.question.trim(),
        options: quote ? [...CUSTOMER_MESSAGE_PRESETS.QUOTE.options] : custom.options.map(option => option.trim()),
        includeQuote: quote || custom.includeQuote });
      setPrepared(result.whatsappUrl ? result : null);
      if (result.whatsappUrl && popup) popup.location.href = result.whatsappUrl;
      else popup?.close();
      if (result.workflowWarning) toast.warning(result.workflowWarning);
      else toast.success(result.sent ? 'Mensagem enviada. Acompanhe a resposta nesta etapa.' : 'Mensagem preparada. Conclua o envio na conversa do WhatsApp.');
      setOpen(false);
    } catch (error) { popup?.close(); toast.error(extractErrorMessage(error, 'Não foi possível concluir o envio. Confira o histórico antes de tentar novamente.')); }
    finally { setBusy(false); await refresh(); }
  }

  async function confirmManualDispatch() {
    const id = prepared?.messageId ?? approval.latest?.id;
    if (!id || busy) return;
    setBusy(true);
    try { const result = await customerMessagesApi.confirmDispatch(id); if (result.workflowWarning) toast.warning(result.workflowWarning); else toast.success('Envio confirmado. Aguardando resposta do cliente.'); setPrepared(null); }
    catch (error) { toast.error(extractErrorMessage(error)); }
    finally { setBusy(false); await refresh(); }
  }

  async function downloadPdf() {
    try { await generateQuotePdf(serviceOrder); toast.success('PDF do orçamento gerado.'); }
    catch { toast.error('Não foi possível gerar o PDF.'); }
  }

  return <section aria-labelledby="approval-title" className="space-y-4">
    <div className="rounded-card border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-button ${approval.state === 'approved' ? 'bg-success-subtle text-success' : ['changed', 'declined', 'uncertain', 'contact', 'expired'].includes(approval.state) ? 'bg-warning-subtle text-warning' : 'bg-muted text-text-muted'}`} aria-hidden="true">{approval.state === 'approved' ? <CheckCircle className="size-5" /> : approval.state === 'waiting' ? <Clock className="size-5" /> : <ChatCircle className="size-5" />}</span>
        <div className="min-w-0 flex-1"><h3 id="approval-title" className="text-lg font-bold text-text">{terminal ? 'Histórico da aprovação' : title}</h3><p className="mt-1 text-sm text-text-muted">{terminal ? 'Consulte as mensagens e respostas registradas neste atendimento.' : description}</p>
          {approval.latest?.answeredAt && <p className="mt-2 text-sm font-semibold text-text">{approval.latest.options[approval.latest.selectedOption ?? 0]} · {new Date(approval.latest.answeredAt).toLocaleString('pt-BR')}</p>}
        </div>
      </div>
      {history.isPending && <p role="status" className="mt-3 text-sm text-text-muted">Conferindo respostas...</p>}
      {history.isError && <p role="alert" className="mt-3 text-sm text-danger">Não foi possível conferir as respostas. <button className="underline" onClick={() => history.refetch()}>Tentar novamente</button></p>}
      {serviceOrder.status === 'OPEN' && approval.latest?.purpose === 'QUOTE' && approval.latest.sentAt && <div className="mt-3 rounded-button border border-warning/30 p-3"><p className="text-sm text-text">A mensagem já foi enviada, mas a OS ainda está Aberta. Não é necessário reenviar.</p><Button variant="outline" size="sm" className="mt-2" disabled={repairStatus.isPending} onClick={() => repairStatus.mutate({ id: serviceOrder.id, toStatus: 'AWAITING_APPROVAL' }, { onSuccess: () => { void refresh(); }, onError: error => toast.error(extractErrorMessage(error)) })}>Registrar aguardo de aprovação</Button></div>}
      {!terminal && <div className="mt-4 flex flex-wrap gap-2">
        {approval.state === 'approved' && canStart && <Button onClick={() => onStart?.(false)}>Iniciar serviço autorizado</Button>}
        {['declined', 'contact', 'changed'].includes(approval.state) && <Button variant="outline" onClick={onGoToQuote}>Revisar orçamento</Button>}
        {approval.state === 'declined' && onCancelOrder && <Button variant="outline" className="text-danger" onClick={onCancelOrder}>Encerrar atendimento (cliente recusou)</Button>}
        <Button variant={approval.state === 'not-sent' || ['expired', 'changed'].includes(approval.state) ? 'default' : 'outline'} onClick={() => setOpen(true)} disabled={!canSend || !ready || busy || history.isPending || history.isError}>{approval.state === 'not-sent' ? 'Revisar e enviar ao cliente' : 'Enviar nova solicitação'}</Button>
      </div>}
      {!terminal && !hasItems && <p className="mt-3 text-sm text-text-muted">Adicione os serviços e valores na etapa <button className="font-semibold text-primary underline" onClick={onGoToQuote}>Orçamento</button>.</p>}
      {!terminal && hasItems && serviceOrder.status === 'OPEN' && !entryReady && <p className="mt-3 text-sm text-warning">Complete as fotos de entrada antes de enviar. <button className="font-semibold underline" onClick={onGoToEntry}>Ir para Entrada</button></p>}
      {approval.state === 'prepared' && canSend && <div className="mt-4 rounded-button border border-border p-3"><p className="text-sm text-text-muted">Envie a mensagem no aplicativo e confirme apenas depois de concluir o envio.</p><div className="mt-3 flex flex-wrap gap-2">{prepared?.whatsappUrl && <Button variant="outline" asChild><a href={prepared.whatsappUrl} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></Button>}<Button onClick={confirmManualDispatch} disabled={busy}>Já enviei, aguardar resposta</Button></div></div>}
      {canStart && approval.state !== 'approved' && <details className="mt-4 border-t border-border pt-3"><summary className="cursor-pointer text-sm font-medium text-text-muted">O cliente autorizou por telefone ou pessoalmente?</summary><p className="mt-2 text-sm text-text-muted">Você pode iniciar após confirmar a autorização diretamente com o cliente. Isso não registra uma resposta em nome dele.</p><Button variant="outline" className="mt-3" onClick={() => onStart?.(true)}>Confirmar autorização presencial</Button></details>}
    </div>

    <div className="rounded-card border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-semibold text-text">Orçamento atual</h4><p className="mt-1 text-xs text-text-muted">{serviceOrder.items?.length ?? 0} itens · {serviceOrder.vehiclePlate}</p></div><p className="text-xl font-bold tabular-nums text-text">{formatCurrencyBRL(serviceOrder.totalAmountCents)}</p></div>
      <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={onGoToQuote}>Ver itens e valores</Button><Button variant="ghost" size="sm" onClick={downloadPdf} disabled={!hasItems}><FileArrowDown className="size-4" />Baixar orçamento</Button></div>
    </div>
    <CustomerMessageHistory serviceOrderId={serviceOrder.id} />
    {canSend && <details className="rounded-card border border-border bg-card p-4 sm:p-5"><summary className="cursor-pointer text-sm font-semibold text-text-muted">Outras mensagens para o cliente</summary><p className="mt-2 text-sm text-text-muted">Use para agendamento, retirada ou uma pergunta adicional.</p><CustomerMessageComposer value={custom} onChange={setCustom} disabled={busy} whatsappIntegrated={whatsappIntegrated} allowQuotePreset={false} allowPickupPreset={serviceOrder.status === 'COMPLETED'} />
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2"><label className="text-sm">Enviar por <select aria-label="Canal da mensagem adicional" value={channel} onChange={event => setChannel(event.target.value as 'EMAIL' | 'WHATSAPP')} className="ml-2 rounded-button border border-border bg-bg px-3 py-2"><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">E-mail</option></select></label><Button variant="outline" disabled={busy} onClick={() => void send(false)}>Enviar pergunta</Button></div>
    </details>}

    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Enviar orçamento para aprovação</DialogTitle><DialogDescription>Confira o que será enviado para {serviceOrder.customerName}.</DialogDescription></DialogHeader>
      <fieldset disabled={busy} className="grid grid-cols-2 gap-2"><legend className="mb-2 text-sm font-semibold">Como deseja enviar?</legend>{(['WHATSAPP', 'EMAIL'] as const).map(value => <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-button border p-3 text-sm ${channel === value ? 'border-primary bg-selection' : 'border-border'}`}><input type="radio" name="approval-channel" checked={channel === value} onChange={() => setChannel(value)} className="accent-primary" />{value === 'WHATSAPP' ? <ChatCircle className="size-4" /> : <Envelope className="size-4" />}{value === 'WHATSAPP' ? 'WhatsApp' : 'E-mail'}</label>)}</fieldset>
      <p className="break-words text-xs text-text-muted">{channel === 'WHATSAPP' ? `${serviceOrder.customerPhone} · ${whatsappIntegrated ? 'Envio direto pelo sistema' : 'O aplicativo WhatsApp abrirá para concluir o envio'}` : customer.data?.customer.email || 'O cliente ainda não tem e-mail cadastrado.'}</p>
      <div className="rounded-button border border-border bg-surface p-4"><p className="text-xs text-text-muted">OS #{String(serviceOrder.orderNumber).padStart(5, '0')} · {serviceOrder.vehiclePlate}</p><h4 className="mt-1 font-semibold">{serviceOrder.vehicleBrand} {serviceOrder.vehicleModel}</h4><ul className="mt-3 space-y-2">{serviceOrder.items?.map(item => <li key={item.id} className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words">{item.description} <span className="text-text-muted">× {item.quantity}</span></span><span className="shrink-0 tabular-nums">{formatCurrencyBRL(item.lineTotalCents)}</span></li>)}</ul><div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 font-bold"><span>Total</span><span className="tabular-nums">{formatCurrencyBRL(serviceOrder.totalAmountCents)}</span></div><p className="mt-4 text-sm font-semibold">{CUSTOMER_MESSAGE_PRESETS.QUOTE.question}</p><ul className="mt-2 space-y-1 text-xs text-text-muted">{CUSTOMER_MESSAGE_PRESETS.QUOTE.options.map(option => <li key={option}>• {option}</li>)}</ul></div>
      {approval.latest && <p className="flex gap-2 text-xs text-warning"><WarningCircle className="mt-0.5 size-4 shrink-0" />Esta nova solicitação substitui a anterior. Se o envio anterior não foi confirmado, confira a conversa primeiro.</p>}
      <p className="text-xs text-text-muted">O cliente terá 7 dias para responder. A aprovação fica registrada; a equipe inicia o serviço depois.</p>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Voltar</Button><Button onClick={() => void send(true)} disabled={busy || (channel === 'EMAIL' && (!hasEmail || customer.isLoading))}>{busy ? 'Enviando...' : channel === 'WHATSAPP' && !whatsappIntegrated ? 'Preparar no WhatsApp' : 'Enviar orçamento'}</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}
