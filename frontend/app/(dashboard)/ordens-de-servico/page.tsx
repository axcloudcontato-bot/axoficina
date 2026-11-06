'use client';

import { PageHero } from '@/components/dashboard/PageHero';

import { useEffect, useState } from 'react';
import { Warning, CheckCircle, ClipboardText, GridFour, List, Package, MagnifyingGlass, SlidersHorizontal, X } from '@phosphor-icons/react';
import type { ServiceOrderStatus, ServiceOrderListRequest } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarRangeSelect } from '@/components/ui/calendar-range-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { canSeeAmounts, hasPermission } from '@/features/auth/permissions';
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
type Section = 'queue' | 'all' | 'history';

export default function ServiceOrdersPage() {
  const user = useAuthStore((state) => state.user);
  const canManage = hasPermission(user, 'service_orders.manage');
  const canViewPrices = canSeeAmounts(user);
  const [status, setStatus] = useState<ServiceOrderStatus | 'ALL'>('ALL');
  const [attention, setAttention] = useState<ServiceOrderAttentionFilter>('ACTIVE');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [urlReady, setUrlReady] = useState(false);
  const [view, setView] = useState<ViewMode>('board');
  const [section, setSection] = useState<Section>('queue');
  const [offset, setOffset] = useState(0);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [period, setPeriod] = useState({ startDate: '', endDate: '' });
  const [dateField, setDateField] = useState<'OPENED' | 'CLOSED'>('OPENED');
  const request: ServiceOrderListRequest = {
    offset, limit: PAGE_SIZE, includeMetrics: true, dateField,
    startDate: period.startDate || undefined, endDate: period.endDate || undefined,
    status: status === 'ALL' ? undefined : status, search: debouncedSearch.trim() || undefined,
    attention: section === 'history' ? 'ARCHIVED' : attention === 'ALL' ? undefined : attention,
  };
  const { data, isLoading, isFetching, isPlaceholderData, isError, refetch } = useServiceOrdersList(request);
  const pending = isLoading || isPlaceholderData || search !== debouncedSearch;
  const invalidPeriod = Boolean(draftStart && draftEnd && draftStart > draftEnd);

  function updateFilter(change: () => void) { setOffset(0); change(); }
  function applyPeriod(startDate: string, endDate: string) {
    setDraftStart(startDate); setDraftEnd(endDate); setPeriod({ startDate, endDate });
    setOffset(0);
  }

  function changeSection(next: Section) {
    setSection(next); setOffset(0); setStatus('ALL'); setSearch(''); setDebouncedSearch('');
    setAttention(next === 'queue' ? 'ACTIVE' : 'ALL');
    setDateField(next === 'history' ? 'CLOSED' : 'OPENED');
    setPeriod({ startDate: '', endDate: '' }); setDraftStart(''); setDraftEnd('');
    setView(next === 'queue' ? 'board' : 'list');
  }

  useEffect(() => {
    const stored = window.localStorage.getItem('service-orders-view');
    if (stored === 'board' || stored === 'list') setView(stored);
    // Deep links from the dashboard cards (?status=COMPLETED, ?attention=OVERDUE).
    const params = new URLSearchParams(window.location.search);
    const linkedSection = params.get('section');
    if (linkedSection === 'all' || linkedSection === 'history') { setSection(linkedSection); setAttention('ALL'); setView('list'); if (linkedSection === 'history') setDateField('CLOSED'); }
    const linkedStatus = params.get('status'); const linkedAttention = params.get('attention');
    if (linkedStatus && (ALL_STATUSES as string[]).includes(linkedStatus)) {
      setStatus(linkedStatus as ServiceOrderStatus);
      if (!linkedAttention) { setAttention('ALL'); if (linkedStatus === 'DELIVERED' || linkedStatus === 'CANCELLED') { setSection('history'); setDateField('CLOSED'); setView('list'); } }
    }
    if (linkedAttention && ['ACTIVE', 'OVERDUE', 'UNASSIGNED', 'PAYMENT_PENDING'].includes(linkedAttention)) setAttention(linkedAttention as ServiceOrderAttentionFilter);
    const linkedSearch = params.get('q');
    if (linkedSearch) { setSearch(linkedSearch); setDebouncedSearch(linkedSearch); }
    setUrlReady(true);
  }, []);

  // Typing does not hit the API on every key.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Filters live in the address so a link, a refresh or the back button keeps them.
  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (section !== 'queue') params.set('section', section);
    if (status !== 'ALL') params.set('status', status);
    if (attention !== 'ACTIVE') params.set('attention', attention);
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [urlReady, section, status, attention, debouncedSearch]);

  function changeView(next: ViewMode) {
    setView(next);
    setOffset(0);
    window.localStorage.setItem('service-orders-view', next);
  }

  const items = data?.items ?? [];
  const metrics = data?.metrics;
  const archivedFilter = status !== 'ALL' && ARCHIVED_STATUSES.includes(status);
  const includesArchived = status === 'ALL' && (attention === 'ALL' || attention === 'PAYMENT_PENDING');
  const effectiveView: ViewMode = section !== 'queue' || archivedFilter || dateField === 'CLOSED' || includesArchived || (data?.total ?? 0) > PAGE_SIZE ? 'list' : view;
  const hasFilters = Boolean(search || status !== 'ALL' || (section !== 'history' && attention !== (section === 'queue' ? 'ACTIVE' : 'ALL')) || period.startDate || period.endDate || dateField !== (section === 'history' ? 'CLOSED' : 'OPENED'));
  const periodLabel = period.startDate || period.endDate
    ? `${period.startDate ? formatHistoryDay(period.startDate) : 'Início do histórico'}${period.endDate ? ` até ${formatHistoryDay(period.endDate)}` : ' em diante'}`
    : 'Todo o histórico';

  function clearFilters() {
    setSearch(''); setDebouncedSearch('');
    setStatus('ALL');
    setAttention(section === 'queue' ? 'ACTIVE' : 'ALL'); setOffset(0); setDateField(section === 'history' ? 'CLOSED' : 'OPENED');
    setPeriod({ startDate: '', endDate: '' }); setDraftStart(''); setDraftEnd('');
  }

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-0">
      <PageHero eyebrow="Controle operacional" title="Ordens de serviço" description="Acompanhe a fila de trabalho, consulte todas as ordens ou veja o histórico." actions={canManage && <NewServiceOrderQuickStart className="shrink-0" label="Nova ordem de serviço" />} />

      <nav aria-label="Seções de ordens de serviço" className="flex flex-wrap gap-2 border-b border-border pb-3">
        {([['queue', 'Fila de trabalho'], ['all', 'Todas as ordens'], ['history', 'Histórico']] as const).map(([key, label]) => <button key={key} type="button" aria-current={section === key ? 'page' : undefined} onClick={() => changeSection(key)} className={`rounded-button px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${section === key ? 'bg-primary text-primary-foreground' : 'bg-surface text-text-muted hover:text-text'}`}>{label}</button>)}
      </nav>

      {section === 'queue' && <section aria-label="Resumo das ordens de serviço" aria-busy={isFetching} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricButton label="OS ativas" value={pending ? undefined : metrics?.active} detail="em fluxo operacional" icon={ClipboardText} active={attention === 'ACTIVE' && status === 'ALL'} onClick={() => updateFilter(() => { setStatus('ALL'); setAttention('ACTIVE'); })} />
        <MetricButton label="Atrasadas" value={pending ? undefined : metrics?.overdue} detail="prazo de entrega vencido" icon={Warning} tone="danger" active={attention === 'OVERDUE'} onClick={() => updateFilter(() => { setStatus('ALL'); setAttention('OVERDUE'); })} />
        <MetricButton label="Aguardando peças" value={pending ? undefined : metrics?.waitingParts} detail="veículos bloqueados" icon={Package} tone="warning" active={status === 'WAITING_PARTS'} onClick={() => updateFilter(() => { setStatus('WAITING_PARTS'); setAttention('ALL'); })} />
        <MetricButton label="Prontas" value={pending ? undefined : metrics?.ready} detail="aguardando entrega" icon={CheckCircle} tone="success" active={status === 'COMPLETED'} onClick={() => updateFilter(() => { setStatus('COMPLETED'); setAttention('ALL'); })} />
      </section>}

      <section aria-label="Filtros das ordens de serviço" className="rounded-card border border-border bg-surface p-3">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(260px,1fr)_220px_220px_auto] 2xl:items-center">
          <div className="relative min-w-0">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <Input aria-label="Buscar ordens de serviço" placeholder="Número da OS, placa ou nome do cliente" maxLength={120} value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))} className="h-10 pl-9 pr-10" />
            {search && <button type="button" aria-label="Limpar busca" onClick={() => updateFilter(() => { setSearch(''); setDebouncedSearch(''); })} className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-button text-text-muted hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" aria-hidden="true" /></button>}
          </div>
          <Select value={status} onValueChange={(value) => updateFilter(() => setStatus(value as ServiceOrderStatus | 'ALL'))}>
            <SelectTrigger aria-label="Filtrar por etapa da OS"><SlidersHorizontal className="mr-2 size-4 text-text-muted" aria-hidden="true" /><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">Todas as etapas</SelectItem>{ALL_STATUSES.filter((value) => section === 'all' || (section === 'history' ? ARCHIVED_STATUSES.includes(value) : !ARCHIVED_STATUSES.includes(value))).map((value) => <SelectItem key={value} value={value}>{SERVICE_ORDER_STATUS_LABELS[value]}</SelectItem>)}</SelectContent>
          </Select>
          {section !== 'history' && <Select value={attention} onValueChange={(value) => updateFilter(() => setAttention(value as ServiceOrderAttentionFilter))}>
            <SelectTrigger aria-label="Filtrar por pendência"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as condições</SelectItem>
              <SelectItem value="ACTIVE">Em andamento</SelectItem>
              <SelectItem value="OVERDUE">Entrega atrasada</SelectItem>
              <SelectItem value="UNASSIGNED">Sem técnico</SelectItem>
              {canViewPrices && <SelectItem value="PAYMENT_PENDING">Pagamento pendente</SelectItem>}
            </SelectContent>
          </Select>}
          {section === 'queue' && <div className="flex h-10 items-center gap-1 rounded-button border border-border bg-background p-1" role="group" aria-label="Modo de visualização">
            <ViewButton label="Visualizar quadro" active={effectiveView === 'board'} onClick={() => changeView('board')}><GridFour className="size-4" /></ViewButton>
            <ViewButton label="Visualizar lista" active={effectiveView === 'list'} onClick={() => changeView('list')}><List className="size-4" /></ViewButton>
          </div>}
        </div>
      </section>

      {hasFilters && <div aria-label="Filtros aplicados" className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span>Filtros aplicados:</span>
        {status !== 'ALL' && <span className="rounded-button bg-muted px-2 py-1">Etapa: {SERVICE_ORDER_STATUS_LABELS[status]}</span>}
        {section !== 'history' && attention !== 'ALL' && <span className="rounded-button bg-muted px-2 py-1">Pendência: {{ ACTIVE: 'Em andamento', OVERDUE: 'Entrega atrasada', UNASSIGNED: 'Sem técnico', PAYMENT_PENDING: 'Pagamento pendente' }[attention]}</span>}
        {search && <span className="rounded-button bg-muted px-2 py-1">Busca: {search}</span>}
        {(period.startDate || period.endDate) && <span className="rounded-button bg-muted px-2 py-1">{periodLabel}</span>}
      </div>}

      {section !== 'queue' && <details aria-label="Período da consulta" className="rounded-card border border-border bg-surface p-4" open={section === 'history' || Boolean(period.startDate || period.endDate)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <summary className="cursor-pointer text-sm font-semibold text-text">Filtrar por dia ou período</summary>
          <div className="flex flex-wrap gap-1">
            {[['Hoje', 0], ['Ontem', 1], ['Últimos 7 dias', 6], ['Últimos 30 dias', 29]].map(([label, days]) => <Button key={label} size="sm" variant="outline" onClick={() => { const today = workshopToday(); applyPeriod(shiftCalendarDay(today, -Number(days)), label === 'Ontem' ? shiftCalendarDay(today, -1) : today); }}>{label}</Button>)}
            <Button size="sm" variant="ghost" onClick={() => applyPeriod('', '')}>Todo o histórico</Button>
          </div>
        </div>
        <form className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1.3fr_auto] xl:items-end" onSubmit={(event) => { event.preventDefault(); if (!invalidPeriod) applyPeriod(draftStart, draftEnd); }}>
          <div className="min-w-0"><span className="text-xs font-medium text-text-muted">Período</span><div className="mt-1"><CalendarRangeSelect from={draftStart} to={draftEnd} onChange={(from, to) => { setDraftStart(from); setDraftEnd(to); }} /></div></div>
          <div><span id="history-date-label" className="text-xs font-medium text-text-muted">Consultar pela data de</span><Select value={dateField} onValueChange={(value) => updateFilter(() => setDateField(value as 'OPENED' | 'CLOSED'))}><SelectTrigger aria-labelledby="history-date-label" className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPENED">Entrada na oficina</SelectItem><SelectItem value="CLOSED">Entrega ou cancelamento</SelectItem></SelectContent></Select></div>
          <Button type="submit" disabled={invalidPeriod}>Aplicar período</Button>
        </form>
        {invalidPeriod && <p role="alert" className="mt-2 text-sm text-danger">A data final deve ser igual ou posterior à inicial.</p>}
        <p className="mt-3 text-xs text-text-muted">{periodLabel} · Horário de Brasília. Consulta pela data de {dateField === 'OPENED' ? 'entrada' : 'entrega ou cancelamento'}.</p>
      </details>}

      <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="text-sm text-text-muted"><span className="font-semibold text-text">{pending ? '—' : data?.total ?? 0}</span> {data?.total === 1 ? 'ordem encontrada' : 'ordens encontradas'}{hasFilters && ' com os filtros atuais'}</p>
        {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-text-muted">Limpar filtros<X className="size-3.5" aria-hidden="true" /></Button>}
      </div>

      {section === 'queue' && view === 'board' && data && data.total > PAGE_SIZE && <p role="status" className="rounded-button border border-warning/30 bg-warning-subtle p-3 text-sm text-text">Há {data.total} ordens nesta consulta. A lista foi aberta para permitir acesso a todas as páginas; o quadro comporta até {PAGE_SIZE} ordens.</p>}

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
