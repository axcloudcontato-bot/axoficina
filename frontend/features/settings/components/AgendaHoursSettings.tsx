'use client';

import { useEffect, useState } from 'react';
import { Clock, FloppyDisk, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { AgendaHours } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { extractErrorMessage } from '@/lib/api/client';
import { useBranding, useUpdateAgendaHours } from '../hooks/use-settings';
import { useUnsavedSettings } from '../hooks/use-unsaved-settings';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { DEFAULT_AGENDA_HOURS } from '@oficina/contracts';

const DAYS = [{ value: 1, label: 'Seg', name: 'Segunda' }, { value: 2, label: 'Ter', name: 'Terça' }, { value: 3, label: 'Qua', name: 'Quarta' }, { value: 4, label: 'Qui', name: 'Quinta' }, { value: 5, label: 'Sex', name: 'Sexta' }, { value: 6, label: 'Sáb', name: 'Sábado' }, { value: 0, label: 'Dom', name: 'Domingo' }];
const selectClass = 'h-10 rounded-button border border-input bg-background px-3 text-sm';
const HOURS = Array.from({ length: 25 }, (_, hour) => hour);
const label = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
// Only what the server keeps: hours of their own for work days, closed dates in order.
const normalize = (hours: AgendaHours) => JSON.stringify({ openHour: hours.openHour, closeHour: hours.closeHour, workDays: [...hours.workDays].sort(), bays: hours.bays ?? null, remindersEnabled: Boolean(hours.remindersEnabled), dayHours: Object.fromEntries(Object.entries(hours.dayHours ?? {}).filter(([day, value]) => hours.workDays.includes(Number(day)) && (value.openHour !== hours.openHour || value.closeHour !== hours.closeHour)).sort()), closedDates: [...(hours.closedDates ?? [])].sort() });

export function AgendaHoursSettings() {
  const branding = useBranding();
  const saved = branding.data?.agendaHours ?? DEFAULT_AGENDA_HOURS;
  const update = useUpdateAgendaHours();
  const user = useAuthStore((state) => state.user);
  const canManage = hasPermission(user, 'settings.manage');
  const [hours, setHours] = useState<AgendaHours>(saved);
  const [newDate, setNewDate] = useState('');
  const savedKey = normalize(saved);
  useEffect(() => setHours(saved), [savedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = normalize(hours) !== savedKey;
  useUnsavedSettings(dirty && !update.isPending);
  const ownHours = Object.entries(hours.dayHours ?? {}).filter(([day]) => hours.workDays.includes(Number(day)));
  const invalidDay = ownHours.find(([, value]) => value.openHour >= value.closeHour);
  const invalid = hours.openHour >= hours.closeHour || hours.workDays.length === 0 || (hours.bays != null && (hours.bays < 1 || hours.bays > 100)) || Boolean(invalidDay);
  const today = new Date().toISOString().slice(0, 10);
  const closedDates = [...(hours.closedDates ?? [])].sort();

  function toggle(day: number) {
    setHours((current) => ({ ...current, workDays: current.workDays.includes(day) ? current.workDays.filter((value) => value !== day) : [...current.workDays, day] }));
  }
  function setDay(day: number, value: { openHour: number; closeHour: number } | null) {
    setHours((current) => {
      const next = { ...(current.dayHours ?? {}) };
      if (value) next[String(day)] = value; else delete next[String(day)];
      return { ...current, dayHours: next };
    });
  }
  function addDate() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || closedDates.includes(newDate)) return;
    setHours((current) => ({ ...current, closedDates: [...(current.closedDates ?? []), newDate] }));
    setNewDate('');
  }
  function save() {
    if (!canManage || !branding.data) return;
    const dayHours = Object.fromEntries(ownHours);
    update.mutate({ openHour: hours.openHour, closeHour: hours.closeHour, workDays: hours.workDays, bays: hours.bays ?? null, remindersEnabled: Boolean(hours.remindersEnabled), dayHours, closedDates }, {
      onSuccess: () => toast.success('Horário de funcionamento atualizado.'),
      onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível salvar o horário.')),
    });
  }

  if (branding.isPending) return <div role="status" className="h-48 animate-pulse rounded-card bg-muted" />;
  if (branding.isError || !branding.data) return <div role="alert" className="rounded-card border border-danger/30 p-6">Não foi possível carregar as regras da agenda. <Button variant="outline" onClick={() => branding.refetch()}>Tentar novamente</Button></div>;
  return <fieldset disabled={!canManage || update.isPending} className="rounded-card border border-border bg-card p-5 shadow-sm">
    <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-button bg-primary/10 text-primary"><Clock className="size-5" aria-hidden="true" /></span><div><h3 className="text-lg font-bold">Horário de funcionamento</h3><p className="mt-1 text-sm text-text-muted">Define a grade da Agenda, avisa quando um agendamento cai fora do expediente e marca onde o cronômetro dos técnicos para de contar.</p></div></div>
    <div className="mt-4 flex flex-wrap items-end gap-4">
      <label className="space-y-1.5 text-sm font-semibold"><span className="block">Abre às</span><select className={selectClass} value={hours.openHour} onChange={(event) => setHours((current) => ({ ...current, openHour: Number(event.target.value) }))}>{HOURS.slice(0, 24).map((hour) => <option key={hour} value={hour}>{label(hour)}</option>)}</select></label>
      <label className="space-y-1.5 text-sm font-semibold"><span className="block">Fecha às</span><select className={selectClass} value={hours.closeHour} onChange={(event) => setHours((current) => ({ ...current, closeHour: Number(event.target.value) }))}>{HOURS.slice(1).map((hour) => <option key={hour} value={hour}>{label(hour)}</option>)}</select></label>
      <fieldset><legend className="mb-1.5 text-sm font-semibold">Dias de funcionamento</legend><div className="flex flex-wrap gap-1">{DAYS.map((day) => <label key={day.value} className={`cursor-pointer rounded-button border px-3 py-2 text-sm font-semibold ${hours.workDays.includes(day.value) ? 'border-primary/40 bg-selection text-primary' : 'border-border text-text-muted'}`}><input type="checkbox" className="sr-only" checked={hours.workDays.includes(day.value)} onChange={() => toggle(day.value)} />{day.label}</label>)}</div></fieldset>
    </div>

    <fieldset className="mt-5"><legend className="text-sm font-semibold">Dias com horário diferente</legend><p className="mt-0.5 text-xs text-text-muted">Por exemplo, sábado até o meio-dia. Os outros dias seguem o horário acima.</p>
      <div className="mt-2 space-y-1.5">{DAYS.filter((day) => hours.workDays.includes(day.value)).map((day) => { const own = hours.dayHours?.[String(day.value)]; return <div key={day.value} className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex w-36 cursor-pointer items-center gap-2"><input type="checkbox" className="size-4 accent-primary" checked={Boolean(own)} onChange={(event) => setDay(day.value, event.target.checked ? { openHour: hours.openHour, closeHour: Math.min(hours.closeHour, Math.max(hours.openHour + 1, 12)) } : null)} />{day.name}</label>
        {own ? <><select aria-label={`${day.name}: abre às`} className={selectClass} value={own.openHour} onChange={(event) => setDay(day.value, { ...own, openHour: Number(event.target.value) })}>{HOURS.slice(0, 24).map((hour) => <option key={hour} value={hour}>{label(hour)}</option>)}</select><span className="text-text-muted">às</span><select aria-label={`${day.name}: fecha às`} className={selectClass} value={own.closeHour} onChange={(event) => setDay(day.value, { ...own, closeHour: Number(event.target.value) })}>{HOURS.slice(1).map((hour) => <option key={hour} value={hour}>{label(hour)}</option>)}</select></> : <span className="text-text-muted">{label(hours.openHour)} às {label(hours.closeHour)}</span>}
      </div>; })}</div>
    </fieldset>

    <fieldset className="mt-5"><legend className="text-sm font-semibold">Dias fechados</legend><p className="mt-0.5 text-xs text-text-muted">Feriados, folgas e férias coletivas: a Agenda mostra o dia como fechado e ele não conta na ocupação.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2"><Input type="date" aria-label="Data fechada" className="w-44" min={today} value={newDate} onChange={(event) => setNewDate(event.target.value)} /><Button type="button" variant="outline" size="sm" disabled={!newDate || closedDates.includes(newDate) || closedDates.length >= 60} onClick={addDate}>Adicionar</Button></div>
      {closedDates.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5">{closedDates.map((date) => <li key={date} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${date < today ? 'border-border text-text-muted' : 'border-primary/30 bg-selection text-primary'}`}>{new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}<button type="button" aria-label={`Remover ${new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR')}`} className="rounded-full p-0.5 hover:bg-muted" onClick={() => setHours((current) => ({ ...current, closedDates: (current.closedDates ?? []).filter((value) => value !== date) }))}><X className="size-3" aria-hidden="true" /></button></li>)}</ul>}
    </fieldset>

    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="space-y-1.5 text-sm font-semibold"><span className="block">Carros atendidos ao mesmo tempo</span><input type="number" min={1} max={100} inputMode="numeric" className={`${selectClass} w-32`} placeholder="Sem limite" value={hours.bays ?? ''} onChange={(event) => setHours((current) => ({ ...current, bays: event.target.value === '' ? null : Number(event.target.value) }))} /><span className="block text-xs font-normal text-text-muted">Boxes ou elevadores. A Agenda avisa quando um horário passa disso.</span></label>
      <label className="flex cursor-pointer items-start gap-3 rounded-button border border-border p-3"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={Boolean(hours.remindersEnabled)} disabled={!branding.data.whatsappEnabled && !hours.remindersEnabled} onChange={(event) => setHours((current) => ({ ...current, remindersEnabled: event.target.checked }))} /><span><span className="block text-sm font-semibold">Lembrete por WhatsApp na véspera</span><span className="mt-0.5 block text-xs text-text-muted">Enviado uma vez, entre 24 e 2 horas antes, das 8h às 20h. Precisa do WhatsApp da oficina ativo.</span>{!branding.data.whatsappEnabled && <span className="mt-1 block text-xs text-danger">Ative o WhatsApp em Configurações para usar esta opção.</span>}</span></label>
    </div>
    {invalid && <p role="alert" className="mt-3 text-sm text-danger">{hours.workDays.length === 0 ? 'Escolha ao menos um dia.' : hours.bays != null && (hours.bays < 1 || hours.bays > 100) ? 'Informe de 1 a 100 carros simultâneos.' : invalidDay ? `${DAYS.find((day) => String(day.value) === invalidDay[0])?.name}: o fechamento deve ser depois da abertura.` : 'O fechamento deve ser depois da abertura.'}</p>}
    {!canManage && <p className="mt-3 text-sm text-text-muted">Seu perfil permite consultar este horário, mas não alterá-lo.</p>}
    {canManage && <div className="mt-4 flex justify-end"><Button onClick={save} disabled={!dirty || invalid || update.isPending}><FloppyDisk className="size-4" />{update.isPending ? 'Salvando...' : 'Salvar horário'}</Button></div>}
  </fieldset>;
}
