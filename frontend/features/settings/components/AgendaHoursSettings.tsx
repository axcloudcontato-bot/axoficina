'use client';

import { useEffect, useState } from 'react';
import { Clock, FloppyDisk } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { AgendaHours } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/api/client';
import { useBranding, useUpdateAgendaHours } from '../hooks/use-settings';
import { useUnsavedSettings } from '../hooks/use-unsaved-settings';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { DEFAULT_AGENDA_HOURS } from '@oficina/contracts';

const DAYS = [{ value: 1, label: 'Seg' }, { value: 2, label: 'Ter' }, { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' }, { value: 0, label: 'Dom' }];
const selectClass = 'h-10 rounded-button border border-input bg-background px-3 text-sm';

export function AgendaHoursSettings() {
  const branding = useBranding();
  const saved = branding.data?.agendaHours ?? DEFAULT_AGENDA_HOURS;
  const update = useUpdateAgendaHours();
  const user = useAuthStore((state) => state.user);
  const canManage = hasPermission(user, 'settings.manage');
  const [hours, setHours] = useState<AgendaHours>(saved);
  const savedKey = `${saved.openHour}-${saved.closeHour}-${saved.workDays.join(',')}-${saved.bays ?? ''}-${saved.remindersEnabled}`;
  useEffect(() => setHours(saved), [savedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = `${hours.openHour}-${hours.closeHour}-${[...hours.workDays].sort().join(',')}-${hours.bays ?? ''}-${Boolean(hours.remindersEnabled)}` !== `${saved.openHour}-${saved.closeHour}-${[...saved.workDays].sort().join(',')}-${saved.bays ?? ''}-${Boolean(saved.remindersEnabled)}`;
  useUnsavedSettings(dirty && !update.isPending);
  const invalid = hours.openHour >= hours.closeHour || hours.workDays.length === 0 || (hours.bays != null && (hours.bays < 1 || hours.bays > 100));

  function toggle(day: number) {
    setHours((current) => ({ ...current, workDays: current.workDays.includes(day) ? current.workDays.filter((value) => value !== day) : [...current.workDays, day] }));
  }
  function save() {
    if (!canManage || !branding.data) return;
    update.mutate({ openHour: hours.openHour, closeHour: hours.closeHour, workDays: hours.workDays, bays: hours.bays ?? null, remindersEnabled: Boolean(hours.remindersEnabled) }, {
      onSuccess: () => toast.success('Horário de funcionamento atualizado.'),
      onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível salvar o horário.')),
    });
  }

  if (branding.isPending) return <div role="status" className="h-48 animate-pulse rounded-card bg-muted" />;
  if (branding.isError || !branding.data) return <div role="alert" className="rounded-card border border-danger/30 p-6">Não foi possível carregar as regras da agenda. <Button variant="outline" onClick={() => branding.refetch()}>Tentar novamente</Button></div>;
  return <fieldset disabled={!canManage || update.isPending} className="rounded-card border border-border bg-card p-5 shadow-sm">
    <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-button bg-primary/10 text-primary"><Clock className="size-5" aria-hidden="true" /></span><div><h3 className="text-lg font-bold">Horário de funcionamento</h3><p className="mt-1 text-sm text-text-muted">Define a grade da Agenda e avisa quando um agendamento cai fora do expediente.</p></div></div>
    <div className="mt-4 flex flex-wrap items-end gap-4">
      <label className="space-y-1.5 text-sm font-semibold"><span className="block">Abre às</span><select className={selectClass} value={hours.openHour} onChange={(event) => setHours((current) => ({ ...current, openHour: Number(event.target.value) }))}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}</select></label>
      <label className="space-y-1.5 text-sm font-semibold"><span className="block">Fecha às</span><select className={selectClass} value={hours.closeHour} onChange={(event) => setHours((current) => ({ ...current, closeHour: Number(event.target.value) }))}>{Array.from({ length: 24 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}</select></label>
      <fieldset><legend className="mb-1.5 text-sm font-semibold">Dias de funcionamento</legend><div className="flex flex-wrap gap-1">{DAYS.map((day) => <label key={day.value} className={`cursor-pointer rounded-button border px-3 py-2 text-sm font-semibold ${hours.workDays.includes(day.value) ? 'border-primary/40 bg-selection text-primary' : 'border-border text-text-muted'}`}><input type="checkbox" className="sr-only" checked={hours.workDays.includes(day.value)} onChange={() => toggle(day.value)} />{day.label}</label>)}</div></fieldset>
    </div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="space-y-1.5 text-sm font-semibold"><span className="block">Carros atendidos ao mesmo tempo</span><input type="number" min={1} max={100} inputMode="numeric" className={`${selectClass} w-32`} placeholder="Sem limite" value={hours.bays ?? ''} onChange={(event) => setHours((current) => ({ ...current, bays: event.target.value === '' ? null : Number(event.target.value) }))} /><span className="block text-xs font-normal text-text-muted">Boxes ou elevadores. A Agenda avisa quando um horário passa disso.</span></label>
      <label className="flex cursor-pointer items-start gap-3 rounded-button border border-border p-3"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={Boolean(hours.remindersEnabled)} disabled={!branding.data.whatsappEnabled && !hours.remindersEnabled} onChange={(event) => setHours((current) => ({ ...current, remindersEnabled: event.target.checked }))} /><span><span className="block text-sm font-semibold">Lembrete por WhatsApp na véspera</span><span className="mt-0.5 block text-xs text-text-muted">Enviado uma vez, entre 24 e 2 horas antes, das 8h às 20h. Precisa do WhatsApp da oficina ativo.</span>{!branding.data.whatsappEnabled && <span className="mt-1 block text-xs text-danger">Ative o WhatsApp em Configurações para usar esta opção.</span>}</span></label>
    </div>
    {invalid && <p role="alert" className="mt-3 text-sm text-danger">{hours.workDays.length === 0 ? 'Escolha ao menos um dia.' : hours.bays != null && (hours.bays < 1 || hours.bays > 100) ? 'Informe de 1 a 100 carros simultâneos.' : 'O fechamento deve ser depois da abertura.'}</p>}
    {!canManage && <p className="mt-3 text-sm text-text-muted">Seu perfil permite consultar este horário, mas não alterá-lo.</p>}
    {canManage && <div className="mt-4 flex justify-end"><Button onClick={save} disabled={!dirty || invalid || update.isPending}><FloppyDisk className="size-4" />{update.isPending ? 'Salvando...' : 'Salvar horário'}</Button></div>}
  </fieldset>;
}
