'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ServiceOrderStatusNotificationResponse } from '@oficina/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api/client';
import { SERVICE_ORDER_STATUS_LABELS } from '../state-machine';
import { statusNotificationsApi } from '../api/status-notifications-api';

const PAGE_SIZE = 20;
const STATUS_LABELS = { PENDING: 'Aguardando envio', SENDING: 'Enviando', SENT: 'Enviado', FAILED: 'Envio não confirmado', SKIPPED: 'Não enviado' };

export function ServiceOrderStatusNotifications({ serviceOrderId, canManage }: { serviceOrderId: string; canManage: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<ServiceOrderStatusNotificationResponse | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const client = useQueryClient();
  const key = ['service-order-status-notifications', serviceOrderId];
  const history = useQuery({ queryKey: [...key, offset], queryFn: () => statusNotificationsApi.list({ serviceOrderId, offset, limit: PAGE_SIZE }), refetchInterval: 10_000 });
  const retry = useMutation({ mutationFn: statusNotificationsApi.retry, onSuccess: () => { setSelected(null); toast.success('Nova tentativa agendada.'); void client.invalidateQueries({ queryKey: key }); }, onError: error => toast.error(extractErrorMessage(error)) });
  const uncertain = history.data?.items.some(item => item.status === 'FAILED' && !item.answeredAt);
  const rating = history.data?.items.find(item => item.kind === 'RATING');

  return <section aria-labelledby="status-notifications-title" className="rounded-card border border-border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 id="status-notifications-title" className="text-sm font-semibold text-text">Avisos automáticos ao cliente</h3><p className="mt-1 text-xs text-text-muted">Avisos de status conforme a preferência do cliente. Avaliação de 1 a 5 estrelas enviada após a entrega.</p></div><Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Recolher avisos' : 'Ver avisos'}{history.data?.total ? ` (${history.data.total})` : ''}</Button></div>
    {rating?.rating && <p role="status" className="mt-3 rounded-button border border-primary/30 bg-selection p-3 text-sm font-semibold text-text">Avaliação do cliente: {'⭐'.repeat(rating.rating)} ({rating.rating}/5)</p>}
    {rating?.status === 'SENT' && !rating.answeredAt && <p className="mt-3 text-sm text-text-muted">Avaliação pós-entrega enviada. Aguardando resposta do cliente.</p>}
    {uncertain && <p role="status" className="mt-3 rounded-button border border-warning/30 bg-warning-subtle p-3 text-sm text-text">Há avisos com envio não confirmado. Confira o histórico e a conversa do WhatsApp.</p>}
    {history.isError && <p role="alert" className="mt-3 text-sm text-danger">Não foi possível carregar os avisos. <button className="underline" onClick={() => history.refetch()}>Tentar novamente</button></p>}
    {expanded && <div className="mt-4 border-t border-border pt-4">{history.isPending ? <p role="status" className="text-sm text-text-muted">Carregando avisos...</p> : !history.data?.items.length ? <p className="text-sm text-text-muted">Nenhum aviso registrado. Os avisos de status dependem da preferência do cliente; a avaliação será gerada ao registrar a entrega.</p> : <>
      <ul className="space-y-3">{history.data.items.map(item => <li key={item.id} className="rounded-button border border-border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-text">{item.kind === 'RATING' ? 'Avaliação pós-entrega' : item.fromStatus ? `${SERVICE_ORDER_STATUS_LABELS[item.fromStatus]} → ` : 'Abertura · '}{item.kind !== 'RATING' && SERVICE_ORDER_STATUS_LABELS[item.toStatus]}</p><p className="mt-1 text-xs text-text-muted">{new Date(item.occurredAt).toLocaleString('pt-BR')} · WhatsApp {item.recipient || 'sem telefone válido'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.answeredAt || item.status === 'SENT' ? 'bg-success-subtle text-success' : item.status === 'FAILED' ? 'bg-warning-subtle text-warning' : 'bg-muted text-text-muted'}`}>{item.answeredAt ? 'Respondida' : STATUS_LABELS[item.status]}</span></div>{item.rating && <p className="mt-2 text-sm font-semibold text-text">Nota: {'⭐'.repeat(item.rating)} ({item.rating}/5){item.answeredAt ? ` · ${new Date(item.answeredAt).toLocaleString('pt-BR')}` : ''}</p>}{item.failureReason && !item.answeredAt && <p className="mt-2 text-xs text-text-muted">{item.failureReason}</p>}{item.sentAt && <p className="mt-2 text-xs text-text-muted">Enviado em {new Date(item.sentAt).toLocaleString('pt-BR')}</p>}<details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-text-muted">Ver mensagem</summary><div className="mt-2 whitespace-pre-wrap rounded-button bg-surface p-3 text-sm leading-relaxed text-text">{item.message.split(/(\*[^*\n]+\*)/g).map((part, index) => part.startsWith('*') && part.endsWith('*') ? <strong key={index}>{part.slice(1, -1)}</strong> : part)}</div></details>{canManage && item.status === 'FAILED' && !item.answeredAt && <Button className="mt-3" variant="outline" size="sm" onClick={() => { setConfirmed(false); setSelected(item); }}>Reenviar aviso</Button>}</li>)}</ul>
      {history.data.total > PAGE_SIZE && <nav aria-label="Páginas dos avisos" className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-text-muted">Página {Math.floor(offset / PAGE_SIZE) + 1} de {Math.ceil(history.data.total / PAGE_SIZE)}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!offset || history.isFetching} onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))}>Anteriores</Button><Button size="sm" variant="outline" disabled={!history.data.hasMore || history.isFetching} onClick={() => setOffset(value => value + PAGE_SIZE)}>Próximos</Button></div></nav>}
    </>}</div>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open && !retry.isPending) setSelected(null); }}><DialogContent><DialogHeader><DialogTitle>{selected?.kind === 'RATING' ? 'Reenviar avaliação pós-entrega' : 'Reenviar aviso de movimentação'}</DialogTitle><DialogDescription>Confira se a mensagem já chegou na conversa antes de tentar de novo. Uma falha de confirmação pode acontecer após o envio.</DialogDescription></DialogHeader><p className="text-sm text-text-muted">Movimentação de {selected ? new Date(selected.occurredAt).toLocaleString('pt-BR') : ''}. A nova tentativa mantém o conteúdo e a data originais.</p><label className="flex items-start gap-3 rounded-button border border-border p-3 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />Conferi a conversa e quero reenviar este aviso.</label><DialogFooter><Button variant="outline" disabled={retry.isPending} onClick={() => setSelected(null)}>Voltar</Button><Button disabled={!selected || !confirmed || retry.isPending} onClick={() => selected && retry.mutate({ id: selected.id, confirmResend: true })}>{retry.isPending ? 'Agendando...' : 'Confirmar reenvio'}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
