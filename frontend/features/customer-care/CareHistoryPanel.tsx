'use client';
import { useState } from 'react';
import { MagnifyingGlass, PaperPlaneTilt } from '@phosphor-icons/react';
import type { CareCampaign, CareCampaignKey, CareDeliveryFilter, CareDeliveryStatus } from '@oficina/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { extractErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useCareDeliveries, useResolveCareDelivery, useRetryCareDelivery } from './use-customer-care';

const PAGE_SIZE = 30;
const date = (value: string) => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const selectClass = 'h-10 rounded-button border border-input bg-background px-3 text-sm';
const STATUS: Record<CareDeliveryStatus, { label: string; className: string }> = {
  PENDING: { label: 'Na fila', className: 'bg-info-subtle text-info-strong' }, SENDING: { label: 'Enviando', className: 'bg-info-subtle text-info-strong' },
  SENT: { label: 'Enviado', className: 'bg-success-subtle text-success-strong' }, FAILED: { label: 'Revisar configuração', className: 'bg-danger-subtle text-danger-strong' },
  UNKNOWN: { label: 'Conferir envio', className: 'bg-warning-subtle text-warning-strong' }, SKIPPED: { label: 'Não enviado', className: 'bg-muted text-muted-foreground' },
};
const RESULTS: Array<{ value: '' | CareDeliveryFilter; label: string }> = [
  { value: '', label: 'Todos os resultados' }, { value: 'SENT', label: 'Enviados' }, { value: 'NOT_SENT', label: 'Não enviados' },
  { value: 'CHECK', label: 'Para conferir' }, { value: 'QUEUED', label: 'Na fila' },
];

// Every message the automation prepared, with what happened to it. The uncertain ones can be settled by the team.
export function CareHistoryPanel({ enabled, canManage, campaigns, initialStatus }: { enabled: boolean; canManage: boolean; campaigns: CareCampaign[]; initialStatus?: CareDeliveryFilter }) {
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'' | CareDeliveryFilter>(initialStatus ?? '');
  const [campaignKey, setCampaignKey] = useState<'' | CareCampaignKey>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 300);
  const query = useCareDeliveries({ offset, limit: PAGE_SIZE, ...(status ? { status } : {}), ...(campaignKey ? { campaignKey } : {}), ...(search ? { search } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }, enabled);
  const retry = useRetryCareDelivery();
  const resolve = useResolveCareDelivery();
  const items = query.data?.deliveries ?? [];
  const total = query.data?.total ?? 0;
  const narrowed = Boolean(status || campaignKey || search || from || to);
  const reset = (apply: () => void) => { apply(); setOffset(0); };

  return <div className="space-y-4">
    <div><h2 className="text-xl font-bold">Atenção com rastreabilidade.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Veja o texto, o canal e o resultado de cada disparo. Envio confirmado pelo provedor não significa leitura pelo cliente.</p></div>
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:max-w-xs"><MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input aria-label="Buscar cliente no histórico" className="pl-9" placeholder="Nome do cliente" value={searchInput} onChange={event => reset(() => setSearchInput(event.target.value))} /></div>
      <select aria-label="Resultado do envio" className={selectClass} value={status} onChange={event => reset(() => setStatus(event.target.value as typeof status))}>{RESULTS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      <select aria-label="Campanha" className={selectClass} value={campaignKey} onChange={event => reset(() => setCampaignKey(event.target.value as typeof campaignKey))}><option value="">Todas as campanhas</option>{campaigns.map(campaign => <option key={campaign.key} value={campaign.key}>{campaign.name}</option>)}</select>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">De <Input type="date" aria-label="Desde" className="h-10 w-40" value={from} onChange={event => reset(() => setFrom(event.target.value))} /></label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">até <Input type="date" aria-label="Até" className="h-10 w-40" value={to} onChange={event => reset(() => setTo(event.target.value))} /></label>
    </div>
    {query.isLoading && <div role="status" aria-label="Carregando histórico" className="h-32 animate-pulse rounded-card bg-surface" />}
    {query.isError && <div className="rounded-card border border-border bg-card p-6 text-sm">Não foi possível carregar o histórico. <button type="button" className="font-semibold underline" onClick={() => query.refetch()}>Tentar novamente</button></div>}
    {!query.isLoading && !query.isError && !items.length && (narrowed
      ? <p className="rounded-card border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Nenhum disparo encontrado com esses filtros.</p>
      : <div className="rounded-card border border-dashed border-border bg-card p-10 text-center"><PaperPlaneTilt className="mx-auto size-9 text-primary" aria-hidden="true" /><p className="mt-4 font-semibold">As primeiras mensagens vão aparecer aqui.</p><p className="mt-2 text-sm text-muted-foreground">A régua verifica os clientes a cada hora e respeita o horário de cada contato.</p></div>)}
    {items.map(item => <article key={item.id} className="rounded-card border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{item.customerName}</h3><p className="mt-1 text-xs leading-6 text-muted-foreground">{item.campaignNames.join(' · ')} · {item.channel === 'WHATSAPP' ? 'WhatsApp' : 'E-mail'} · {date(item.sentAt ?? item.scheduledAt)}</p></div><span className={cn('rounded-full px-3 py-1.5 text-xs font-bold', STATUS[item.status].className)}>{STATUS[item.status].label}</span></div>
      {item.reason && <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.reason}</p>}
      <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-primary">Ver mensagem</summary><p className="mt-3 whitespace-pre-wrap break-words rounded-button bg-muted p-4 text-sm leading-7">{item.message}</p></details>
      {item.status === 'UNKNOWN' && canManage && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">Conferiu a conversa?</span><Button variant="outline" size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: item.id, outcome: 'DELIVERED' }, { onSuccess: () => toast.success('Envio confirmado.'), onError: error => toast.error(extractErrorMessage(error)) })}>A mensagem chegou</Button><Button variant="outline" size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: item.id, outcome: 'NOT_DELIVERED' }, { onSuccess: () => toast.success('Marcado como não enviado. Corrija a configuração e tente novamente.'), onError: error => toast.error(extractErrorMessage(error)) })}>Não chegou</Button></div>}
      {item.status === 'FAILED' && canManage && <Button variant="outline" size="sm" className="mt-4" disabled={retry.isPending} onClick={() => retry.mutate(item.id, { onSuccess: () => toast.success('Mensagem voltou à fila para nova verificação.'), onError: error => toast.error(extractErrorMessage(error)) })}>Tentar após corrigir configuração</Button>}
    </article>)}
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{total} {total === 1 ? 'disparo' : 'disparos'}{narrowed ? ' encontrados' : ' registrados'}{total > PAGE_SIZE ? ` · página ${Math.floor(offset / PAGE_SIZE) + 1}` : ''}</span>{total > PAGE_SIZE && <div className="flex gap-2"><Button variant="outline" size="sm" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Anterior</Button><Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>Próxima</Button></div>}</div>
  </div>;
}
