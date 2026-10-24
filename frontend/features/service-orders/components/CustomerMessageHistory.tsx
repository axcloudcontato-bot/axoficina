'use client';

import { useQuery } from '@tanstack/react-query';
import { customerMessagesApi } from '../api/customer-messages-api';
import { Button } from '@/components/ui/button';

export function CustomerMessageHistory({ serviceOrderId }: { serviceOrderId: string }) {
  const history = useQuery({ queryKey: ['customer-messages', serviceOrderId], queryFn: () => customerMessagesApi.list(serviceOrderId), refetchInterval: 30_000 });
  return <div className="mt-4 border-t border-border pt-4">
    <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Respostas do cliente</h4><Button variant="ghost" size="sm" onClick={() => history.refetch()} disabled={history.isFetching}>Atualizar</Button></div>
    {history.isPending ? <p className="text-sm text-text-muted">Carregando respostas...</p> : history.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar as respostas. Tente atualizar.</p> : !history.data.messages.length ? <p className="text-sm text-text-muted">As perguntas enviadas com botões e suas respostas aparecerão aqui.</p> : <ul className="mt-2 space-y-3">
      {history.data.messages.map((message) => <li key={message.id} className="rounded-button bg-muted/40 p-3 text-sm">
        <p className="font-semibold">{message.question}</p>
        <p className="mt-1 text-xs text-text-muted">{message.channel === 'EMAIL' ? 'E-mail enviado' : message.deliveryMode === 'WA_AKG' ? message.sentAt || message.answeredAt ? 'Enviada pelo WA-AKG' : 'WA-AKG · envio não confirmado; confira a conversa antes de reenviar' : 'Preparada para WhatsApp'} · {new Date(message.createdAt).toLocaleString('pt-BR')}</p>
        <p className="mt-2 font-medium">{message.answeredAt && message.selectedOption !== undefined ? `Resposta: ${message.options[message.selectedOption]} · ${new Date(message.answeredAt).toLocaleString('pt-BR')}` : Date.parse(message.expiresAt) <= Date.now() ? 'Link expirado' : 'Aguardando resposta'}</p>
        <details className="mt-2 text-xs text-text-muted"><summary className="cursor-pointer">Ver conteúdo e opções da mensagem</summary><p className="mt-2 whitespace-pre-wrap">{message.message}</p><p className="mt-2">Botões: {message.options.join(' · ')}</p></details>
      </li>)}
    </ul>}
  </div>;
}
