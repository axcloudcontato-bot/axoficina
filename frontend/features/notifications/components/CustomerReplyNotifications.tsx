'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { useCustomerReplyNotifications } from '../hooks/use-customer-reply-notifications';

interface Props { notifications: ReturnType<typeof useCustomerReplyNotifications>; onOpen: () => void }

export function CustomerReplyNotifications({ notifications, onOpen }: Props) {
  if (!notifications.enabled) return null;
  return <section aria-label="Respostas dos clientes" className="border-b border-border pb-2 mb-2">
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <h2 className="text-sm font-bold">Respostas dos clientes</h2>
      <button type="button" onClick={() => notifications.refetch()} disabled={notifications.isFetching} className="text-xs font-semibold text-primary hover:underline disabled:opacity-50">Atualizar respostas</button>
    </div>
    {notifications.isPending && <p role="status" className="px-3 py-2 text-sm text-text-muted">Carregando respostas...</p>}
    {notifications.isError && <p role="alert" className="px-3 py-2 text-sm text-danger">Não foi possível atualizar as respostas. Tente novamente.</p>}
    {!notifications.isPending && !notifications.isError && !notifications.items.length && <p className="px-3 py-2 text-sm text-text-muted">Nenhuma resposta de cliente recebida.</p>}
    <ul className="space-y-1">
      {notifications.items.map((item) => <li key={item.id} className={cn('rounded-button px-3 py-2', !item.readAt ? 'bg-primary-subtle' : 'bg-muted/30')}>
        <Link href={`/ordens-de-servico/${item.serviceOrderId}#customer-message-history`} onClick={() => { if (!item.readAt) notifications.markRead(item.id); onOpen(); }} className="block rounded-sm text-sm hover:underline">
          <span className="flex items-start justify-between gap-2"><span className="min-w-0 break-words font-bold text-text">{item.customerName} respondeu</span>{!item.readAt && <span className="shrink-0 rounded-pill bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">Nova</span>}</span>
          <span className="mt-1 block text-xs text-text-muted">OS #{String(item.orderNumber).padStart(5, '0')} · {item.channel === 'WHATSAPP' ? 'WhatsApp' : 'E-mail'}</span>
          <span className="mt-1 block break-words text-text-muted">{item.question}</span>
          <span className="mt-1 block break-words font-semibold text-text">Resposta: {item.selectedOption}</span>
          <time dateTime={item.answeredAt} className="mt-1 block text-xs text-text-muted">{new Date(item.answeredAt).toLocaleString('pt-BR')}</time>
          <span className="mt-1 block text-xs font-semibold text-primary">Abrir OS</span>
        </Link>
        {!item.readAt ? <button type="button" onClick={() => notifications.markRead(item.id)} disabled={notifications.markingRead} className="mt-2 rounded-sm text-xs font-semibold text-text-muted hover:text-text hover:underline disabled:opacity-50" aria-label={`Marcar resposta da OS #${String(item.orderNumber).padStart(5, '0')} como lida`}>Marcar como lida</button> : <span className="mt-2 block text-xs text-text-muted">Lida</span>}
      </li>)}
    </ul>
    {notifications.hasNextPage && <button type="button" onClick={() => notifications.fetchNextPage()} disabled={notifications.isFetching} className="mt-2 w-full rounded-button px-3 py-2 text-sm font-semibold text-primary hover:bg-muted disabled:opacity-50">Carregar respostas anteriores</button>}
  </section>;
}
