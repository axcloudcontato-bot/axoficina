'use client';

import { useEffect, useState } from 'react';
import { Warning, CheckCircle, ClipboardText, GridFour, List, Package, MagnifyingGlass, SlidersHorizontal, X } from '@phosphor-icons/react';
import type { ServiceOrderStatus, ServiceOrderListRequest } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { hasPermission } from '@/features/auth/permissions';
import { ServiceOrderBoard } from '@/features/service-orders/components/ServiceOrderBoard';
import { NewServiceOrderQuickStart } from '@/features/service-orders/components/NewServiceOrderQuickStart';
import { ServiceOrdersTable } from '@/features/service-orders/components/ServiceOrdersTable';
import { useServiceOrdersList } from '@/features/service-orders/hooks/use-service-orders';
import { type ServiceOrderAttentionFilter } from '@/features/service-orders/service-orders-view-model';
import { workshopToday, shiftCalendarDay, formatHistoryDay } from '@/features/service-orders/service-order-history';
import { SERVICE_ORDER_STATUS_LABELS } from '@/features/service-orders/state-machine';
import { useAuthStore } from '@/stores/auth-store';

const PAGE_SIZE = 100;
const ALL_STATUSES = Object.keys(SERVICE_ORDER_STATUS_LABELS) as ServiceOrderStatus[];
const ARCHIVED_STATUSES: ServiceOrderStatus[] = ['DELIVERED', 'CANCELLED'];
type ViewMode = 'board' | 'list';

export default function ServiceOrdersPage() {
  const user = useAuthStore((state) => state.user);
  const canManage = hasPermission(user, 'service_orders.manage');
  const canViewPrices = hasPermission(user, 'service_orders.prices');
  const [status, setStatus] = useState<ServiceOrderStatus | 'ALL'>('ALL');
  const [attention, setAttention] = useState<ServiceOrderAttentionFilter>('ACTIVE');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('board');
  const [offset, setOffset] = useState(0);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [period, setPeriod] = useState({ startDate: '', endDate: '' });
  const [dateField, setDateField] = useState<'OPENED' | 'CLOSED'>('OPENED');
  const request: ServiceOrderListRequest = {
    offset, limit: PAGE_SIZE, includeMetrics: true, dateField,
    startDate: period.startDate || undefined, endDate: period.endDate || undefined,
    status: status === 'ALL' ? undefined : status, search: search.trim() || undefined,
    attention: attention === 'ALL' ? undefined : attention,
  };
  const { data, isLoading, isFetching, isPlaceholderData, isError, refetch } = useServiceOrdersList(request);
  const pending = isLoading || isPlaceholderData;
  const invalidPeriod = Boolean(draftStart && draftEnd && draftStart > draftEnd);

  function updateFilter(change: () => void) { setOffset(0); change(); }
  function applyPeriod(startDate: string, endDate: string) {
    setDraftStart(startDate); setDraftEnd(endDate); setPeriod({ startDate, endDate });
    setOffset(0); setAttention('ALL'); setView('list');
  }

  useEffect(() => {
    const stored = window.localStorage.getItem('service-orders-view');
    if (stored === 'board' || stored === 'list') setView(stored);
  }, []);

  function changeView(next: ViewMode) {
    setView(next);
    setOffset(0);
    if (next === 'board') {
      if (status === 'DELIVERED' || status === 'CANCELLED') setStatus('ALL');
      if (attention === 'ALL') setAttention('ACTIVE');
      setDateField('OPENED');
    }
    window.localStorage.setItem('service-orders-view', next);
  }

  const items = data?.items ?? [];
  const metrics = data?.metrics;
  const archivedFilter = status !== 'ALL' && ARCHIVED_STATUSES.includes(status);
  const includesArchived = status === 'ALL' && (attention === 'ALL' || attention === 'PAYMENT_PENDING');
  const effectiveView: ViewMode = archivedFilter || dateField === 'CLOSED' || includesArchived ? 'list' : view;
  const hasFilters = Boolean(search || status !== 'ALL' || attention !== 'ACTIVE' || period.startDate || period.endDate || dateField !== 'OPENED');
  const periodLabel = period.startDate || period.endDate
    ? `${period.startDate ? formatHistoryDay(period.startDate) : 'Início do histórico'}${period.endDate ? ` até ${formatHistoryDay(period.endDate)}` : ' em diante'}`
    : 'Todo o histórico';

  function clearFilters() {
    setSearch('');
    setStatus('ALL');
    setAttention('ACTIVE'); setOffset(0); setDateField('OPENED');
    setPeriod({ startDate: '', endDate: '' }); setDraftStart(''); setDraftEnd('');
  }

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-0">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Controle operacional</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-text">Fila de ordens de serviço</h2>
          <p className="mt-1 text-sm text-text-muted">Priorize atrasos, remova bloqueios e acompanhe cada veículo até a entrega.</p>
        </div>
        {canManage && <NewServiceOrderQuickStart className="shrink-0" />}
      </header>

      <section aria-label="Período do histórico" className="rounded-card border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text">Histórico por dia ou período</h3>
          <div className="flex flex-wrap gap-1">
            {[['Hoje', 0], ['Ontem', 1], ['Últimos 7 dias', 6], ['Últimos 30 dias', 29]].map(([label, days]) => <Button key={label} size="sm" variant="outline" onClick={() => { const today = workshopToday(); applyPeriod(shiftCalendarDay(today, -Number(days)), label === 'Ontem' ? shiftCalendarDay(today, -1) : today); }}>{label}</Button>)}
            <Button size="sm" variant="ghost" onClick={() => applyPeriod('', '')}>Todo o histórico</Button>
          </div>
        </div>
        <form className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.3fr_auto] xl:items-end" onSubmit={(event) => { event.preventDefault(); if (!invalidPeriod) applyPeriod(draftStart, draftEnd); }}>
          <label className="min-w-0 text-xs font-medium text-text-muted">Data inicial<Input type="date" className="mt-1 min-w-0" value={draftStart} max={draftEnd || undefined} onChange={(event) => setDraftStart(event.target.value)} /></label>
          <label className="min-w-0 text-xs font-medium text-text-muted">Data final<Input type="date" className="mt-1 min-w-0" value={draftEnd} min={draftStart || undefined} aria-invalid={invalidPeriod} onChange={(event) => setDraftEnd(event.target.value)} /></label>
          <div><span id="history-date-label" className="text-xs font-medium text-text-muted">Consultar pela data de</span><Select value={dateField} onValueChange={(value) => updateFilter(() => setDateField(value as 'OPENED' | 'CLOSED'))}><SelectTrigger aria-labelledby="history-date-label" className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPENED">Entrada na oficina</SelectItem><SelectItem value="CLOSED">Entrega ou cancelamento</SelectItem></SelectContent></Select></div>
          <Button type="submit" disabled={invalidPeriod}>Aplicar período</Button>
        </form>
        {invalidPeriod && <p role="alert" className="mt-2 text-sm text-danger">A data final deve ser igual ou posterior à inicial.</p>}
        <p className="mt-3 text-xs text-text-muted">{periodLabel} · Horário de Brasília. A lista usa a data de {dateField === 'OPENED' ? 'entrada' : 'entrega ou cancelamento'}; o card Entregues usa sempre a entrega efetiva. Os status exibidos são os atuais.</p>
      </section>

      <section aria-label="Resumo das ordens de serviço" aria-busy={isFetching} className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <MetricButton label="OS ativas" value={pending ? undefined : metrics?.active} detail="em fluxo operacional" icon={ClipboardText} active={attention === 'ACTIVE' && status === 'ALL'} onClick={() => updateFilter(() => { setStatus('ALL'); setAttention('ACTIVE'); })} />
        <MetricButton label="Atrasadas" value={pending ? undefined : metrics?.overdue} detail="prazo de entrega vencido" icon={Warning} tone="danger" active={attention === 'OVERDUE'} onClick={() => updateFilter(() => { setStatus('ALL'); setAttention('OVERDUE'); })} />
        <MetricButton label="Aguardando peças" value={pending ? undefined : metrics?.waitingParts} detail="veículos bloqueados" icon={Package} tone="warning" active={status === 'WAITING_PARTS'} onClick={() => updateFilter(() => { setStatus('WAITING_PARTS'); setAttention('ALL'); })} />
        <MetricButton label="Prontas" value={pending ? undefined : metrics?.ready} detail="aguardando entrega" icon={CheckCircle} tone="success" active={status === 'COMPLETED'} onClick={() => updateFilter(() => { setStatus('COMPLETED'); setAttention('ALL'); })} />
        <MetricButton label="Entregues" value={pending ? undefined : metrics?.delivered} detail={period.startDate || period.endDate ? 'entregas no período' : 'entregas em todo o histórico'} icon={CheckCircle} tone="success" active={status === 'DELIVERED'} onClick={() => updateFilter(() => { setStatus('DELIVERED'); setAttention('ALL'); setDateField('CLOSED'); setView('list'); })} />
      </section>

      <section aria-label="Filtros das ordens de serviço" className="rounded-card border border-border bg-surface p-3">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(260px,1fr)_220px_220px_auto] 2xl:items-center">
          <div className="relative min-w-0">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <Input aria-label="Buscar ordens de serviço" placeholder="Buscar OS, placa ou cliente" maxLength={120} value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))} className="h-10 pl-9 pr-10" />
            {search && <button type="button" aria-label="Limpar busca" onClick={() => updateFilter(() => setSearch(''))} className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-button text-text-muted hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" aria-hidden="true" /></button>}
          </div>
          <Select value={status} onValueChange={(value) => updateFilter(() => { setStatus(value as ServiceOrderStatus | 'ALL'); setAttention('ALL'); if (value !== 'ALL') setView('list'); if (value === 'DELIVERED' || value === 'CANCELLED') setDateField('CLOSED'); })}>
            <SelectTrigger aria-label="Filtrar por status"><SlidersHorizontal className="mr-2 size-4 text-text-muted" aria-hidden="true" /><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">Todos os status</SelectItem>{ALL_STATUSES.map((value) => <SelectItem key={value} value={value}>{SERVICE_ORDER_STATUS_LABELS[value]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={attention} onValueChange={(value) => updateFilter(() => setAttention(value as ServiceOrderAttentionFilter))}>
            <SelectTrigger aria-label="Filtrar por atenção necessária"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as condições</SelectItem>
              <SelectItem value="ACTIVE">Em andamento</SelectItem>
              <SelectItem value="OVERDUE">Entrega atrasada</SelectItem>
              <SelectItem value="UNASSIGNED">Sem técnico</SelectItem>
              {canViewPrices && <SelectItem value="PAYMENT_PENDING">Pagamento pendente</SelectItem>}
            </SelectContent>
          </Select>
          <div className="flex h-10 items-center gap-1 rounded-button border border-border bg-background p-1" role="group" aria-label="Modo de visualização">
            <ViewButton label="Visualizar quadro" active={effectiveView === 'board'} onClick={() => changeView('board')}><GridFour className="size-4" /></ViewButton>
            <ViewButton label="Visualizar lista" active={effectiveView === 'list'} onClick={() => changeView('list')}><List className="size-4" /></ViewButton>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="text-sm text-text-muted"><span className="font-semibold text-text">{pending ? '—' : data?.total ?? 0}</span> {data?.total === 1 ? 'ordem encontrada' : 'ordens encontradas'}{hasFilters && ' com os filtros atuais'}</p>
        {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-text-muted">Limpar filtros<X className="size-3.5" aria-hidden="true" /></Button>}
      </div>

      {effectiveView === 'board'
        ? <ServiceOrderBoard items={items} isLoading={pending} isError={isError} onRetry={refetch} canManage={canManage} canViewPrices={canViewPrices} />
        : <ServiceOrdersTable items={items} isLoading={pending} isError={isError} onRetry={refetch} canViewPrices={canViewPrices} emptyMessage={hasFilters ? 'Nenhuma ordem corresponde aos filtros.' : undefined} />}

      {data && !isError && data.total > PAGE_SIZE && <nav aria-label="Páginas das ordens de serviço" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-text-muted">Página {Math.floor(offset / PAGE_SIZE) + 1} de {Math.ceil(data.total / PAGE_SIZE)} · {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} de {data.total}</p><div className="flex gap-2"><Button variant="outline" disabled={offset === 0 || isFetching} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}>Anterior</Button><Button variant="outline" disabled={!data.hasMore || isFetching} onClick={() => setOffset((value) => value + PAGE_SIZE)}>Próxima</Button></div></nav>}
    </div>
  );
}

function MetricButton({ label, value, detail, icon: Icon, tone = 'primary', active, onClick }: { label: string; value: number | undefined; detail: string; icon: React.ComponentType<{ className?: string }>; tone?: 'primary' | 'danger' | 'warning' | 'success'; active: boolean; onClick: () => void }) {
  const toneClass = tone === 'danger' ? 'bg-danger-subtle text-danger' : tone === 'warning' ? 'bg-warning-subtle text-warning' : tone === 'success' ? 'bg-success-subtle text-success' : 'bg-primary/10 text-primary';
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-card border bg-card p-4 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5 ${active ? 'border-primary/50 ring-1 ring-primary/15' : 'border-border hover:border-primary/30'}`}><span className={`flex size-9 items-center justify-center rounded-button ${toneClass}`}><Icon className="size-[18px]" aria-hidden="true" /></span><span className="mt-3 block text-2xl font-bold tabular-nums text-text">{value ?? '—'}</span><span className="mt-0.5 block text-sm font-semibold text-text">{label}</span><span className="mt-1 block text-xs text-text-muted">{detail}</span></button>;
}

function ViewButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className={`flex size-8 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-selection text-primary' : 'text-text-muted hover:text-text'}`}>{children}</button>;
}
