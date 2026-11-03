'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChatCircleText } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { extractErrorMessage } from '@/lib/api/client';
import { PRIORITY_LABELS, STATUS_LABELS, supportApi, type SupportStatus, type SupportTicket } from './support-api';

const statusTone: Record<SupportStatus, 'attention' | 'info' | 'success'> = { OPEN: 'attention', IN_PROGRESS: 'info', RESOLVED: 'success' };

export function AdminSupportWorkspace() {
  const client = useQueryClient();
  const [filter, setFilter] = useState<SupportStatus | ''>('');
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tickets = useQuery({ queryKey: ['admin-support-tickets', filter, offset], queryFn: () => supportApi.adminList({ status: filter || undefined, offset }), refetchInterval: 60_000 });
  const selected = tickets.data?.items.find((item) => item.id === selectedId) ?? null;
  const update = useMutation({ mutationFn: ({ id, status, response }: { id: string; status: SupportStatus; response?: string }) => supportApi.adminUpdate(id, { status, response }), onSuccess: () => client.invalidateQueries({ queryKey: ['admin-support-tickets'] }) });

  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold tracking-tight">Chamados de suporte</h2><p className="mt-1 text-sm text-text-muted">Pedidos das oficinas, ordenados pela data de abertura.</p></div>
    <section className="rounded-card border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><h3 className="font-semibold">Fila de atendimento</h3><label className="flex items-center gap-2 text-sm text-text-muted">Situação<select value={filter} onChange={(event) => { setFilter(event.target.value as SupportStatus | ''); setOffset(0); setSelectedId(null); }} className="h-10 rounded-button border border-input bg-background px-3 text-foreground"><option value="">Todas</option><option value="OPEN">Abertos</option><option value="IN_PROGRESS">Em atendimento</option><option value="RESOLVED">Resolvidos</option></select></label></div>
      {tickets.isPending && <p role="status" className="p-6 text-sm text-text-muted">Carregando chamados...</p>}
      {tickets.isError && <div role="alert" className="space-y-2 p-6"><p className="text-sm text-danger-strong">Não foi possível carregar os chamados.</p><Button variant="outline" size="sm" onClick={() => tickets.refetch()}>Tentar novamente</Button></div>}
      {tickets.data?.items.length === 0 && <div className="grid justify-items-center gap-2 p-10 text-center"><ChatCircleText className="size-8 text-text-muted" aria-hidden="true" /><p className="font-semibold">Nenhum chamado nesta situação</p></div>}
      <div className="divide-y divide-border">{tickets.data?.items.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`flex w-full flex-wrap items-center gap-3 px-4 py-4 text-left hover:bg-muted/40 ${selectedId === item.id ? 'bg-selection' : ''}`}><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.subject}</span><span className="mt-1 block truncate text-xs text-text-muted">{item.tenantName} · {item.authorName} · {new Date(item.createdAt).toLocaleString('pt-BR')}</span></span><span className="text-xs text-text-muted">{PRIORITY_LABELS[item.priority]}</span><Badge variant={statusTone[item.status]}>{STATUS_LABELS[item.status]}</Badge></button>)}</div>
      {tickets.data && tickets.data.total > 30 && <div className="flex items-center justify-between border-t border-border p-4"><span className="text-xs text-text-muted">{offset + 1}–{Math.min(offset + 30, tickets.data.total)} de {tickets.data.total}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={offset === 0} onClick={() => { setOffset(Math.max(0, offset - 30)); setSelectedId(null); }}>Anterior</Button><Button size="sm" variant="outline" disabled={offset + 30 >= tickets.data.total} onClick={() => { setOffset(offset + 30); setSelectedId(null); }}>Próxima</Button></div></div>}
    </section>
    {selected && <TicketResponse key={selected.id} ticket={selected} update={update.mutateAsync} pending={update.isPending} />}
  </div>;
}

function TicketResponse({ ticket, update, pending }: { ticket: SupportTicket; update: (input: { id: string; status: SupportStatus; response?: string }) => Promise<unknown>; pending: boolean }) {
  const [status, setStatus] = useState<SupportStatus>(ticket.status);
  const [response, setResponse] = useState(ticket.response ?? '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSaved(false);
    try { await update({ id: ticket.id, status, ...(response.trim() !== (ticket.response ?? '') ? { response: response.trim() } : {}) }); setSaved(true); }
    catch (failure) { setError(extractErrorMessage(failure, 'Não foi possível atualizar o chamado.')); }
  }
  return <section className="rounded-card border border-border bg-card p-5 shadow-card sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{ticket.subject}</h3><p className="mt-1 text-xs text-text-muted">{ticket.tenantName} · {ticket.authorName} · {ticket.authorEmail ?? 'E-mail indisponível'} · Prioridade {PRIORITY_LABELS[ticket.priority].toLowerCase()}</p></div><Badge variant={statusTone[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge></div><div className="mt-4 whitespace-pre-wrap break-words rounded-button bg-surface p-4 text-sm">{ticket.description}</div><form onSubmit={submit} className="mt-5 space-y-4"><label className="block space-y-1.5 text-sm font-semibold"><span>Situação</span><select value={status} onChange={(event) => setStatus(event.target.value as SupportStatus)} className="block h-10 w-full max-w-xs rounded-button border border-input bg-background px-3 font-normal text-foreground"><option value="OPEN">Aberto</option><option value="IN_PROGRESS">Em atendimento</option><option value="RESOLVED">Resolvido</option></select></label><label className="block space-y-1.5 text-sm font-semibold"><span>Resposta visível para a oficina</span><Textarea rows={5} minLength={10} maxLength={4000} value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Explique a solução ou o próximo passo." /></label>{error && <p role="alert" className="text-sm text-danger-strong">{error}</p>}{saved && <p role="status" className="text-sm text-success-strong">Chamado atualizado.</p>}<Button type="submit" loading={pending}>Salvar atendimento</Button></form></section>;
}
