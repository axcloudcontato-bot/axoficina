'use client';

import { useEffect, useMemo, useState } from 'react';
import { CaretLeft, CaretRight, Plus } from '@phosphor-icons/react';
import type { AppointmentResponse, AppointmentStatus } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppointmentCalendar, type CalendarView } from '@/features/appointments/components/AppointmentCalendar';
import { AppointmentDetails } from '@/features/appointments/components/AppointmentDetails';
import { AppointmentForm, type AppointmentPrefill } from '@/features/appointments/components/AppointmentForm';
import { agendaIndicators } from '@/features/appointments/calendar/indicators';
import { addDays, endOfWeek, startOfDay, startOfWeek } from '@/features/appointments/calendar/date-utils';
import { toast } from 'sonner';
import { useAppointments, useUpdateAppointment } from '@/features/appointments/hooks/use-appointments';
import { useAgendaHours } from '@/features/settings/hooks/use-settings';
import { extractErrorCode, extractErrorMessage } from '@/lib/api/client';
import { useUsersList } from '@/features/users/hooks/use-users';

const STATUS_LABELS: Record<AppointmentStatus, string> = { SCHEDULED: 'Agendado', CONFIRMED: 'Confirmado', IN_SERVICE: 'Em atendimento', COMPLETED: 'Concluído', CANCELLED: 'Cancelado', NO_SHOW: 'Não compareceu' };

export default function AppointmentsPage() {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('WEEK');
  // Cancelled appointments and no-shows clutter the week; they are one filter away.
  const [status, setStatus] = useState<AppointmentStatus | 'ALL' | 'ACTIVE'>('ACTIVE');
  const [technicianId, setTechnicianId] = useState('ALL');
  const users = useUsersList({ offset: 0, limit: 100, filters: { status: 'active' } });
  const hours = useAgendaHours();
  const reschedule = useUpdateAppointment();
  const [selected, setSelected] = useState<AppointmentResponse>();
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [formDate, setFormDate] = useState(new Date());
  const [prefill, setPrefill] = useState<AppointmentPrefill>();
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setView('DAY');
    // Arriving from "Agendar" elsewhere (e.g. Relacionamento): open the form already filled.
    const params = new URLSearchParams(window.location.search);
    const customerId = params.get('cliente');
    if (customerId) {
      setPrefill({ customerId, customerName: params.get('nome') ?? '', vehicleId: params.get('veiculo') ?? undefined, serviceDescription: params.get('servico') ?? undefined });
      setSelected(undefined); setFormDate(new Date()); setFormOpen(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);
  const range = useMemo(() => {
    if (view === 'DAY') return { start: startOfDay(date), end: addDays(startOfDay(date), 1) };
    if (view === 'MONTH') return { start: startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1)), end: addDays(startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1)), 42) };
    return { start: startOfWeek(date), end: endOfWeek(date) };
  }, [date, view]);
  const query = useAppointments({ startsAt: range.start.toISOString(), endsAt: range.end.toISOString(), status: status === 'ALL' || status === 'ACTIVE' ? undefined : status, technicianId: technicianId === 'ALL' ? undefined : technicianId });
  const items = (query.data?.items ?? []).filter((item) => status !== 'ACTIVE' || !['CANCELLED', 'NO_SHOW'].includes(item.status));
  // After an edit the list refetches; show the fresh copy of the open appointment.
  const current = selected ? query.data?.items.find((item) => item.id === selected.id) ?? selected : undefined;
  const title = view === 'MONTH' ? date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : `${range.start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${addDays(range.end, -1).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  const shift = (direction: number) => setDate((current) => view === 'MONTH' ? new Date(current.getFullYear(), current.getMonth() + direction, 1) : addDays(current, direction * (view === 'WEEK' ? 7 : 1)));

  // Dragging keeps the duration; a busy technician is a question, not a silent failure.
  function move(item: AppointmentResponse, startsAt: Date, confirmConflict = false) {
    const endsAt = new Date(startsAt.getTime() + (Date.parse(item.endsAt) - Date.parse(item.startsAt)));
    reschedule.mutate({ id: item.id, customerId: item.customerId, vehicleId: item.vehicleId, technicianId: item.technicianId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), serviceDescription: item.serviceDescription, notes: item.notes, confirmConflict }, {
      onSuccess: () => toast.success(`Remarcado para ${startsAt.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.`),
      onError: (error) => extractErrorCode(error) === 'APPOINTMENT_CONFLICT' && !confirmConflict
        ? toast.warning(extractErrorMessage(error), { action: { label: 'Mover mesmo assim', onClick: () => move(item, startsAt, true) } })
        : toast.error(extractErrorMessage(error)),
    });
  }

  const indicators = agendaIndicators(query.data?.items ?? [], range.start, range.end, hours);

  function createAt(value = new Date()) { setSelected(undefined); setPrefill(undefined); setFormDate(value); setFormOpen(true); }
  return <div className="flex flex-col gap-5">
    <section className="flex flex-col gap-4 rounded-card border border-border bg-card p-4 shadow-sm sm:p-5 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">{hours.openHour}h às {hours.closeHour}h</p><h1 className="text-2xl font-bold tracking-tight text-text">Agenda da oficina</h1><p className="mt-1 text-sm text-text-muted">Organize chegadas, equipe e próximos atendimentos.</p></div>
      <Button onClick={() => createAt()}><Plus className="size-4" aria-hidden="true" /> Novo agendamento</Button>
    </section>
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Período anterior" onClick={() => shift(-1)}><CaretLeft className="size-4" /></Button><Button variant="outline" onClick={() => setDate(new Date())}>Hoje</Button><Button variant="outline" size="icon" aria-label="Próximo período" onClick={() => shift(1)}><CaretRight className="size-4" /></Button><h2 className="ml-2 capitalize text-sm font-bold text-text">{title}</h2></div>
      <div className="flex flex-col gap-2 sm:flex-row"><Select value={technicianId} onValueChange={setTechnicianId}><SelectTrigger aria-label="Filtrar por técnico" className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Toda a equipe</SelectItem>{users.data?.items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={(value) => setStatus(value as AppointmentStatus | 'ALL' | 'ACTIVE')}><SelectTrigger aria-label="Filtrar por status" className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Ativos (sem cancelados)</SelectItem><SelectItem value="ALL">Todos os status</SelectItem>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><div className="flex rounded-button border border-border bg-background p-1">{(['DAY', 'WEEK', 'MONTH'] as const).map((value) => <button key={value} type="button" onClick={() => setView(value)} className={`rounded-sm px-3 py-1.5 text-xs font-semibold ${view === value ? 'bg-selection text-primary' : 'text-text-muted'}`}>{value === 'DAY' ? 'Dia' : value === 'WEEK' ? 'Semana' : 'Mês'}</button>)}</div></div>
    </section>
    {!query.isLoading && !query.isError && (status === 'ACTIVE' || status === 'ALL') && technicianId === 'ALL' && <section aria-label="Indicadores do período" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      { label: 'Agendamentos', value: String(indicators.booked), detail: 'no período, sem cancelados' },
      { label: 'Ocupação', value: indicators.occupancy === null ? '—' : `${indicators.occupancy}%`, detail: hours.bays ? `das horas de ${hours.bays} ${hours.bays === 1 ? 'box' : 'boxes'}` : 'das horas de funcionamento' },
      { label: 'Faltas', value: indicators.noShowRate === null ? '—' : `${indicators.noShowRate}%`, detail: `${indicators.noShows} de ${indicators.pastBooked} já passados` },
      { label: 'Viraram OS', value: String(indicators.converted), detail: 'atendimentos iniciados' },
    ].map((item) => <div key={item.label} className="rounded-card border border-border bg-card p-4"><p className="text-xs font-semibold text-text-muted">{item.label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{item.value}</p><p className="mt-1 text-xs text-text-muted">{item.detail}</p></div>)}</section>}
    {query.isError ? <div className="rounded-card border border-danger/30 bg-danger-subtle p-6 text-center"><p className="font-semibold text-danger-strong">Não foi possível carregar a agenda.</p><Button className="mt-3" variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div> : <AppointmentCalendar date={date} view={view} items={items} loading={query.isLoading} hours={hours} onMove={(item, startsAt) => move(item, startsAt)} onCreate={createAt} onSelect={(item) => { setSelected(item); setDetailsOpen(true); }} />}
    <AppointmentForm open={formOpen} onOpenChange={setFormOpen} initialDate={formDate} appointment={current} hours={hours} prefill={current ? undefined : prefill} />
    <AppointmentDetails key={current?.id} appointment={current} open={detailsOpen} onOpenChange={setDetailsOpen} onEdit={() => { setDetailsOpen(false); setFormDate(new Date(current!.startsAt)); setFormOpen(true); }} />
  </div>;
}
