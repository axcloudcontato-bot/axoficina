'use client';

import { useState } from 'react';
import type { AgendaHours, DayHours } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SpecialDates = Pick<AgendaHours, 'openHour' | 'closeHour' | 'closedDates' | 'dateHours'>;
const label = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const selectClass = 'h-10 rounded-button border border-input bg-background px-3 text-sm';

export function SpecialDatesEditor({ hours, onChange }: { hours: SpecialDates; onChange: (next: Pick<AgendaHours, 'closedDates' | 'dateHours'>) => void }) {
  const [date, setDate] = useState('');
  const [mode, setMode] = useState<'closed' | 'hours'>('closed');
  const [openHour, setOpenHour] = useState(hours.openHour);
  const [closeHour, setCloseHour] = useState(hours.closeHour);
  const closedDates = hours.closedDates ?? [];
  const dateHours = hours.dateHours ?? {};
  const used = new Set([...closedDates, ...Object.keys(dateHours)]);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
  const canAdd = validDate && !used.has(date) && used.size < 60 && (mode === 'closed' || openHour < closeHour);

  function add() {
    if (!canAdd) return;
    if (mode === 'closed') onChange({ closedDates: [...closedDates, date], dateHours });
    else onChange({ closedDates, dateHours: { ...dateHours, [date]: { openHour, closeHour } } });
    setDate('');
  }
  function remove(value: string) {
    const nextHours = { ...dateHours };
    delete nextHours[value];
    onChange({ closedDates: closedDates.filter((item) => item !== value), dateHours: nextHours });
  }
  function setDateHour(value: string, next: DayHours) {
    onChange({ closedDates, dateHours: { ...dateHours, [value]: next } });
  }

  return <fieldset className="space-y-3"><legend className="text-sm font-semibold">Feriados e datas especiais</legend>
    <p className="text-xs text-text-muted">Escolha uma data para fechar ou abrir em horário diferente, inclusive em um dia normalmente fechado. Cadastre cada feriado desejado.</p>
    <div className="flex flex-wrap items-end gap-2">
      <label className="space-y-1 text-sm"><span className="block">Data</span><Input type="date" aria-label="Data especial" value={date} onChange={(event) => setDate(event.target.value)} className="w-44" /></label>
      <label className="space-y-1 text-sm"><span className="block">Nessa data</span><select aria-label="Funcionamento na data" className={selectClass} value={mode} onChange={(event) => setMode(event.target.value as 'closed' | 'hours')}><option value="closed">Fechado</option><option value="hours">Horário especial</option></select></label>
      {mode === 'hours' && <><label className="space-y-1 text-sm"><span className="block">Abre às</span><select aria-label="Data especial: abre às" className={selectClass} value={openHour} onChange={(event) => setOpenHour(Number(event.target.value))}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{label(hour)}</option>)}</select></label><label className="space-y-1 text-sm"><span className="block">Fecha às</span><select aria-label="Data especial: fecha às" className={selectClass} value={closeHour} onChange={(event) => setCloseHour(Number(event.target.value))}>{Array.from({ length: 24 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{label(hour)}</option>)}</select></label></>}
      <Button type="button" variant="outline" size="sm" disabled={!canAdd} onClick={add}>Adicionar data</Button>
    </div>
    {used.size > 0 && <ul className="space-y-2">{[...used].sort().map((value) => { const own = dateHours[value]; return <li key={value} className="flex flex-wrap items-center gap-2 rounded-button border border-border px-3 py-2 text-sm"><strong>{new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR')}</strong>{own ? <><select aria-label={`${value}: abre às`} className={selectClass} value={own.openHour} onChange={(event) => setDateHour(value, { ...own, openHour: Number(event.target.value) })}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{label(hour)}</option>)}</select><span>às</span><select aria-label={`${value}: fecha às`} className={selectClass} value={own.closeHour} onChange={(event) => setDateHour(value, { ...own, closeHour: Number(event.target.value) })}>{Array.from({ length: 24 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{label(hour)}</option>)}</select></> : <span>Fechado</span>}<button type="button" className="ml-auto text-xs font-semibold text-danger" aria-label={`Remover ${value}`} onClick={() => remove(value)}>Remover</button></li>; })}</ul>}
    {Object.entries(dateHours).some(([, value]) => value.openHour >= value.closeHour) && <p role="alert" className="text-xs text-danger">Em cada data, o fechamento deve ser depois da abertura.</p>}
  </fieldset>;
}
