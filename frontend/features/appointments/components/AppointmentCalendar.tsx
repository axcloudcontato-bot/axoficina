'use client';

import { useState, type KeyboardEvent } from 'react';
import type { AppointmentResponse, AppointmentStatus } from '@oficina/contracts';
import { addDays, sameDay, startOfDay, startOfWeek } from '../calendar/date-utils';

export type CalendarView = 'DAY' | 'WEEK' | 'MONTH';
const STATUS_STYLES: Record<AppointmentStatus, string> = {
  SCHEDULED: 'border-border-strong bg-muted text-text', CONFIRMED: 'border-info/30 bg-info-subtle text-info-strong',
  IN_SERVICE: 'border-primary/30 bg-primary-subtle text-primary-strong', COMPLETED: 'border-success/30 bg-success-subtle text-success-strong',
  CANCELLED: 'border-border bg-surface text-text-muted line-through', NO_SHOW: 'border-danger/30 bg-danger-subtle text-danger-strong',
};
const dayLabel = (date: Date) => date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function AppointmentCalendar({ date, view, items, loading, onSelect, onCreate }: {
  date: Date; view: CalendarView; items: AppointmentResponse[]; loading: boolean;
  onSelect: (item: AppointmentResponse) => void; onCreate: (date: Date) => void;
}) {
  const [focusedDay, setFocusedDay] = useState(date.toDateString());
  const start = view === 'MONTH' ? startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1)) : view === 'DAY' ? startOfDay(date) : startOfWeek(date);
  const days = Array.from({ length: view === 'MONTH' ? 42 : view === 'WEEK' ? 7 : 1 }, (_, index) => addDays(start, index));
  const previousIndex = days.findIndex((day) => day.toDateString() === focusedDay);
  const activeIndex = previousIndex >= 0 ? previousIndex : Math.max(0, days.findIndex((day) => sameDay(day, date)));
  const columns = view === 'DAY' ? 1 : 7;

  function dayKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.altKey || event.nativeEvent.isComposing) return;
    let next = index;
    if (event.key === 'ArrowRight') next++;
    else if (event.key === 'ArrowLeft') next--;
    else if (event.key === 'ArrowDown') next += columns;
    else if (event.key === 'ArrowUp') next -= columns;
    else if (event.key === 'Home') next = event.ctrlKey || event.metaKey ? 0 : index - index % columns;
    else if (event.key === 'End') next = event.ctrlKey || event.metaKey ? days.length - 1 : Math.min(days.length - 1, index - index % columns + columns - 1);
    else return;
    event.preventDefault();
    if (next < 0 || next >= days.length) return;
    const controls = event.currentTarget.closest('[data-calendar]')?.querySelectorAll<HTMLButtonElement>('[data-calendar-day]');
    controls?.[next]?.focus();
  }
  if (loading) return <div className="h-[32rem] animate-pulse rounded-card border border-border bg-muted" role="status" aria-label="Carregando agenda" />;
  return <div data-calendar role="group" aria-label={view === 'MONTH' ? 'Agenda mensal' : view === 'WEEK' ? 'Agenda semanal' : 'Agenda do dia'} className="overflow-hidden rounded-card border border-border bg-card">
    <p className="border-b border-border px-3 py-2 text-xs text-text-muted">Use as setas para mudar de dia, Home/End para os limites da semana e Tab para acessar os agendamentos. Enter ou Espaço ativa o controle selecionado.</p>
    <div className={`grid ${view === 'DAY' ? 'grid-cols-1' : 'grid-cols-7'}`}>
      {days.map((day, index) => {
        const dayItems = items.filter((item) => sameDay(new Date(item.startsAt), day));
        return <section key={day.toISOString()} aria-label={dayLabel(day)} className={`min-w-0 border-b border-r border-border p-2 ${view === 'MONTH' ? 'min-h-28' : 'min-h-[30rem]'}`}>
          <button type="button" data-calendar-day tabIndex={index === activeIndex ? 0 : -1} aria-label={`Novo agendamento em ${dayLabel(day)}`} aria-current={sameDay(day, new Date()) ? 'date' : undefined} onFocus={() => setFocusedDay(day.toDateString())} onKeyDown={(event) => dayKeys(event, index)} onClick={() => { const selected = new Date(day); selected.setHours(8, 0, 0, 0); onCreate(selected); }} className="flex min-h-10 w-full flex-col items-center justify-center gap-1 rounded-button p-1 text-center hover:bg-surface">
            <span className="text-[10px] font-semibold uppercase text-text-muted">{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
            <span className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ${sameDay(day, new Date()) ? 'bg-primary text-primary-foreground' : day.getMonth() === date.getMonth() ? 'text-text' : 'text-text-muted'}`}>{day.getDate()}</span>
            <span className="text-[10px] font-semibold text-primary">+ Horário</span>
          </button>
          <div className={`mt-2 space-y-2 ${view === 'MONTH' ? 'max-h-40 overflow-y-auto p-1' : ''}`}>
            {dayItems.map((item) => <Event key={item.id} item={item} onSelect={onSelect} compact={view === 'MONTH'} />)}
            {!dayItems.length && <span className="block p-2 text-center text-xs text-text-muted">Livre</span>}
          </div>
        </section>;
      })}
    </div>
  </div>;
}

function Event({ item, onSelect, compact = false }: { item: AppointmentResponse; onSelect: (item: AppointmentResponse) => void; compact?: boolean }) {
  const time = new Date(item.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return <button type="button" aria-label={`Abrir agendamento de ${item.customerName}, ${time}, ${item.vehiclePlate}, ${item.serviceDescription}`} onClick={() => onSelect(item)} className={`block w-full rounded-button border p-2 text-left text-xs ${STATUS_STYLES[item.status]}`}>
    <span className="font-bold">{time} {!compact && item.customerName}</span>
    {!compact && <><span className="mt-0.5 block truncate">{item.vehiclePlate} · {item.serviceDescription}</span><span className="mt-1 block truncate opacity-75">{item.technicianName ?? 'Sem técnico'}</span></>}
    {compact && <span className="block truncate">{item.customerName}</span>}
  </button>;
}
