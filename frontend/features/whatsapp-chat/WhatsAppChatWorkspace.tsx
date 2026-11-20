'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChatCircleDots, Checks, MagnifyingGlass, Paperclip, PaperPlaneRight, UserCircle, WhatsappLogo } from '@phosphor-icons/react';
import type { WhatsAppChatMessage, WhatsAppChatMessageType, WhatsAppConversation } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBranding } from '@/features/settings/hooks/use-settings';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { extractErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { whatsappChatApi } from './whatsapp-chat-api';

const TYPE_LABELS: Record<WhatsAppChatMessageType, string> = {
  TEXT: 'Mensagem', IMAGE: 'Foto', VIDEO: 'Vídeo', AUDIO: 'Áudio', DOCUMENT: 'Documento', STICKER: 'Figurinha', LOCATION: 'Localização', CONTACT: 'Contato', OTHER: 'Mensagem',
};

function formatPhone(phone?: string) {
  if (!phone) return undefined;
  const national = phone.startsWith('55') && [12, 13].includes(phone.length) ? phone.slice(2) : phone;
  if (national.length === 11) return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  if (national.length === 10) return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  return `+${phone}`;
}

export const conversationTitle = (conversation: WhatsAppConversation) => conversation.customer?.name ?? conversation.name ?? formatPhone(conversation.phone) ?? 'Contato do WhatsApp';

const initials = (name: string) => { const parts = name.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/).filter(Boolean); return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)?.[0] ?? '' : '')).toUpperCase() || '#'; };
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
function shortTime(iso: string) {
  const date = new Date(iso);
  return dayKey(iso) === new Date().toLocaleDateString('pt-BR') ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function WhatsAppChatWorkspace() {
  const branding = useBranding();
  if (branding.isPending) return <p role="status" className="text-sm text-text-muted">Carregando o chat...</p>;
  if (!branding.data?.whatsappEnabled) {
    return <section className="mx-auto max-w-xl rounded-card border border-border bg-card p-6 text-center">
      <WhatsappLogo className="mx-auto size-10 text-text-muted" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-bold text-text">O WhatsApp da oficina ainda não está ativo</h2>
      <p className="mt-2 text-sm text-text-muted">Ative a integração para conversar com os clientes sem sair do Ofix.</p>
      <Button asChild className="mt-4"><Link href="/configuracoes/whatsapp">Configurar WhatsApp</Link></Button>
    </section>;
  }
  return <ChatScreen />;
}

function ChatScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get('conversa');
  const [search, setSearch] = useState('');
  const [onlyCustomers, setOnlyCustomers] = useState(false);
  const conversations = useQuery({ queryKey: ['whatsapp-chat', 'conversations'], queryFn: whatsappChatApi.conversations, refetchInterval: 10_000 });

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    return (conversations.data?.conversations ?? []).filter((conversation) => {
      if (onlyCustomers && !conversation.customer) return false;
      if (!term) return true;
      return [conversation.customer?.name, conversation.name].some((value) => value?.toLowerCase().includes(term)) || Boolean(digits && conversation.phone?.includes(digits));
    });
  }, [conversations.data, search, onlyCustomers]);

  const open = (jid: string | null) => router.replace(jid ? `/chat?conversa=${encodeURIComponent(jid)}` : '/chat', { scroll: false });

  return <section aria-label="Chat do WhatsApp" className="flex h-[calc(100dvh-11rem)] min-h-[480px] overflow-hidden rounded-card border border-border bg-card md:h-[calc(100dvh-8.5rem)]">
    <aside className={cn('flex w-full flex-col border-border md:w-[340px] md:shrink-0 md:border-r', selected && 'hidden md:flex')} aria-label="Conversas">
      <div className="space-y-3 border-b border-border p-3">
        <h2 className="text-base font-bold text-text">Conversas {conversations.data && <span className="text-sm font-normal text-text-muted">({conversations.data.conversations.length})</span>}</h2>
        <div className="relative"><MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" /><Input aria-label="Pesquisar conversas" placeholder="Nome ou telefone" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" /></div>
        <div role="group" aria-label="Filtrar conversas" className="grid grid-cols-2 gap-1 rounded-button bg-muted p-1 text-sm font-semibold">
          {[{ label: 'Todas', value: false }, { label: 'Clientes', value: true }].map((option) => <button key={option.label} type="button" aria-pressed={onlyCustomers === option.value} onClick={() => setOnlyCustomers(option.value)} className={cn('rounded-[calc(var(--radius-button)-2px)] px-3 py-1.5 transition-colors', onlyCustomers === option.value ? 'bg-card text-text shadow-sm' : 'text-text-muted hover:text-text')}>{option.label}</button>)}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.isPending && <p role="status" className="p-4 text-sm text-text-muted">Carregando conversas...</p>}
        {conversations.isError && <div role="alert" className="p-4 text-sm text-danger">{extractErrorMessage(conversations.error, 'Não foi possível carregar as conversas.')} <button type="button" className="underline" onClick={() => conversations.refetch()}>Tentar novamente</button></div>}
        {conversations.data && !list.length && <p className="p-4 text-sm text-text-muted">{search || onlyCustomers ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda.'}</p>}
        <ul>{list.map((conversation) => {
          const title = conversationTitle(conversation);
          const active = conversation.jid === selected;
          return <li key={conversation.jid}><button type="button" onClick={() => open(conversation.jid)} aria-current={active ? 'true' : undefined} className={cn('flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors', active ? 'bg-primary/10' : 'hover:bg-muted')}>
            <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold', conversation.customer ? 'bg-primary text-primary-foreground' : 'bg-muted text-text-muted')}>{initials(title)}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2"><span className="truncate font-semibold text-text">{title}</span>{conversation.lastMessage && <span className="shrink-0 text-xs text-text-muted">{shortTime(conversation.lastMessage.at)}</span>}</span>
              <span className="block truncate text-sm text-text-muted">{conversation.lastMessage ? conversation.lastMessage.text ?? TYPE_LABELS[conversation.lastMessage.type] : conversation.customer ? formatPhone(conversation.phone) : ''}</span>
            </span>
          </button></li>;
        })}</ul>
      </div>
    </aside>
    <div className={cn('min-w-0 flex-1 flex-col', selected ? 'flex' : 'hidden md:flex')}>
      {selected ? <Conversation key={selected} jid={selected} fallback={conversations.data?.conversations.find((item) => item.jid === selected)} onBack={() => open(null)} />
        : <div className="grid flex-1 place-items-center p-6 text-center text-text-muted"><div><ChatCircleDots className="mx-auto size-10" aria-hidden="true" /><p className="mt-2 text-sm">Escolha uma conversa para ver as mensagens.</p></div></div>}
    </div>
  </section>;
}

function Conversation({ jid, fallback, onBack }: { jid: string; fallback?: WhatsAppConversation; onBack: () => void }) {
  const client = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const canSend = hasPermission(user, 'customers.manage');
  const messages = useQuery({ queryKey: ['whatsapp-chat', 'messages', jid], queryFn: () => whatsappChatApi.messages(jid), refetchInterval: 5_000 });
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const send = useMutation({
    mutationFn: (text: string) => whatsappChatApi.send(jid, text),
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ['whatsapp-chat', 'messages', jid] }), client.invalidateQueries({ queryKey: ['whatsapp-chat', 'conversations'] })]),
  });
  const conversation = messages.data?.conversation ?? fallback ?? { jid };
  const title = conversationTitle(conversation);
  const scroller = useRef<HTMLDivElement>(null);
  const count = messages.data?.messages.length ?? 0;
  // New messages scroll the message pane only, never the page around it.
  useEffect(() => { const pane = scroller.current; if (pane) pane.scrollTop = pane.scrollHeight; }, [count]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || send.isPending) return;
    setError('');
    try { await send.mutateAsync(text); setDraft(''); }
    catch (failure) { setError(extractErrorMessage(failure, 'Não foi possível enviar. Confira a conversa antes de tentar de novo.')); }
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); }
  }

  return <>
    <header className="flex items-center gap-3 border-b border-border px-3 py-2.5">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="Voltar para as conversas"><ArrowLeft className="size-5" /></Button>
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold text-text-muted">{initials(title)}</span>
      <div className="min-w-0 flex-1"><h2 className="truncate font-bold text-text">{title}</h2><p className="truncate text-xs text-text-muted">{formatPhone(conversation.phone) ?? 'Número oculto pelo WhatsApp'}</p></div>
      {conversation.customer && <Button asChild variant="outline" size="sm"><Link href={`/clientes/${conversation.customer.id}`}><UserCircle className="size-4" aria-hidden="true" />Ver cliente</Link></Button>}
    </header>
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto bg-bg px-3 py-4 sm:px-6" aria-live="polite">
      {messages.isPending && <p role="status" className="text-center text-sm text-text-muted">Carregando mensagens...</p>}
      {messages.isError && <p role="alert" className="text-center text-sm text-danger">{extractErrorMessage(messages.error, 'Não foi possível carregar as mensagens.')}</p>}
      {messages.data && !messages.data.messages.length && <p className="text-center text-sm text-text-muted">Nenhuma mensagem nesta conversa ainda.</p>}
      <ol className="space-y-1.5">{messages.data?.messages.map((message, index, all) => <li key={message.id || index}>
        {(index === 0 || dayKey(all[index - 1].at) !== dayKey(message.at)) && <p className="my-3 text-center text-xs font-semibold text-text-muted">{dayKey(message.at)}</p>}
        <MessageBubble message={message} />
      </li>)}</ol>
    </div>
    <form onSubmit={submit} className="border-t border-border p-3">
      {error && <p role="alert" className="mb-2 text-sm text-danger">{error}</p>}
      {canSend ? <div className="flex items-end gap-2">
        <label htmlFor="chat-draft" className="sr-only">Mensagem</label>
        <textarea id="chat-draft" rows={1} value={draft} maxLength={4096} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} placeholder="Digite uma mensagem" className="max-h-32 min-h-10 flex-1 resize-none rounded-button border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-primary" />
        <Button type="submit" size="icon" disabled={!draft.trim() || send.isPending} aria-label="Enviar mensagem"><PaperPlaneRight className="size-5" weight="fill" /></Button>
      </div> : <p className="text-sm text-text-muted">Seu perfil pode ler as conversas, mas não enviar mensagens.</p>}
    </form>
  </>;
}

function MessageBubble({ message }: { message: WhatsAppChatMessage }) {
  const time = new Date(message.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return <div className={cn('flex', message.fromMe ? 'justify-end' : 'justify-start')}>
    <div className={cn('max-w-[85%] rounded-card px-3 py-2 text-sm shadow-sm sm:max-w-[70%]', message.fromMe ? 'bg-primary/15 text-text' : 'bg-card text-text')}>
      {message.media && <MessageMedia file={message.media} type={message.type} />}
      {!message.media && message.type !== 'TEXT' && <p className="flex items-center gap-1.5 text-text-muted"><Paperclip className="size-4" aria-hidden="true" />{TYPE_LABELS[message.type]}</p>}
      {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
      <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-text-muted">{time}{message.fromMe && message.status === 'READ' && <Checks className="size-3.5 text-primary" aria-label="Lida" />}</p>
    </div>
  </div>;
}

function MessageMedia({ file, type }: { file: string; type: WhatsAppChatMessageType }) {
  const media = useQuery({ queryKey: ['whatsapp-chat', 'media', file], queryFn: () => whatsappChatApi.media(file), staleTime: Infinity, gcTime: 10 * 60_000, retry: false });
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!media.data) return;
    const objectUrl = URL.createObjectURL(media.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [media.data]);
  if (media.isPending) return <p className="text-text-muted">Carregando {TYPE_LABELS[type].toLowerCase()}...</p>;
  if (!url) return <p className="flex items-center gap-1.5 text-text-muted"><Paperclip className="size-4" aria-hidden="true" />{TYPE_LABELS[type]} indisponível</p>;
  if (type === 'IMAGE' || type === 'STICKER') {
    // eslint-disable-next-line @next/next/no-img-element -- a private blob URL, which next/image cannot optimise
    return <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={TYPE_LABELS[type]} className="mb-1 max-h-72 rounded-button object-contain" /></a>;
  }
  if (type === 'AUDIO') return <audio controls src={url} className="mb-1 max-w-full" />;
  if (type === 'VIDEO') return <video controls src={url} className="mb-1 max-h-72 rounded-button" />;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-1.5 font-semibold text-primary underline"><Paperclip className="size-4" aria-hidden="true" />Abrir {TYPE_LABELS[type].toLowerCase()}</a>;
}
