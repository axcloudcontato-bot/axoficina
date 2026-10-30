'use client';

import { useEffect, useState, type DragEvent, type KeyboardEvent } from 'react';
import { agendaSpan, hoursOn, localYmd } from '@oficina/contracts';
import { DEFAULT_AGENDA_HOURS, type AgendaHours, type AppointmentResponse, type AppointmentStatus } from '@oficina/contracts';
import { addDays, sameDay, startOfDay, startOfWeek } from '../calendar/date-utils';
import { placeDay, SLOT_MINUTES, slotsOf } from '../calendar/time-grid';

export type CalendarView = 'DAY' | 'WEEK' | 'MONTH';
const STATUS_STYLES: Record<AppointmentStatus, string> = {
  SCHEDULED: 'border-border-strong bg-muted text-text', CONFIRMED: 'border-info/30 bg-info-subtle text-info-strong',
  IN_SERVICE: 'border-primary/30 bg-primary-subtle text-primary-strong', COMPLETED: 'border-success/30 bg-success-subtle text-success-strong',
  CANCELLED: 'border-border bg-surface text-text-muted line-through', NO_SHOW: 'border-danger/30 bg-danger-subtle text-danger-strong',
};
const MOVABLE: AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED'];
const ROW_REM = 1.75;
const dayLabel = (date: Date) => date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeLabel = (hour: number, minute: number) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

export function AppointmentCalendar({ date, view, items, loading, onSelect, onCreate, onMove, hours = DEFAULT_AGENDA_HOURS }: {
  date: Date; view: CalendarView; items: AppointmentResponse[]; loading: boolean;
  onSelect: (item: AppointmentResponse) => void; onCreate: (date: Date) => void;
  onMove?: (item: AppointmentResponse, startsAt: Date) => void; hours?: AgendaHours;
}) {
  if (loading) return <div className="h-[32rem] animate-pulse rounded-card border border-border bg-muted" role="status" aria-label="Carregando agenda" />;
  if (view === 'MONTH') return <MonthCalendar date={date} items={items} onSelect={onSelect} onCreate={onCreate} hours={hours} />;
  return <TimeGrid date={date} view={view} items={items} onSelect={onSelect} onCreate={onCreate} onMove={onMove} hours={hours} />;
}

// Day and week: a real time grid, so gaps, durations and overlaps are visible.
function TimeGrid({ date, view, items, onSelect, onCreate, onMove, hours }: {
  date: Date; view: 'DAY' | 'WEEK'; items: AppointmentResponse[]; hours: AgendaHours;
  onSelect: (item: AppointmentResponse) => void; onCreate: (date: Date) => void; onMove?: (item: AppointmentResponse, startsAt: Date) => void;
}) {
  const [dragged, setDragged] = useState<AppointmentResponse>();
  const [dropTarget, setDropTarget] = useState<string>();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const slots = slotsOf(hours);
  const allDays = view === 'DAY' ? [startOfDay(date)] : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(date), index));
  // Closed days disappear from the week unless something is booked on them.
  const isOpen = (day: Date) => Boolean(hoursOn(hours, day.getDay(), localYmd(day)));
  const days = view === 'DAY' ? allDays : allDays.filter((day) => isOpen(day) || items.some((item) => sameDay(new Date(item.startsAt), day)));
  const height = `${slots.length * ROW_REM}rem`;
  const grid = agendaSpan(hours);
  const span = (grid.closeHour - grid.openHour) * 60;
  const nowOffset = (now.getHours() * 60 + now.getMinutes() - grid.openHour * 60) / span;

  function slotDate(day: Date, hour: number, minute: number) { const value = new Date(day); value.setHours(hour, minute, 0, 0); return value; }
  function drop(event: DragEvent<HTMLElement>, target: Date) {
    event.preventDefault(); setDropTarget(undefined);
    if (dragged && onMove && target.getTime() !== Date.parse(dragged.startsAt)) onMove(dragged, target);
    setDragged(undefined);
  }

  return <div data-calendar role="group" aria-label={view === 'WEEK' ? 'Agenda semanal' : 'Agenda do dia'} className="overflow-x-auto rounded-card border border-border bg-card">
    <p className="sr-only">Cada dia tem um botão para novo agendamento e cada agendamento é um botão. {onMove ? 'Arraste um agendamento para outro horário para remarcar.' : ''}</p>
    <div className={view === 'WEEK' ? 'min-w-[44rem]' : ''}>
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <span aria-hidden="true" />
        {days.map((day) => <button key={day.toISOString()} type="button" data-calendar-day aria-label={`Novo agendamento em ${dayLabel(day)}`} aria-current={sameDay(day, new Date()) ? 'date' : undefined} onClick={() => onCreate(slotDate(day, hours.openHour, 0))} className="flex flex-col items-center gap-0.5 border-l border-border px-1 py-2 hover:bg-surface">
          <span className="text-[10px] font-semibold uppercase text-text-muted">{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
          <span className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ${sameDay(day, new Date()) ? 'bg-primary text-primary-foreground' : 'text-text'}`}>{day.getDate()}</span>
          {!isOpen(day) && <span className="text-[10px] text-text-muted">{hours.closedDates?.includes(localYmd(day)) ? 'feriado/folga' : 'fechado'}</span>}
        </button>)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <div aria-hidden="true" className="relative" style={{ height }}>{slots.map((slot, index) => slot.minute === 0 && <span key={index} className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-text-muted" style={{ top: `${index * ROW_REM}rem` }}>{timeLabel(slot.hour, 0)}</span>)}</div>
        {days.map((day) => {
          const placed = placeDay(items.filter((item) => sameDay(new Date(item.startsAt), day)), day, hours);
          return <section key={day.toISOString()} aria-label={dayLabel(day)} className="relative border-l border-border" style={{ height }}>
            {slots.map((slot) => {
              const target = slotDate(day, slot.hour, slot.minute); const key = target.toISOString();
              return <button key={key} type="button" tabIndex={-1} aria-label={`Agendar em ${dayLabel(day)} às ${timeLabel(slot.hour, slot.minute)}`} onClick={() => onCreate(target)}
                onDragOver={(event) => { if (dragged) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(key); } }} onDragLeave={() => setDropTarget((current) => current === key ? undefined : current)} onDrop={(event) => drop(event, target)}
                className={`block w-full border-t ${slot.minute === 0 ? 'border-border' : 'border-dashed border-border/60'} hover:bg-selection/40 ${dropTarget === key ? 'bg-primary/15' : ''}`} style={{ height: `${ROW_REM}rem` }} />;
            })}
            {sameDay(day, now) && nowOffset >= 0 && nowOffset <= 1 && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger" style={{ top: `${nowOffset * 100}%` }} />}
            {placed.map(({ item, top, height: size, lane, lanes, outsideHours }) => {
              const movable = Boolean(onMove) && MOVABLE.includes(item.status);
              return <div key={item.id} className="absolute z-20 p-0.5" style={{ top: `${top * 100}%`, height: `${size * 100}%`, left: `${(lane / lanes) * 100}%`, width: `${100 / lanes}%` }}>
                <Event item={item} onSelect={onSelect} outsideHours={outsideHours} className="h-full overflow-hidden" draggable={movable}
                  onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); setDragged(item); }} onDragEnd={() => { setDragged(undefined); setDropTarget(undefined); }} />
              </div>;
            })}
          </section>;
        })}
      </div>
    </div>
    {onMove && <p className="border-t border-border px-3 py-2 text-[11px] text-text-muted">Clique num horário livre para agendar. Arraste um agendamento para remarcar; a duração é mantida. Cada linha vale {SLOT_MINUTES} minutos.</p>}
  </div>;
}

function MonthCalendar({ date, items, onSelect, onCreate, hours }: { date: Date; items: AppointmentResponse[]; onSelect: (item: AppointmentResponse) => void; onCreate: (date: Date) => void; hours: AgendaHours }) {
  const [focusedDay, setFocusedDay] = useState(date.toDateString());
  const start = startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const previousIndex = days.findIndex((day) => day.toDateString() === focusedDay);
  const activeIndex = previousIndex >= 0 ? previousIndex : Math.max(0, days.findIndex((day) => sameDay(day, date)));
  const columns = 7;

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
  return <div data-calendar role="group" aria-label="Agenda mensal" className="overflow-hidden rounded-card border border-border bg-card">
    <p className="sr-only">Use as setas para mudar de dia, Home/End para os limites da semana e Tab para acessar os agendamentos. Enter ou Espaço ativa o controle selecionado.</p>
    <div className="grid grid-cols-7">
      {days.map((day, index) => {
        const dayItems = items.filter((item) => sameDay(new Date(item.startsAt), day));
        const outside = day.getMonth() !== date.getMonth();
        return <section key={day.toISOString()} aria-label={dayLabel(day)} className={`min-h-28 min-w-0 border-b border-r border-border p-1.5 ${outside ? 'bg-surface/50' : ''}`}>
          <button type="button" data-calendar-day tabIndex={index === activeIndex ? 0 : -1} aria-label={`Novo agendamento em ${dayLabel(day)}`} aria-current={sameDay(day, new Date()) ? 'date' : undefined} onFocus={() => setFocusedDay(day.toDateString())} onKeyDown={(event) => dayKeys(event, index)} onClick={() => { const selected = new Date(day); selected.setHours(hours.openHour, 0, 0, 0); onCreate(selected); }} className="flex w-full items-center justify-between rounded-button px-1 py-0.5 hover:bg-surface">
            <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ${sameDay(day, new Date()) ? 'bg-primary text-primary-foreground' : outside ? 'text-text-muted' : 'text-text'}`}>{day.getDate()}</span>
            {dayItems.length > 0 && <span className="text-[10px] font-semibold text-text-muted">{dayItems.length}</span>}
          </button>
          <div className="mt-1 max-h-40 space-y-1 overflow-y-auto p-0.5">
            {dayItems.map((item) => <Event key={item.id} item={item} onSelect={onSelect} compact />)}
          </div>
        </section>;
      })}
    </div>
  </div>;
}

function Event({ item, onSelect, compact = false, outsideHours = false, className = '', draggable = false, onDragStart, onDragEnd }: {
  item: AppointmentResponse; onSelect: (item: AppointmentResponse) => void; compact?: boolean; outsideHours?: boolean; className?: string;
  draggable?: boolean; onDragStart?: (event: DragEvent<HTMLButtonElement>) => void; onDragEnd?: () => void;
}) {
  const time = new Date(item.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const end = new Date(item.endsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return <button type="button" draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd} aria-label={`Abrir agendamento de ${item.customerName}, ${time}, ${item.vehiclePlate}, ${item.serviceDescription}`} onClick={() => onSelect(item)} className={`block w-full rounded-button border p-1.5 text-left text-xs shadow-sm ${STATUS_STYLES[item.status]} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`}>
    <span className="font-bold">{time}{!compact && `–${end}`} {!compact && item.customerName}</span>
    {!compact && <><span className="block truncate">{item.vehiclePlate} · {item.serviceDescription}</span><span className="block truncate opacity-75">{item.technicianName ?? 'Sem técnico'}{outsideHours ? ' · fora do horário' : ''}</span></>}
    {compact && <span className="block truncate">{item.customerName}</span>}
  </button>;
}
