'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarBlank } from '@phosphor-icons/react';
import type { AppointmentResponse, AppointmentStatus } from '@oficina/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api/client';
import { useNotifyAppointment, useStartAppointment, useTransitionAppointment } from '../hooks/use-appointments';
import { useBranding } from '@/features/settings/hooks/use-settings';

const NEXT_ACTIONS: Partial<Record<AppointmentStatus, Array<{ status: AppointmentStatus; label: string }>>> = {
  SCHEDULED: [{ status: 'CONFIRMED', label: 'Confirmar' }, { status: 'NO_SHOW', label: 'Não compareceu' }, { status: 'CANCELLED', label: 'Cancelar' }],
  CONFIRMED: [{ status: 'NO_SHOW', label: 'Não compareceu' }, { status: 'CANCELLED', label: 'Cancelar' }],
};

const phoneDigits = (phone: string) => phone.replace(/\D/g, '');
const whatsappHref = (phone: string) => { const digits = phoneDigits(phone); return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`; };

export function AppointmentDetails({ appointment, open, onOpenChange, onEdit }: {
  appointment?: AppointmentResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  const transition = useTransitionAppointment();
  const start = useStartAppointment();
  const notify = useNotifyAppointment();
  const whatsappEnabled = Boolean(useBranding().data?.whatsappEnabled);
  const [pendingStatus, setPendingStatus] = useState<'CANCELLED' | 'NO_SHOW' | null>(null);
  const [reason, setReason] = useState('');
  if (!appointment) return null;
  const started = new Date(appointment.startsAt).getTime() <= Date.now();
  // A no-show only makes sense once the time has passed.
  const actions = (NEXT_ACTIONS[appointment.status] ?? []).filter((action) => action.status !== 'NO_SHOW' || started);

  function ask(status: AppointmentStatus) {
    if (status === 'CANCELLED' || status === 'NO_SHOW') { setReason(''); setPendingStatus(status); return; }
    void change(status);
  }

  async function change(toStatus: AppointmentStatus, withReason?: string) {
    try {
      await transition.mutateAsync({ id: appointment!.id, toStatus, ...(withReason?.trim() ? { reason: withReason.trim() } : {}) });
      setPendingStatus(null);
      toast.success('Status atualizado.');
      onOpenChange(false);
    } catch (error) { toast.error(extractErrorMessage(error)); }
  }

  async function askConfirmation() {
    try { await notify.mutateAsync({ id: appointment!.id }); toast.success('Pedido de confirmação enviado pelo WhatsApp da oficina.'); }
    catch (error) { toast.error(extractErrorMessage(error)); }
  }

  async function begin() {
    try {
      const result = await start.mutateAsync({ id: appointment!.id }) as { serviceOrder: { id: string } };
      onOpenChange(false);
      router.push(`/ordens-de-servico/${result.serviceOrder.id}`);
    } catch (error) { toast.error(extractErrorMessage(error)); }
  }

  const time = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg">
    <DialogHeader><DialogTitle className="flex items-center gap-2.5"><span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted"><CalendarBlank className="size-[18px]" aria-hidden="true" /></span>{appointment.serviceDescription}</DialogTitle><DialogDescription>{time.format(new Date(appointment.startsAt))}</DialogDescription></DialogHeader>
    <dl className="grid gap-3 rounded-card border border-border bg-surface p-4 text-sm">
      <Row label="Cliente" value={appointment.customerName} />
      {appointment.customerPhone && <div className="grid grid-cols-[7rem_1fr] gap-3"><dt className="font-semibold text-text-muted">Contato</dt><dd className="flex flex-wrap items-center gap-2"><a className="font-semibold text-primary hover:underline" href={`tel:${phoneDigits(appointment.customerPhone)}`}>{appointment.customerPhone}</a><a className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold hover:bg-muted" href={whatsappHref(appointment.customerPhone)} target="_blank" rel="noopener noreferrer">WhatsApp</a></dd></div>}
      <Row label="Veículo" value={`${appointment.vehicleBrand} ${appointment.vehicleModel} · ${appointment.vehiclePlate}`} />
      <Row label="Técnico" value={appointment.technicianName ?? 'Ainda não definido'} />
      <Row label="Observações" value={appointment.notes ?? 'Sem observações'} />
      {(appointment.confirmationSentAt || appointment.reminderSentAt) && <Row label="WhatsApp" value={[appointment.confirmationSentAt && `confirmação pedida em ${new Date(appointment.confirmationSentAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`, appointment.reminderSentAt && `lembrete enviado em ${new Date(appointment.reminderSentAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`].filter(Boolean).join(' · ')} />}
    </dl>
    {appointment.status === 'IN_SERVICE' && <p className="rounded-button border border-border p-3 text-sm text-text-muted">Este agendamento é encerrado pela OS: quando ela for entregue ou cancelada, a agenda acompanha.</p>}
    {pendingStatus && <div className="space-y-3 rounded-card border border-danger/30 bg-danger-subtle p-4"><p className="text-sm font-semibold text-text">{pendingStatus === 'CANCELLED' ? 'Cancelar este agendamento?' : 'Registrar que o cliente não compareceu?'}</p><label className="block space-y-1.5 text-sm"><span>{pendingStatus === 'CANCELLED' ? 'Motivo do cancelamento (obrigatório)' : 'Observação (opcional)'}</span><Input aria-label={pendingStatus === 'CANCELLED' ? 'Motivo do cancelamento' : 'Observação da falta'} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={pendingStatus === 'CANCELLED' ? 'Ex.: cliente remarcou por telefone' : 'Ex.: não atendeu as ligações'} /></label><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => setPendingStatus(null)}>Voltar</Button><Button variant="destructive" disabled={transition.isPending || (pendingStatus === 'CANCELLED' && reason.trim().length < 5)} onClick={() => void change(pendingStatus, reason)}>{pendingStatus === 'CANCELLED' ? 'Confirmar cancelamento' : 'Confirmar falta'}</Button></div></div>}
    <DialogFooter className="flex-wrap sm:justify-start">
      {appointment.serviceOrderId && <Button asChild><Link href={`/ordens-de-servico/${appointment.serviceOrderId}`}>Abrir OS</Link></Button>}
      {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && <Button onClick={begin} disabled={start.isPending}>Iniciar atendimento</Button>}
      {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && <Button variant="outline" onClick={onEdit}>Editar</Button>}
      {appointment.status === 'SCHEDULED' && appointment.customerPhone && (whatsappEnabled
        ? <Button variant="outline" disabled={notify.isPending} onClick={askConfirmation}>{notify.isPending ? 'Enviando...' : appointment.confirmationSentAt ? 'Reenviar confirmação' : 'Pedir confirmação'}</Button>
        : <Button variant="outline" asChild><a href={`${whatsappHref(appointment.customerPhone)}?text=${encodeURIComponent(`Olá, ${appointment.customerName.split(' ')[0]}! Seu horário está marcado para ${new Date(appointment.startsAt).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} (${appointment.serviceDescription}). Podemos confirmar?`)}`} target="_blank" rel="noopener noreferrer">Pedir confirmação</a></Button>)}
      {!pendingStatus && actions.map((action) => <Button key={action.status} variant={action.status === 'CANCELLED' ? 'destructive' : 'ghost'} onClick={() => ask(action.status)}>{action.label}</Button>)}
    </DialogFooter>
  </DialogContent></Dialog>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[7rem_1fr] gap-3"><dt className="font-semibold text-text-muted">{label}</dt><dd className="text-text">{value}</dd></div>;
}
