'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AUDIT_AREAS, auditLabel } from '../audit-labels';
import { useAuditLog } from '../hooks/use-settings';

const PAGE = 30;
const selectClass = 'h-10 rounded-button border border-input bg-background px-3 text-sm';

// Who did what and when, for the owner: the answer to "who changed this?".
export function AuditHistory() {
  const [prefix, setPrefix] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  // The end date is a whole day: the server compares up to, not including, the next midnight.
  const request = { offset, limit: PAGE, ...(prefix ? { actionPrefix: prefix } : {}), ...(from ? { from: new Date(`${from}T00:00:00-03:00`).toISOString() } : {}), ...(to ? { to: new Date(new Date(`${to}T00:00:00-03:00`).getTime() + 86_400_000).toISOString() } : {}) };
  const query = useAuditLog(request);
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const reset = (change: () => void) => { change(); setOffset(0); };

  return <div className="space-y-4">
    <section className="rounded-card border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-bold">Histórico de alterações</h2>
      <p className="mt-1 text-sm text-text-muted">Quem fez o quê e quando: preços, equipe, configurações, exclusões e acessos. Só administradores veem.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1.5 text-sm font-semibold"><span className="block">Área</span><select className={selectClass} value={prefix} onChange={(event) => reset(() => setPrefix(event.target.value))}>{AUDIT_AREAS.map((area) => <option key={area.prefix} value={area.prefix}>{area.label}</option>)}</select></label>
        <label className="space-y-1.5 text-sm font-semibold"><span className="block">De</span><Input type="date" className="w-40" value={from} onChange={(event) => reset(() => setFrom(event.target.value))} /></label>
        <label className="space-y-1.5 text-sm font-semibold"><span className="block">Até</span><Input type="date" className="w-40" value={to} onChange={(event) => reset(() => setTo(event.target.value))} /></label>
        {(prefix || from || to) && <Button variant="ghost" size="sm" onClick={() => reset(() => { setPrefix(''); setFrom(''); setTo(''); })}>Limpar filtros</Button>}
      </div>
    </section>

    {query.isLoading && <div role="status" aria-label="Carregando histórico" className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-card bg-surface" />)}</div>}
    {query.isError && <div role="alert" className="rounded-card border border-danger/30 p-6 text-sm text-danger">Não foi possível carregar o histórico. <Button variant="outline" size="sm" onClick={() => query.refetch()}>Tentar novamente</Button></div>}
    {!query.isLoading && !query.isError && items.length === 0 && <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-muted">Nada registrado neste filtro.</div>}
    {items.length > 0 && <ol className="divide-y divide-border rounded-card border border-border bg-card shadow-sm">{items.map((item) => <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
      <div><p className="font-semibold">{auditLabel(item.action)}</p><p className="text-xs text-text-muted">{item.userName ?? 'Sistema ou pessoa não identificada'}</p>{Object.keys(item.metadata).length > 0 && <p className="mt-0.5 text-xs text-text-muted">{Object.entries(item.metadata).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</p>}</div>
      <time dateTime={item.createdAt} className="shrink-0 text-xs tabular-nums text-text-muted">{new Date(item.createdAt).toLocaleString('pt-BR')}</time>
    </li>)}</ol>}
    {total > PAGE && <div className="flex items-center gap-3"><Button size="sm" variant="outline" disabled={offset === 0 || query.isFetching} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Anterior</Button><span className="text-xs text-text-muted">{offset + 1}–{Math.min(offset + PAGE, total)} de {total}</span><Button size="sm" variant="outline" disabled={offset + PAGE >= total || query.isFetching} onClick={() => setOffset(offset + PAGE)}>Próxima</Button></div>}
  </div>;
}
