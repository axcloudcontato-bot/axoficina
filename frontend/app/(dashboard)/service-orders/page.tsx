'use client';

import { useEffect, useMemo, useState } from 'react';
import { Warning, CheckCircle, ClipboardText, GridFour, List, Package, MagnifyingGlass, SlidersHorizontal, X } from '@phosphor-icons/react';
import type { ServiceOrderStatus } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { hasPermission } from '@/features/auth/permissions';
import { ServiceOrderBoard } from '@/features/service-orders/components/ServiceOrderBoard';
import { NewServiceOrderQuickStart } from '@/features/service-orders/components/NewServiceOrderQuickStart';
import { ServiceOrdersTable } from '@/features/service-orders/components/ServiceOrdersTable';
import { useServiceOrdersList } from '@/features/service-orders/hooks/use-service-orders';
import { filterServiceOrders, getServiceOrderMetrics, type ServiceOrderAttentionFilter } from '@/features/service-orders/service-orders-view-model';
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
  const [attention, setAttention] = useState<ServiceOrderAttentionFilter>('ALL');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('board');
  const { data, isLoading, isError, refetch } = useServiceOrdersList({ offset: 0, limit: PAGE_SIZE });

  useEffect(() => {
    const stored = window.localStorage.getItem('service-orders-view');
    if (stored === 'board' || stored === 'list') setView(stored);
  }, []);

  function changeView(next: ViewMode) {
    setView(next);
    window.localStorage.setItem('service-orders-view', next);
  }

  const items = data?.items ?? [];
  const metrics = useMemo(() => getServiceOrderMetrics(items), [items]);
  const filteredItems = useMemo(
    () => filterServiceOrders(items, { search, status, attention }),
    [items, search, status, attention],
  );
  const archivedFilter = status !== 'ALL' && ARCHIVED_STATUSES.includes(status);
  const effectiveView: ViewMode = archivedFilter ? 'list' : view;
  const hasFilters = Boolean(search || status !== 'ALL' || attention !== 'ALL');

  function clearFilters() {
    setSearch('');
    setStatus('ALL');
    setAttention('ALL');
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

      <section aria-label="Resumo das ordens de serviço" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricButton label="OS ativas" value={metrics.active} detail="em fluxo operacional" icon={ClipboardText} active={attention === 'ALL' && status === 'ALL'} onClick={clearFilters} />
        <MetricButton label="Atrasadas" value={metrics.overdue} detail="prazo de entrega vencido" icon={Warning} tone="danger" active={attention === 'OVERDUE'} onClick={() => { setStatus('ALL'); setAttention('OVERDUE'); }} />
        <MetricButton label="Aguardando peças" value={metrics.waitingParts} detail="veículos bloqueados" icon={Package} tone="warning" active={status === 'WAITING_PARTS'} onClick={() => { setStatus('WAITING_PARTS'); setAttention('ALL'); }} />
        <MetricButton label="Prontas" value={metrics.ready} detail="aguardando entrega" icon={CheckCircle} tone="success" active={status === 'COMPLETED'} onClick={() => { setStatus('COMPLETED'); setAttention('ALL'); }} />
      </section>

      <section aria-label="Filtros das ordens de serviço" className="rounded-card border border-border bg-surface p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_220px_auto] lg:items-center">
          <div className="relative min-w-0">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <Input aria-label="Buscar ordens de serviço" placeholder="Buscar OS, placa ou cliente" value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 pl-9 pr-10" />
            {search && <button type="button" aria-label="Limpar busca" onClick={() => setSearch('')} className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-button text-text-muted hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" aria-hidden="true" /></button>}
          </div>
          <Select value={status} onValueChange={(value) => setStatus(value as ServiceOrderStatus | 'ALL')}>
            <SelectTrigger aria-label="Filtrar por status"><SlidersHorizontal className="mr-2 size-4 text-text-muted" aria-hidden="true" /><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">Todos os status</SelectItem>{ALL_STATUSES.map((value) => <SelectItem key={value} value={value}>{SERVICE_ORDER_STATUS_LABELS[value]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={attention} onValueChange={(value) => setAttention(value as ServiceOrderAttentionFilter)}>
            <SelectTrigger aria-label="Filtrar por atenção necessária"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as condições</SelectItem>
              <SelectItem value="OVERDUE">Entrega atrasada</SelectItem>
              <SelectItem value="UNASSIGNED">Sem técnico</SelectItem>
              <SelectItem value="PAYMENT_PENDING">Pagamento pendente</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex h-10 items-center gap-1 rounded-button border border-border bg-background p-1" role="group" aria-label="Modo de visualização">
            <ViewButton label="Visualizar quadro" active={effectiveView === 'board'} onClick={() => changeView('board')}><GridFour className="size-4" /></ViewButton>
            <ViewButton label="Visualizar lista" active={effectiveView === 'list'} onClick={() => changeView('list')}><List className="size-4" /></ViewButton>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="text-sm text-text-muted"><span className="font-semibold text-text">{isLoading ? '—' : filteredItems.length}</span> {filteredItems.length === 1 ? 'ordem encontrada' : 'ordens encontradas'}{hasFilters && ' com os filtros atuais'}</p>
        {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-text-muted">Limpar filtros<X className="size-3.5" aria-hidden="true" /></Button>}
      </div>

      {effectiveView === 'board'
        ? <ServiceOrderBoard items={filteredItems} isLoading={isLoading} isError={isError} onRetry={refetch} canManage={canManage} canViewPrices={canViewPrices} />
        : <ServiceOrdersTable items={filteredItems} isLoading={isLoading} isError={isError} onRetry={refetch} canViewPrices={canViewPrices} emptyMessage={hasFilters ? 'Nenhuma ordem corresponde aos filtros.' : undefined} />}

      {data && data.total > PAGE_SIZE && <div className="rounded-button border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning-strong">Mostrando as primeiras {PAGE_SIZE} de {data.total} ordens. Refine os filtros para localizar registros mais antigos.</div>}
    </div>
  );
}

function MetricButton({ label, value, detail, icon: Icon, tone = 'primary', active, onClick }: { label: string; value: number; detail: string; icon: React.ComponentType<{ className?: string }>; tone?: 'primary' | 'danger' | 'warning' | 'success'; active: boolean; onClick: () => void }) {
  const toneClass = tone === 'danger' ? 'bg-danger-subtle text-danger' : tone === 'warning' ? 'bg-warning-subtle text-warning' : tone === 'success' ? 'bg-success-subtle text-success' : 'bg-primary/10 text-primary';
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-card border bg-card p-4 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5 ${active ? 'border-primary/50 ring-1 ring-primary/15' : 'border-border hover:border-primary/30'}`}><span className={`flex size-9 items-center justify-center rounded-button ${toneClass}`}><Icon className="size-[18px]" aria-hidden="true" /></span><span className="mt-3 block text-2xl font-bold tabular-nums text-text">{value}</span><span className="mt-0.5 block text-sm font-semibold text-text">{label}</span><span className="mt-1 block text-xs text-text-muted">{detail}</span></button>;
}

function ViewButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className={`flex size-8 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-selection text-primary' : 'text-text-muted hover:text-text'}`}>{children}</button>;
}
