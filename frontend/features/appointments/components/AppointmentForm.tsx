'use client';

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_AGENDA_HOURS, type AgendaHours, type AppointmentResponse } from '@oficina/contracts';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarBlank } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomerSearchCombobox } from '@/features/customers/components/CustomerSearchCombobox';
import { CustomerFormModal } from '@/features/customers/components/CustomerFormModal';
import { VehicleFormModal } from '@/features/vehicles/components/VehicleFormModal';
import { withinHours } from '../calendar/time-grid';
import { useVehiclesList } from '@/features/vehicles/hooks/use-vehicles';
import { useUsersList } from '@/features/users/hooks/use-users';
import { extractErrorCode, extractErrorMessage } from '@/lib/api/client';
import { useCreateAppointment, useUpdateAppointment } from '../hooks/use-appointments';
import { toDateInput } from '../calendar/date-utils';

const DURATIONS = [{ minutes: 30, label: '30 min' }, { minutes: 60, label: '1 h' }, { minutes: 120, label: '2 h' }, { minutes: 180, label: '3 h' }, { minutes: 240, label: '4 h' }];

export interface AppointmentPrefill { customerId: string; customerName: string; vehicleId?: string; serviceDescription?: string }

export function AppointmentForm({ open, onOpenChange, initialDate, appointment, hours = DEFAULT_AGENDA_HOURS, prefill }: {
  hours?: AgendaHours;
  prefill?: AppointmentPrefill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate: Date;
  appointment?: AppointmentResponse;
}) {
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
  const [conflict, setConflict] = useState<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string>();
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newVehicleOpen, setNewVehicleOpen] = useState(false);
  const durationMinutes = startsAt && endsAt ? Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000) : 0;
  const offHours = Boolean(startsAt && endsAt && durationMinutes > 0 && !withinHours(new Date(startsAt), new Date(endsAt), hours));
  function setDuration(minutes: number) { if (startsAt) setEndsAt(toDateInput(new Date(new Date(startsAt).getTime() + minutes * 60_000))); }
  // Moving the start keeps the chosen duration.
  function changeStart(value: string) { setStartsAt(value); if (value && durationMinutes > 0) setEndsAt(toDateInput(new Date(new Date(value).getTime() + durationMinutes * 60_000))); }
  function fullDay() { if (!startsAt) return; const day = new Date(startsAt); const start = new Date(day); start.setHours(hours.openHour, 0, 0, 0); const end = new Date(day); end.setHours(hours.closeHour, 0, 0, 0); setStartsAt(toDateInput(start)); setEndsAt(toDateInput(end)); }
  const invalidInterval = Boolean(startsAt && endsAt && new Date(endsAt) <= new Date(startsAt));

  useEffect(() => {
    if (!open) return;
    setCustomerId(appointment?.customerId ?? prefill?.customerId ?? '');
    setCustomerLabel(appointment?.customerName ?? prefill?.customerName);
    setVehicleId(appointment?.vehicleId ?? prefill?.vehicleId ?? '');
    setTechnicianId(appointment?.technicianId ?? 'NONE');
    setStartsAt(toDateInput(appointment ? new Date(appointment.startsAt) : initialDate));
    setEndsAt(toDateInput(appointment ? new Date(appointment.endsAt) : initialEnd));
    setServiceDescription(appointment?.serviceDescription ?? prefill?.serviceDescription ?? '');
    setNotes(appointment?.notes ?? '');
  }, [open, appointment, initialDate, initialEnd, prefill]);

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
      // The backend flags a busy technician by code; the operator decides in a proper dialog.
      if (!confirmConflict && extractErrorCode(error) === 'APPOINTMENT_CONFLICT') { setConflict(extractErrorMessage(error)); return; }
      toast.error(extractErrorMessage(error));
    }
  }

  return <><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle className="flex items-center gap-2.5"><span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted"><CalendarBlank className="size-[18px]" aria-hidden="true" /></span>{appointment ? 'Editar agendamento' : 'Novo agendamento'}</DialogTitle><DialogDescription>Organize a chegada do veículo e a disponibilidade da equipe.</DialogDescription></DialogHeader>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Cliente"><CustomerSearchCombobox aria-label="Cliente" placeholder="Busque por nome, CPF/CNPJ ou telefone" value={customerId} initialLabel={customerLabel} onChange={(value, customer) => { setCustomerId(value); setCustomerLabel(customer?.name); setVehicleId(''); }} /><button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setNewCustomerOpen(true)}>+ Cadastrar cliente novo</button></Field>
      <Field label="Veículo"><Select value={vehicleId} onValueChange={setVehicleId} disabled={!customerId}><SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger><SelectContent>{vehicles.data?.items.map((item) => <SelectItem key={item.id} value={item.id}>{item.brand} {item.model} · {item.plate}</SelectItem>)}</SelectContent></Select>{customerId && <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setNewVehicleOpen(true)}>+ Cadastrar veículo novo</button>}</Field>
      <Field label="Início"><Input type="datetime-local" value={startsAt} onChange={(event) => changeStart(event.target.value)} /></Field>
      <Field label="Término"><Input type="datetime-local" value={endsAt} aria-invalid={invalidInterval} onChange={(event) => setEndsAt(event.target.value)} />{invalidInterval && <span role="alert" className="block text-xs font-normal text-danger">O término deve ser depois do início.</span>}</Field>
      <div className="sm:col-span-2"><p className="mb-2 text-sm font-medium">Duração</p><div className="flex flex-wrap gap-1.5" role="group" aria-label="Duração do atendimento">{DURATIONS.map((option) => <button key={option.minutes} type="button" aria-pressed={durationMinutes === option.minutes} onClick={() => setDuration(option.minutes)} className={`rounded-button border px-3 py-1.5 text-xs font-semibold ${durationMinutes === option.minutes ? 'border-primary/40 bg-selection text-primary' : 'border-border text-text-muted hover:bg-muted'}`}>{option.label}</button>)}<button type="button" onClick={fullDay} className="rounded-button border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-muted">Dia todo</button></div>{offHours && <p className="mt-2 text-xs text-warning">Fora do horário de funcionamento ({hours.openHour}h às {hours.closeHour}h, nos dias configurados). Você pode salvar assim mesmo.</p>}</div>
      <Field label="Técnico"><Select value={technicianId} onValueChange={setTechnicianId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Sem técnico definido</SelectItem>{users.data?.items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Serviço solicitado"><Input value={serviceDescription} onChange={(event) => setServiceDescription(event.target.value)} placeholder="Ex.: revisão e troca de óleo" /></Field>
      <div className="sm:col-span-2"><Field label="Observações"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Informações importantes para a recepção ou o técnico" /></Field></div>
    </div>
    <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => submit()} disabled={pending || invalidInterval || !customerId || !vehicleId || !serviceDescription.trim()}>{pending ? 'Salvando...' : 'Salvar agendamento'}</Button></DialogFooter>
  </DialogContent></Dialog>
  <CustomerFormModal open={newCustomerOpen} onOpenChange={setNewCustomerOpen} onCreated={(customer) => { setCustomerId(customer.id); setCustomerLabel(customer.name); setVehicleId(''); setNewCustomerOpen(false); setNewVehicleOpen(true); }} />
  <VehicleFormModal open={newVehicleOpen} onOpenChange={setNewVehicleOpen} initialCustomer={customerId && customerLabel ? { id: customerId, name: customerLabel } : undefined} onCreated={(vehicle) => { setVehicleId(vehicle.id); setNewVehicleOpen(false); }} />
  <Dialog open={conflict !== null} onOpenChange={(value) => { if (!value) setConflict(null); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Técnico com outro agendamento</DialogTitle><DialogDescription>{conflict}</DialogDescription></DialogHeader><DialogFooter><Button variant="ghost" onClick={() => setConflict(null)}>Voltar e ajustar</Button><Button disabled={pending} onClick={() => { setConflict(null); void submit(true); }}>Agendar mesmo assim</Button></DialogFooter></DialogContent></Dialog></>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="block space-y-2"><span className="block">{label}</span>{children}</Label>;
}
