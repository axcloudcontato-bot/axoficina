'use client';

import { FileArrowDown, Envelope, ChatCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ServiceOrderResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { useCustomer } from '@/features/customers/hooks/use-customers';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { generateQuotePdf } from '../quote-pdf';
import { buildQuoteMessage, buildWhatsAppQuoteUrl } from '../quote-share';
import { settingsApi } from '@/features/settings/api/settings-api';
import { extractErrorMessage } from '@/lib/api/client';
import { customerMessagesApi } from '../api/customer-messages-api';
import { CustomerMessageComposer, type CustomerMessageDraft } from './CustomerMessageComposer';
import { CustomerMessageHistory } from './CustomerMessageHistory';
import { CUSTOMER_MESSAGE_PRESETS, validateCustomerMessage } from '../customer-message-presets';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { useBranding } from '@/features/settings/hooks/use-settings';

export function ServiceOrderQuoteActions({ serviceOrder }: { serviceOrder: ServiceOrderResponse }) {
  const customer = useCustomer(serviceOrder.customerId);
  const hasItems = Boolean(serviceOrder.items?.length);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [preparedWhatsApp, setPreparedWhatsApp] = useState<string | null>(null);
  const [draft, setDraft] = useState<CustomerMessageDraft>({ enabled: true, preset: 'QUOTE', question: CUSTOMER_MESSAGE_PRESETS.QUOTE.question, includeQuote: true, options: [...CUSTOMER_MESSAGE_PRESETS.QUOTE.options] });
  const queryClient = useQueryClient();
  const branding = useBranding();
  const whatsappIntegrated = branding.data?.whatsappEnabled ?? false;
  const currentUser = useAuthStore((state) => state.user);
  const canSend = hasPermission(currentUser, 'service_orders.manage') && serviceOrder.status !== 'CANCELLED';
  const busy = sendingEmail || sendingWhatsApp;

  function validateDraft() {
    const error = validateCustomerMessage(draft.question, draft.options);
    if (error) { toast.warning(error); return false; }
    if (draft.includeQuote && !hasItems) { toast.warning('Adicione itens ao orçamento ou desmarque a inclusão do orçamento.'); return false; }
    return true;
  }

  async function sendWithButtons(channel: 'EMAIL' | 'WHATSAPP') {
    if (busy || !canSend || !validateDraft()) return;
    // Open synchronously to preserve the browser's user gesture across the API call.
    const popup = channel === 'WHATSAPP' && !whatsappIntegrated ? window.open('about:blank', '_blank') : null;
    if (popup) popup.opener = null;
    if (channel === 'EMAIL') setSendingEmail(true); else setSendingWhatsApp(true);
    setPreparedWhatsApp(null);
    try {
      const result = await customerMessagesApi.create({ serviceOrderId: serviceOrder.id, channel, question: draft.question.trim(), options: draft.options.map((option) => option.trim()), includeQuote: draft.includeQuote });
      if (result.whatsappUrl) {
        setPreparedWhatsApp(result.whatsappUrl);
        if (popup) popup.location.href = result.whatsappUrl;
        toast.success('Mensagem preparada. Confirme o envio no WhatsApp.');
      } else {
        popup?.close();
        toast.success(channel === 'WHATSAPP' ? 'Mensagem com botões enviada pelo WA-AKG.' : 'E-mail com botões enviado ao cliente.');
      }
    } catch (error) {
      popup?.close();
      toast.error(extractErrorMessage(error, 'Não foi possível preparar a mensagem com botões.'));
    } finally {
      setSendingEmail(false);
      setSendingWhatsApp(false);
      void queryClient.invalidateQueries({ queryKey: ['customer-messages', serviceOrder.id] });
    }
  }

  async function downloadPdf() {
    if (!hasItems) return toast.warning('Adicione peças ou mão de obra antes de gerar o orçamento.');
    try {
      await generateQuotePdf(serviceOrder);
      toast.success('PDF do orçamento gerado.');
    } catch {
      toast.error('Não foi possível gerar o PDF.');
    }
  }

  function sendWhatsApp() {
    if (draft.enabled) { void sendWithButtons('WHATSAPP'); return; }
    if (!hasItems) return toast.warning('Adicione itens ao orçamento antes de compartilhar.');
    const url = buildWhatsAppQuoteUrl(serviceOrder.customerPhone, serviceOrder);
    if (!url) return toast.error('O cliente não possui um telefone válido para WhatsApp.');
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function sendEmail() {
    if (draft.enabled) { await sendWithButtons('EMAIL'); return; }
    if (!hasItems) return toast.warning('Adicione itens ao orçamento antes de compartilhar.');
    const recipient = customer.data?.customer.email?.trim() ?? '';
    if (!recipient.includes('@')) return toast.error('O cliente não possui um e-mail válido cadastrado.');
    setSendingEmail(true);
    try {
      await settingsApi.sendEmail({
        recipient,
        subject: `Orçamento OS #${String(serviceOrder.orderNumber).padStart(5, '0')} — ${serviceOrder.vehiclePlate}`,
        text: buildQuoteMessage(serviceOrder),
      });
      toast.success(`Orçamento enviado para ${recipient}.`);
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Não foi possível enviar o orçamento por e-mail.'));
    } finally {
      setSendingEmail(false);
    }
  }

  const partsTotal = (serviceOrder.items ?? []).filter((item) => item.type === 'PART').reduce((sum, item) => sum + item.lineTotalCents, 0);
  const laborTotal = (serviceOrder.items ?? []).filter((item) => item.type === 'LABOR').reduce((sum, item) => sum + item.lineTotalCents, 0);

  return <section aria-labelledby="quote-actions-title" className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Aprovação do cliente</p>
        <h3 id="quote-actions-title" className="mt-1 text-lg font-bold text-text">Orçamento</h3>
        <p className="mt-1 text-sm text-text-muted">{hasItems ? `${serviceOrder.items?.length} itens · Peças ${formatCurrencyBRL(partsTotal)} · Mão de obra ${formatCurrencyBRL(laborTotal)}` : 'Adicione peças e mão de obra para preparar o orçamento.'}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={downloadPdf}><FileArrowDown className="size-4" />Gerar PDF</Button>
        <Button variant="outline" size="sm" onClick={sendEmail} disabled={!canSend || customer.isLoading || busy}><Envelope className="size-4" />{sendingEmail ? 'Enviando...' : 'Enviar por e-mail'}</Button>
        <Button size="sm" onClick={sendWhatsApp} disabled={!canSend || busy}><ChatCircle className="size-4" />{sendingWhatsApp ? 'Preparando...' : 'WhatsApp'}</Button>
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between rounded-button bg-muted/50 px-3 py-2"><span className="text-sm font-semibold text-text-muted">Total para aprovação</span><span className="text-lg font-bold tabular-nums text-text">{formatCurrencyBRL(serviceOrder.totalAmountCents)}</span></div>
    <CustomerMessageComposer value={draft} onChange={(value) => { setDraft(value); setPreparedWhatsApp(null); }} disabled={busy || !canSend} whatsappIntegrated={whatsappIntegrated} />
    {preparedWhatsApp && <p className="mt-3 text-sm"><a href={preparedWhatsApp} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">Abrir WhatsApp para enviar a mensagem preparada</a></p>}
    <CustomerMessageHistory serviceOrderId={serviceOrder.id} />
  </section>;
}
