'use client';

import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { useWorkSessionAction, useWorkSessions } from '../hooks/use-service-orders';

export function ServiceOrderWorkSessions({ serviceOrderId, status }: { serviceOrderId: string; status: string }) {
  const user = useAuthStore(state => state.user);
  const query = useWorkSessions(serviceOrderId);
  const action = useWorkSessionAction(serviceOrderId);
  const sessions = query.data?.sessions ?? [];
  const mine = sessions.find(session => session.technicianId === user?.id && !session.endedAt);
  return <section className="rounded-card border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-text">Tempo de trabalho</h3><p className="text-xs text-text-muted">Cada técnico registra seu tempo na OS. O registro é encerrado ao pausar ou concluir.</p></div>
      {user?.role === 'MECHANIC' && status === 'IN_PROGRESS' && <Button size="sm" variant={mine ? 'outline' : 'default'} disabled={action.isPending || query.isLoading} onClick={() => action.mutate(mine ? 'stop' : 'start')}>{action.isPending ? 'Salvando…' : mine ? 'Encerrar meu trabalho' : 'Iniciar meu trabalho'}</Button>}
    </div>
    {query.isError && <p className="mt-3 text-sm text-danger-strong">Não foi possível carregar os registros. <button className="underline" onClick={() => query.refetch()}>Tentar novamente</button></p>}
    {action.isError && <p className="mt-3 text-sm text-danger-strong">{extractErrorMessage(action.error)}</p>}
    {!query.isLoading && !query.isError && <div className="mt-3 space-y-2 text-sm">{sessions.length ? sessions.map(session => <div key={session.id} className="flex flex-wrap justify-between gap-2 border-t border-border pt-2"><span className="font-medium">{session.technicianName}{!session.endedAt ? ' · em trabalho' : ''}</span><span className="tabular-nums text-text-muted">{new Date(session.startedAt).toLocaleString('pt-BR')} · {session.endedAt ? `${session.workedMinutes} min` : 'em andamento'}</span></div>) : <p className="text-text-muted">Ainda não há tempo de trabalho registrado nesta OS.</p>}</div>}
  </section>;
}
