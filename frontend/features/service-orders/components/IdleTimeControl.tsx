'use client';

import { useState } from 'react';
import { Pause } from '@phosphor-icons/react';
import type { IdleReason } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/api/client';
import { useIdleAction, useMyIdle } from '../hooks/use-service-orders';

export const IDLE_REASON_LABELS: Record<IdleReason, string> = {
  WAITING_PARTS: 'Esperando peça',
  CLEANING: 'Limpeza e organização',
  ERRANDS: 'Deslocamento ou busca de peça',
  TRAINING: 'Treinamento',
  OTHER: 'Outro',
};
const selectClass = 'h-9 rounded-button border border-input bg-background px-3 text-sm';
const duration = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`;

// Time at work but not on an order. Starting work on an order ends it on its own.
export function IdleTimeControl() {
  const query = useMyIdle();
  const action = useIdleAction();
  const [reason, setReason] = useState<IdleReason>('WAITING_PARTS');
  const open = query.data?.open;
  const today = (query.data?.today ?? []).reduce((sum, entry) => sum + entry.minutes, 0);
  return <section aria-label="Tempo parado" className="rounded-card border border-border bg-card p-4 text-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 font-bold text-text"><Pause className="size-4 text-text-muted" aria-hidden="true" />Tempo parado</h3><p className="mt-1 text-xs text-text-muted">Quando não estiver em uma OS: esperando peça, limpando, buscando peça. Ao iniciar trabalho em uma OS, ele para sozinho.</p></div>
      {today > 0 && <p className="text-xs text-text-muted">Hoje: <strong className="tabular-nums text-text">{duration(today)}</strong></p>}
    </div>
    {open ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-card bg-warning/5 p-3"><span><strong>{IDLE_REASON_LABELS[open.reason as IdleReason] ?? open.reason}</strong> desde {new Date(open.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {duration(open.minutes)}</span><Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate(null)}>{action.isPending ? 'Salvando…' : 'Encerrar tempo parado'}</Button></div>
      : <div className="mt-3 flex flex-wrap items-end gap-2"><label className="space-y-1 text-xs font-semibold"><span className="block">Motivo</span><select className={selectClass} value={reason} onChange={event => setReason(event.target.value as IdleReason)}>{Object.entries(IDLE_REASON_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><Button size="sm" variant="outline" disabled={action.isPending || query.isLoading} onClick={() => action.mutate({ reason })}>{action.isPending ? 'Salvando…' : 'Iniciar tempo parado'}</Button></div>}
    {action.isError && <p className="mt-2 text-danger-strong">{extractErrorMessage(action.error)}</p>}
  </section>;
}
