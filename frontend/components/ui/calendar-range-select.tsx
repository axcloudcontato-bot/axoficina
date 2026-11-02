'use client';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarBlank } from '@phosphor-icons/react';
import type { DateRange } from 'react-day-picker';

const Calendar = React.lazy(() => import('@/components/ui/calendar').then((module) => ({ default: module.Calendar })));

const parseDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : undefined;
const ymd = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const label = (value: string) => parseDate(value)?.toLocaleDateString('pt-BR') ?? '…';

export function CalendarRangeSelect({ from, to, onChange, disabled = false }: { from: string; to: string; onChange: (from: string, to: string) => void; disabled?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const selected: DateRange | undefined = from ? { from: parseDate(from), to: parseDate(to) } : undefined;
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild><button type="button" disabled={disabled} aria-label="Selecionar período no calendário" className="flex h-10 w-full items-center gap-2 rounded-button border border-input bg-background px-3 text-left text-sm text-foreground hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"><CalendarBlank className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="truncate">{from ? `${label(from)} — ${to ? label(to) : 'escolha o fim'}` : 'Selecionar período'}</span></button></Popover.Trigger>
    <Popover.Portal><Popover.Content sideOffset={6} align="start" collisionPadding={12} className="z-[100] max-w-[calc(100vw-24px)] overflow-auto rounded-lg border border-border bg-popover p-1 shadow-popover focus:outline-none">
      <React.Suspense fallback={<p className="p-5 text-sm text-muted-foreground">Carregando calendário...</p>}><Calendar mode="range" selected={selected} defaultMonth={selected?.from ?? new Date()} onSelect={(range) => { onChange(range?.from ? ymd(range.from) : '', range?.to ? ymd(range.to) : ''); if (range?.from && range.to) setOpen(false); }} resetOnSelect captionLayout="dropdown" startMonth={new Date(2000, 0)} endMonth={new Date(2100, 11)} /></React.Suspense>
      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground"><span>Escolha a data inicial e a final.</span><button type="button" className="font-semibold text-foreground hover:underline" onClick={() => { onChange('', ''); setOpen(false); }}>Limpar</button></div>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
