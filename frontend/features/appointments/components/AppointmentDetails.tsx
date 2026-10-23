'use client';

import { useRouter } from 'next/navigation';
import { CalendarBlank } from '@phosphor-icons/react';
import type { AppointmentResponse, AppointmentStatus } from '@oficina/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api/client';
import { useStartAppointment, useTransitionAppointment } from '../hooks/use-appointments';

const NEXT_ACTIONS: Partial<Record<AppointmentStatus, Array<{ status: AppointmentStatus; label: string }>>> = {
  SCHEDULED: [{ status: 'CONFIRMED', label: 'Confirmar' }, { status: 'NO_SHOW', label: 'Não compareceu' }, { status: 'CANCELLED', label: 'Cancelar' }],
  CONFIRMED: [{ status: 'NO_SHOW', label: 'Não compareceu' }, { status: 'CANCELLED', label: 'Cancelar' }],
  IN_SERVICE: [{ status: 'COMPLETED', label: 'Concluir' }, { status: 'CANCELLED', label: 'Cancelar' }],
};

export function AppointmentDetails({ appointment, open, onOpenChange, onEdit }: {
  appointment?: AppointmentResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  const transition = useTransitionAppointment();
  const start = useStartAppointment();
  if (!appointment) return null;

  async function change(toStatus: AppointmentStatus) {
    try {
      await transition.mutateAsync({ id: appointment!.id, toStatus });
      toast.success('Status atualizado.');
      onOpenChange(false);
    } catch (error) { toast.error(extractErrorMessage(error)); }
  }

  async function begin() {
    try {
      const result = await start.mutateAsync({ id: appointment!.id }) as { serviceOrder: { id: string } };
      onOpenChange(false);
      router.push(`/service-orders/${result.serviceOrder.id}`);
    } catch (error) { toast.error(extractErrorMessage(error)); }
  }

  const time = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg">
    <DialogHeader><DialogTitle className="flex items-center gap-2.5"><span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted"><CalendarBlank className="size-[18px]" aria-hidden="true" /></span>{appointment.serviceDescription}</DialogTitle><DialogDescription>{time.format(new Date(appointment.startsAt))}</DialogDescription></DialogHeader>
    <dl className="grid gap-3 rounded-card border border-border bg-surface p-4 text-sm">
      <Row label="Cliente" value={appointment.customerName} />
      <Row label="Veículo" value={`${appointment.vehicleBrand} ${appointment.vehicleModel} · ${appointment.vehiclePlate}`} />
      <Row label="Técnico" value={appointment.technicianName ?? 'Ainda não definido'} />
      <Row label="Observações" value={appointment.notes ?? 'Sem observações'} />
    </dl>
    <DialogFooter className="flex-wrap sm:justify-start">
      {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && <Button onClick={begin} disabled={start.isPending}>Iniciar atendimento</Button>}
      {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && <Button variant="outline" onClick={onEdit}>Editar</Button>}
      {NEXT_ACTIONS[appointment.status]?.map((action) => <Button key={action.status} variant={action.status === 'CANCELLED' ? 'destructive' : 'ghost'} onClick={() => change(action.status)}>{action.label}</Button>)}
    </DialogFooter>
  </DialogContent></Dialog>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[7rem_1fr] gap-3"><dt className="font-semibold text-text-muted">{label}</dt><dd className="text-text">{value}</dd></div>;
}
