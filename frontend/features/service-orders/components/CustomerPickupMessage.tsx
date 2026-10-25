'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreatedCustomerMessageResponse, ServiceOrderResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBranding } from '@/features/settings/hooks/use-settings';
import { useCustomer } from '@/features/customers/hooks/use-customers';
import { extractErrorMessage } from '@/lib/api/client';
import { customerMessagesApi } from '../api/customer-messages-api';
import { useCustomerMessages } from '../hooks/use-customer-messages';
import { CUSTOMER_MESSAGE_PRESETS } from '../customer-message-presets';

export function CustomerPickupMessage({ serviceOrder, beforeSend }: { serviceOrder: ServiceOrderResponse; beforeSend: () => Promise<boolean> }) {
  const history = useCustomerMessages(serviceOrder.id);
  const customer = useCustomer(serviceOrder.customerId);
  const branding = useBranding();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState<'EMAIL' | 'WHATSAPP'>('WHATSAPP');
  const [prepared, setPrepared] = useState<CreatedCustomerMessageResponse | null>(null);
  const latest = history.data?.messages.find(message => message.purpose === 'PICKUP');
  const integrated = branding.data?.whatsappEnabled;
  const template = CUSTOMER_MESSAGE_PRESETS.PICKUP;

  async function send() {
    if (busy) return;
    const popup = channel === 'WHATSAPP' && !integrated ? window.open('about:blank', '_blank') : null;
    if (popup) popup.opener = null;
    setBusy(true);
    try {
      if (!await beforeSend()) { popup?.close(); return; }
      const result = await customerMessagesApi.create({ serviceOrderId: serviceOrder.id, purpose: 'PICKUP', channel, question: template.question, options: [...template.options], includeQuote: false });
      if (result.whatsappUrl && popup) popup.location.href = result.whatsappUrl;
      else popup?.close();
      setPrepared(result.whatsappUrl ? result : null); setOpen(false);
      toast.success(result.sent ? 'Aviso de retirada enviado ao cliente.' : 'Aviso preparado. Conclua o envio no WhatsApp.');
    } catch (error) { popup?.close(); toast.error(extractErrorMessage(error)); }
    finally { setBusy(false); void client.invalidateQueries({ queryKey: ['customer-messages', serviceOrder.id] }); }
  }
  async function confirmDispatch() {
    const id = prepared?.messageId ?? latest?.id;
    if (!id || busy) return;
    setBusy(true);
    try { await customerMessagesApi.confirmDispatch(id); setPrepared(null); toast.success('Envio do aviso confirmado.'); }
    catch (error) { toast.error(extractErrorMessage(error)); }
    finally { setBusy(false); void client.invalidateQueries({ queryKey: ['customer-messages', serviceOrder.id] }); }
  }

  return <section className="rounded-card border border-border bg-card p-4 sm:p-5"><h3 className="font-semibold text-text">Avisar o cliente para retirada</h3><p className="mt-1 text-sm text-text-muted">O cliente confirma se pode buscar o veículo. O atendimento é encerrado quando você registrar a entrega.</p>
    {latest && <p className="mt-3 text-sm font-medium text-text">{latest.answeredAt ? `Cliente respondeu: ${latest.options[latest.selectedOption ?? 0]}` : latest.sentAt ? 'Aviso enviado · aguardando resposta' : 'Envio do aviso ainda não confirmado'}</p>}
    <Button variant="outline" className="mt-3" onClick={() => setOpen(true)}>Enviar aviso de retirada</Button>
    {(prepared?.whatsappUrl || latest?.deliveryMode === 'LINK' && latest.channel === 'WHATSAPP' && !latest.sentAt) && <div className="mt-3 flex flex-wrap gap-2">{prepared?.whatsappUrl && <Button asChild variant="outline"><a href={prepared.whatsappUrl} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></Button>}<Button variant="outline" disabled={busy} onClick={confirmDispatch}>Já enviei o aviso</Button></div>}
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent><DialogHeader><DialogTitle>Avisar que o veículo está pronto</DialogTitle><DialogDescription>{serviceOrder.customerName} · {serviceOrder.vehiclePlate}</DialogDescription></DialogHeader><label className="text-sm font-medium">Enviar por<select className="mt-2 w-full rounded-button border border-border bg-bg px-3 py-2" value={channel} onChange={event => setChannel(event.target.value as 'EMAIL' | 'WHATSAPP')}><option value="WHATSAPP">WhatsApp · {serviceOrder.customerPhone}</option><option value="EMAIL">E-mail · {customer.data?.customer.email || 'Não cadastrado'}</option></select></label><div className="rounded-button border border-border bg-surface p-4 text-sm"><p className="font-medium">{template.question}</p><ul className="mt-3 space-y-1 text-text-muted">{template.options.map(option => <li key={option}>• {option}</li>)}</ul></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Voltar</Button><Button onClick={() => void send()} disabled={busy || channel === 'EMAIL' && !customer.data?.customer.email}>{busy ? 'Enviando...' : 'Enviar aviso'}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
