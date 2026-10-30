'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { hasPermission } from '@/features/auth/permissions';
import { extractErrorMessage } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth-store';
import type { WorkSession } from '../api/service-orders-api';
import { useCorrectWorkSession, useWorkSessionAction, useWorkSessions } from '../hooks/use-service-orders';

// datetime-local works in the workshop's time (São Paulo, UTC-3 all year).
const toLocalInput = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 16);
const fromLocalInput = (value: string) => new Date(`${value}:00-03:00`).toISOString();
const duration = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min` : `${minutes} min`;

export function ServiceOrderWorkSessions({ serviceOrderId, status }: { serviceOrderId: string; status: string }) {
  const user = useAuthStore(state => state.user);
  const query = useWorkSessions(serviceOrderId);
  const action = useWorkSessionAction(serviceOrderId);
  const [editing, setEditing] = useState<WorkSession | null>(null);
  const sessions = query.data?.sessions ?? [];
  const mine = sessions.find(session => session.technicianId === user?.id && !session.endedAt);
  const canCorrect = (user?.role === 'ADMIN' || user?.role === 'MANAGER') && hasPermission(user, 'service_orders.prices');
  return <section className="rounded-card border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-text">Tempo de trabalho</h3><p className="text-xs text-text-muted">Cada técnico registra seu tempo na OS. O registro é encerrado ao pausar ou concluir e conta no máximo até o fechamento da oficina.</p></div>
      {user?.role === 'MECHANIC' && status === 'IN_PROGRESS' && <Button size="sm" variant={mine ? 'outline' : 'default'} disabled={action.isPending || query.isLoading} onClick={() => action.mutate(mine ? 'stop' : 'start')}>{action.isPending ? 'Salvando…' : mine ? 'Encerrar meu trabalho' : 'Iniciar meu trabalho'}</Button>}
    </div>
    {query.isError && <p className="mt-3 text-sm text-danger-strong">Não foi possível carregar os registros. <button className="underline" onClick={() => query.refetch()}>Tentar novamente</button></p>}
    {action.isError && <p className="mt-3 text-sm text-danger-strong">{extractErrorMessage(action.error)}</p>}
    {!query.isLoading && !query.isError && <div className="mt-3 space-y-2 text-sm">{sessions.length ? sessions.map(session => <div key={session.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
      <span className="font-medium">{session.technicianName}{!session.endedAt ? ' · em trabalho' : ''}</span>
      <span className="flex flex-wrap items-center gap-2 tabular-nums text-text-muted">{new Date(session.startedAt).toLocaleString('pt-BR')} · {session.endedAt ? duration(session.workedMinutes) : session.capped ? `${duration(session.workedMinutes)} até o fechamento` : 'em andamento'}
        {session.capped && <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">Passou do fechamento</span>}
        {canCorrect && <button type="button" className="text-xs font-semibold text-primary-strong underline-offset-2 hover:underline" aria-label={`Corrigir tempo de ${session.technicianName}`} onClick={() => setEditing(session)}>Corrigir</button>}
      </span>
    </div>) : <p className="text-text-muted">Ainda não há tempo de trabalho registrado nesta OS.</p>}</div>}
    {editing && <CorrectSessionDialog key={editing.id} serviceOrderId={serviceOrderId} session={editing} onClose={() => setEditing(null)} />}
  </section>;
}

function CorrectSessionDialog({ serviceOrderId, session, onClose }: { serviceOrderId: string; session: WorkSession; onClose: () => void }) {
  const correct = useCorrectWorkSession(serviceOrderId);
  const [startedAt, setStartedAt] = useState(toLocalInput(session.startedAt));
  const [endedAt, setEndedAt] = useState(session.endedAt ? toLocalInput(session.endedAt) : '');
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 5;
  const submit = (remove: boolean) => {
    if (correct.isPending || !valid) return;
    correct.mutate(remove ? { sessionId: session.id, remove: true, reason } : { sessionId: session.id, startedAt: fromLocalInput(startedAt), endedAt: endedAt ? fromLocalInput(endedAt) : undefined, reason }, { onSuccess: onClose });
  };
  return <Dialog open onOpenChange={open => { if (!open && !correct.isPending) onClose(); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Corrigir tempo de {session.technicianName}</DialogTitle><DialogDescription>Use quando o técnico esqueceu de encerrar ou registrou errado. Se a OS já foi entregue, a mão de obra dela é redividida pelo tempo corrigido, sem mudar o total. A correção fica no histórico com o motivo.</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); submit(false); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-semibold"><span>Início</span><Input type="datetime-local" value={startedAt} onChange={event => setStartedAt(event.target.value)} /></label>
        <label className="block space-y-1 text-sm font-semibold"><span>Fim</span><Input type="datetime-local" value={endedAt} onChange={event => setEndedAt(event.target.value)} /></label>
      </div>
      <label className="block space-y-1 text-sm font-semibold"><span>Motivo da correção</span><Input value={reason} maxLength={300} placeholder="Ex.: esqueceu o cronômetro ligado" onChange={event => setReason(event.target.value)} /></label>
      {correct.isError && <p className="text-sm text-danger-strong">{extractErrorMessage(correct.error)}</p>}
      <div className="flex flex-wrap justify-between gap-2"><Button type="button" variant="outline" className="text-danger-strong" disabled={correct.isPending || !valid} onClick={() => submit(true)}>Excluir registro</Button><div className="flex gap-2"><Button type="button" variant="outline" disabled={correct.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={correct.isPending || !valid || !startedAt || !endedAt}>{correct.isPending ? 'Salvando…' : 'Salvar correção'}</Button></div></div>
    </form></DialogContent></Dialog>;
}
