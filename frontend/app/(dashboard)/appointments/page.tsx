'use client';

import { useEffect, useMemo, useState } from 'react';
import { CaretLeft, CaretRight, Plus } from '@phosphor-icons/react';
import type { AppointmentResponse, AppointmentStatus } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppointmentCalendar, type CalendarView } from '@/features/appointments/components/AppointmentCalendar';
import { AppointmentDetails } from '@/features/appointments/components/AppointmentDetails';
import { AppointmentForm } from '@/features/appointments/components/AppointmentForm';
import { addDays, endOfWeek, startOfDay, startOfWeek } from '@/features/appointments/calendar/date-utils';
import { useAppointments } from '@/features/appointments/hooks/use-appointments';

const STATUS_LABELS: Record<AppointmentStatus, string> = { SCHEDULED: 'Agendado', CONFIRMED: 'Confirmado', IN_SERVICE: 'Em atendimento', COMPLETED: 'Concluído', CANCELLED: 'Cancelado', NO_SHOW: 'Não compareceu' };

export default function AppointmentsPage() {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('WEEK');
  const [status, setStatus] = useState<AppointmentStatus | 'ALL'>('ALL');
  const [selected, setSelected] = useState<AppointmentResponse>();
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [formDate, setFormDate] = useState(new Date());
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setView('DAY');
  }, []);
  const range = useMemo(() => {
    if (view === 'DAY') return { start: startOfDay(date), end: addDays(startOfDay(date), 1) };
    if (view === 'MONTH') return { start: startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1)), end: addDays(startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1)), 42) };
    return { start: startOfWeek(date), end: endOfWeek(date) };
  }, [date, view]);
  const query = useAppointments({ startsAt: range.start.toISOString(), endsAt: range.end.toISOString(), status: status === 'ALL' ? undefined : status });
  const title = view === 'MONTH' ? date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : `${range.start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${addDays(range.end, -1).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  const move = (direction: number) => setDate((current) => view === 'MONTH' ? new Date(current.getFullYear(), current.getMonth() + direction, 1) : addDays(current, direction * (view === 'WEEK' ? 7 : 1)));

  function createAt(value = new Date()) { setSelected(undefined); setFormDate(value); setFormOpen(true); }
  return <div className="flex flex-col gap-5">
    <section className="flex flex-col gap-4 rounded-card border border-border bg-card p-4 shadow-sm sm:p-5 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">Capacidade da oficina</p><h1 className="text-2xl font-bold tracking-tight text-text">Agenda da oficina</h1><p className="mt-1 text-sm text-text-muted">Organize chegadas, equipe e próximos atendimentos.</p></div>
      <Button onClick={() => createAt()}><Plus className="size-4" aria-hidden="true" /> Novo agendamento</Button>
    </section>
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Período anterior" onClick={() => move(-1)}><CaretLeft className="size-4" /></Button><Button variant="outline" onClick={() => setDate(new Date())}>Hoje</Button><Button variant="outline" size="icon" aria-label="Próximo período" onClick={() => move(1)}><CaretRight className="size-4" /></Button><h2 className="ml-2 capitalize text-sm font-bold text-text">{title}</h2></div>
      <div className="flex flex-col gap-2 sm:flex-row"><Select value={status} onValueChange={(value) => setStatus(value as AppointmentStatus | 'ALL')}><SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos os status</SelectItem>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><div className="flex rounded-button border border-border bg-background p-1">{(['DAY', 'WEEK', 'MONTH'] as const).map((value) => <button key={value} type="button" onClick={() => setView(value)} className={`rounded-sm px-3 py-1.5 text-xs font-semibold ${view === value ? 'bg-selection text-primary' : 'text-text-muted'}`}>{value === 'DAY' ? 'Dia' : value === 'WEEK' ? 'Semana' : 'Mês'}</button>)}</div></div>
    </section>
    {query.isError ? <div className="rounded-card border border-danger/30 bg-danger-subtle p-6 text-center"><p className="font-semibold text-danger-strong">Não foi possível carregar a agenda.</p><Button className="mt-3" variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div> : <AppointmentCalendar date={date} view={view} items={query.data?.items ?? []} loading={query.isLoading} onCreate={createAt} onSelect={(item) => { setSelected(item); setDetailsOpen(true); }} />}
    <AppointmentForm open={formOpen} onOpenChange={setFormOpen} initialDate={formDate} appointment={selected} />
    <AppointmentDetails appointment={selected} open={detailsOpen} onOpenChange={setDetailsOpen} onEdit={() => { setDetailsOpen(false); setFormDate(new Date(selected!.startsAt)); setFormOpen(true); }} />
  </div>;
}
