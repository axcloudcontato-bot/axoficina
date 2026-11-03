'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChatCircleText, Plus } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { extractErrorMessage } from '@/lib/api/client';
import { PRIORITY_LABELS, STATUS_LABELS, supportApi, type SupportPriority, type SupportStatus } from './support-api';

const statusTone: Record<SupportStatus, 'attention' | 'info' | 'success'> = { OPEN: 'attention', IN_PROGRESS: 'info', RESOLVED: 'success' };

export function SupportWorkspace() {
  const client = useQueryClient();
  const [offset, setOffset] = useState(0);
  const tickets = useQuery({ queryKey: ['support-tickets', offset], queryFn: () => supportApi.mine(offset), refetchInterval: 60_000 });
  const create = useMutation({ mutationFn: supportApi.create, onSuccess: () => client.invalidateQueries({ queryKey: ['support-tickets'] }) });
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<SupportPriority>('NORMAL');
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState('');
  const total = tickets.data?.total ?? 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(''); setCreatedId('');
    try {
      const ticket = await create.mutateAsync({ subject: subject.trim(), description: description.trim(), priority });
      setSubject(''); setDescription(''); setPriority('NORMAL'); setCreatedId(ticket.id); setOffset(0);
    } catch (failure) { setError(extractErrorMessage(failure, 'Não foi possível abrir o chamado. Tente novamente.')); }
  }

  return <div className="mx-auto grid max-w-[1200px] gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
    <section className="h-fit rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-button bg-muted text-text-muted"><Plus className="size-5" aria-hidden="true" /></span><div><h2 className="text-lg font-bold">Abrir chamado</h2><p className="mt-1 text-sm text-text-muted">Conte o que aconteceu e como podemos ajudar.</p></div></div>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5"><label htmlFor="support-subject" className="text-sm font-semibold">Assunto</label><Input id="support-subject" required minLength={5} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Ex.: Não consigo emitir um orçamento" /></div>
        <div className="space-y-1.5"><label htmlFor="support-priority" className="text-sm font-semibold">Prioridade</label><select id="support-priority" value={priority} onChange={(event) => setPriority(event.target.value as SupportPriority)} className="h-10 w-full rounded-button border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="LOW">Baixa</option><option value="NORMAL">Normal</option><option value="HIGH">Alta</option></select><p className="text-xs text-text-muted">Use alta quando o problema impedir o trabalho da oficina.</p></div>
        <div className="space-y-1.5"><label htmlFor="support-description" className="text-sm font-semibold">Descrição</label><Textarea id="support-description" required minLength={20} maxLength={4000} rows={7} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descreva a tela, o que tentou fazer e a mensagem exibida." /><p className="text-xs text-text-muted">Não inclua senhas, tokens ou dados sensíveis de clientes.</p></div>
        {error && <p role="alert" className="rounded-button bg-danger-subtle p-3 text-sm text-danger-strong">{error}</p>}
        {createdId && <p role="status" className="rounded-button bg-success-subtle p-3 text-sm text-success-strong">Chamado #{createdId.slice(0, 8).toUpperCase()} aberto. Você pode acompanhá-lo nesta página.</p>}
        <Button type="submit" loading={create.isPending}>Enviar chamado</Button>
      </form>
    </section>

    <section className="min-w-0 rounded-card border border-border bg-card shadow-card">
      <div className="border-b border-border p-5 sm:p-6"><h2 className="text-lg font-bold">Meus chamados</h2><p className="mt-1 text-sm text-text-muted">Acompanhe a situação e a resposta da equipe Ofix.</p></div>
      {tickets.isPending && <p role="status" className="p-6 text-sm text-text-muted">Carregando chamados...</p>}
      {tickets.isError && <div role="alert" className="space-y-3 p-6 text-sm text-danger-strong"><p>Não foi possível carregar os chamados.</p><Button variant="outline" size="sm" onClick={() => tickets.refetch()}>Tentar novamente</Button></div>}
      {tickets.data?.items.length === 0 && <div className="grid justify-items-center gap-2 p-10 text-center"><ChatCircleText className="size-8 text-text-muted" aria-hidden="true" /><p className="font-semibold">Nenhum chamado ainda</p><p className="text-sm text-text-muted">Ao enviar seu primeiro pedido, ele aparecerá aqui.</p></div>}
      <ol className="divide-y divide-border">{tickets.data?.items.map((ticket) => <li key={ticket.id} className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold break-words">{ticket.subject}</h3><p className="mt-1 text-xs text-text-muted">#{ticket.id.slice(0, 8).toUpperCase()} · Aberto em {new Date(ticket.createdAt).toLocaleString('pt-BR')} · Prioridade {PRIORITY_LABELS[ticket.priority].toLowerCase()}</p></div><Badge variant={statusTone[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge></div><p className="mt-3 whitespace-pre-wrap break-words text-sm text-text-muted">{ticket.description}</p>{ticket.response && <div className="mt-4 rounded-button border border-border bg-surface p-4"><p className="text-xs font-bold uppercase tracking-wide text-text-muted">Resposta do suporte</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{ticket.response}</p>{ticket.respondedAt && <p className="mt-2 text-xs text-text-muted">{new Date(ticket.respondedAt).toLocaleString('pt-BR')}</p>}</div>}</li>)}</ol>
      {total > 20 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4"><p className="text-xs text-text-muted">{offset + 1}–{Math.min(offset + 20, total)} de {total} chamados</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>Anterior</Button><Button size="sm" variant="outline" disabled={offset + 20 >= total} onClick={() => setOffset(offset + 20)}>Próxima</Button></div></div>}
    </section>
  </div>;
}
