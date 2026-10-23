'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AppointmentResponse } from '@oficina/contracts';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarBlank } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomersList } from '@/features/customers/hooks/use-customers';
import { useVehiclesList } from '@/features/vehicles/hooks/use-vehicles';
import { useUsersList } from '@/features/users/hooks/use-users';
import { extractErrorMessage } from '@/lib/api/client';
import { useCreateAppointment, useUpdateAppointment } from '../hooks/use-appointments';
import { toDateInput } from '../calendar/date-utils';

export function AppointmentForm({ open, onOpenChange, initialDate, appointment }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate: Date;
  appointment?: AppointmentResponse;
}) {
  const customers = useCustomersList({ offset: 0, limit: 100 });
  const [customerId, setCustomerId] = useState('');
  const vehicles = useVehiclesList({ offset: 0, limit: 100, customerId }, { enabled: Boolean(customerId) });
  const users = useUsersList({ offset: 0, limit: 100, filters: { status: 'active' } });
  const create = useCreateAppointment();
  const update = useUpdateAppointment();
  const pending = create.isPending || update.isPending;
  const initialEnd = useMemo(() => new Date(initialDate.getTime() + 60 * 60_000), [initialDate]);
  const [vehicleId, setVehicleId] = useState('');
  const [technicianId, setTechnicianId] = useState('NONE');
  const [startsAt, setStartsAt] = useState(toDateInput(initialDate));
  const [endsAt, setEndsAt] = useState(toDateInput(initialEnd));
  const [serviceDescription, setServiceDescription] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setCustomerId(appointment?.customerId ?? '');
    setVehicleId(appointment?.vehicleId ?? '');
    setTechnicianId(appointment?.technicianId ?? 'NONE');
    setStartsAt(toDateInput(appointment ? new Date(appointment.startsAt) : initialDate));
    setEndsAt(toDateInput(appointment ? new Date(appointment.endsAt) : initialEnd));
    setServiceDescription(appointment?.serviceDescription ?? '');
    setNotes(appointment?.notes ?? '');
  }, [open, appointment, initialDate, initialEnd]);

  async function submit(confirmConflict = false) {
    const payload = {
      customerId,
      vehicleId,
      technicianId: technicianId === 'NONE' ? undefined : technicianId,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      serviceDescription,
      notes: notes || undefined,
      confirmConflict,
    };
    try {
      if (appointment) await update.mutateAsync({ id: appointment.id, ...payload });
      else await create.mutateAsync(payload);
      toast.success(appointment ? 'Agendamento atualizado.' : 'Agendamento criado.');
      onOpenChange(false);
    } catch (error) {
      const message = extractErrorMessage(error);
      if (!confirmConflict && message.includes('já possui')) {
        if (window.confirm(`${message}\n\nDeseja salvar mesmo assim?`)) await submit(true);
        return;
      }
      toast.error(message);
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle className="flex items-center gap-2.5"><span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted"><CalendarBlank className="size-[18px]" aria-hidden="true" /></span>{appointment ? 'Editar agendamento' : 'Novo agendamento'}</DialogTitle><DialogDescription>Organize a chegada do veículo e a disponibilidade da equipe.</DialogDescription></DialogHeader>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Cliente"><Select value={customerId} onValueChange={(value) => { setCustomerId(value); setVehicleId(''); }}><SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger><SelectContent>{customers.data?.items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Veículo"><Select value={vehicleId} onValueChange={setVehicleId} disabled={!customerId}><SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger><SelectContent>{vehicles.data?.items.map((item) => <SelectItem key={item.id} value={item.id}>{item.brand} {item.model} · {item.plate}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Início"><Input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></Field>
      <Field label="Término"><Input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></Field>
      <Field label="Técnico"><Select value={technicianId} onValueChange={setTechnicianId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Sem técnico definido</SelectItem>{users.data?.items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Serviço solicitado"><Input value={serviceDescription} onChange={(event) => setServiceDescription(event.target.value)} placeholder="Ex.: revisão e troca de óleo" /></Field>
      <div className="sm:col-span-2"><Field label="Observações"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Informações importantes para a recepção ou o técnico" /></Field></div>
    </div>
    <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => submit()} disabled={pending || !customerId || !vehicleId || !serviceDescription.trim()}>{pending ? 'Salvando...' : 'Salvar agendamento'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
