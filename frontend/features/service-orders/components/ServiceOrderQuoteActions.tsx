'use client';

import { FileArrowDown, Envelope, ChatCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ServiceOrderResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { useCustomer } from '@/features/customers/hooks/use-customers';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { generateQuotePdf } from '../quote-pdf';
import { buildQuoteMessage, buildWhatsAppQuoteUrl } from '../quote-share';
import { settingsApi } from '@/features/settings/api/settings-api';
import { extractErrorMessage } from '@/lib/api/client';

export function ServiceOrderQuoteActions({ serviceOrder }: { serviceOrder: ServiceOrderResponse }) {
  const customer = useCustomer(serviceOrder.customerId);
  const hasItems = Boolean(serviceOrder.items?.length);
  const [sendingEmail, setSendingEmail] = useState(false);

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
    if (!hasItems) return toast.warning('Adicione itens ao orçamento antes de compartilhar.');
    const url = buildWhatsAppQuoteUrl(serviceOrder.customerPhone, serviceOrder);
    if (!url) return toast.error('O cliente não possui um telefone válido para WhatsApp.');
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function sendEmail() {
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
        <Button variant="outline" size="sm" onClick={sendEmail} disabled={customer.isLoading || sendingEmail}><Envelope className="size-4" />{sendingEmail ? 'Enviando...' : 'Enviar por e-mail'}</Button>
        <Button size="sm" onClick={sendWhatsApp}><ChatCircle className="size-4" />WhatsApp</Button>
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between rounded-button bg-muted/50 px-3 py-2"><span className="text-sm font-semibold text-text-muted">Total para aprovação</span><span className="text-lg font-bold tabular-nums text-text">{formatCurrencyBRL(serviceOrder.totalAmountCents)}</span></div>
  </section>;
}
