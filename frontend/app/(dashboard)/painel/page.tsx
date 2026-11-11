'use client';

import { PageHero } from '@/components/dashboard/PageHero';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarBlank, CalendarCheck, CheckCircle, CurrencyCircleDollar, ArrowClockwise, HourglassMedium, MagnifyingGlass, Warning, Users, Wrench } from '@phosphor-icons/react';
import type { AppointmentResponse, DashboardBusinessSummaryResponse, DashboardWaitingResponse, FinancialEntryResponse, ServiceOrderListItemResponse, ServiceOrderListRequest } from '@oficina/contracts';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { todayRange } from '@/features/dashboard/dashboard-model';
import { useDashboardBusinessSummary, useDashboardToday } from '@/features/dashboard/hooks/use-dashboard-summary';
import { useAppointments } from '@/features/appointments/hooks/use-appointments';
import { useEntitlements } from '@/features/plan/use-entitlements';
import { useCareForecast } from '@/features/customer-care/use-customer-care';
import { StatusBadge } from '@/features/service-orders/components/StatusBadge';
import { NewServiceOrderQuickStart } from '@/features/service-orders/components/NewServiceOrderQuickStart';
import { MyProductivityCard } from '@/features/service-orders/components/MyProductivityCard';
import { useDueServiceOrderInstallments, useServiceOrdersList } from '@/features/service-orders/hooks/use-service-orders';
import { useCashFlow } from '@/features/financial/hooks/use-financial';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';

const REFRESH_INTERVAL_MS = 60_000;
// "Contas a pagar/receber" show everything overdue plus what falls due in this window.
const DUE_WINDOW_DAYS = 7;
const MOBILE_ORDER_ROWS = 8;
type OrderFilter = NonNullable<ServiceOrderListRequest['attention']>;
const ORDER_FILTERS: { value: OrderFilter; label: string }[] = [
  { value: 'ACTIVE', label: 'Todas' },
  { value: 'OVERDUE', label: 'Atrasadas' },
  { value: 'UNASSIGNED', label: 'Sem técnico' },
];
const APPOINTMENT_STATUS_LABELS = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_SERVICE: 'Em atendimento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
} as const;

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const canManageReceipts = hasPermission(user, 'receipts.manage');
  const canManageServiceOrders = hasPermission(user, 'service_orders.manage');
  const { hasModule } = useEntitlements();
  const canViewFinance = hasPermission(user, 'finance.view') && hasModule('financeiro');
  const canViewAlerts = hasPermission(user, 'alerts.view') && hasModule('cuidado');
  const [range, setRange] = useState(() => todayRange());
  // One request carries the exact counts, the prioritized rows and the workload.
  const today = useDashboardToday(range);
  const monthSummary = useDashboardBusinessSummary(canViewFinance);
  // Order installments already show up in "Contas a receber" for finance users.
  const dueInstallments = useDueServiceOrderInstallments(canManageReceipts && !canViewFinance ? 4 : 0);
  const appointments = useAppointments(range);
  const forecast = useCareForecast(canViewAlerts);
  const dailyCashFlow = useCashFlow({ startAt: range.startsAt, endAt: range.endsAt }, { enabled: canViewFinance });
  const month = useMemo(() => monthToDate(range.startsAt), [range.startsAt]);
  const deliveredThisMonth = useServiceOrdersList({ status: 'DELIVERED', dateField: 'CLOSED', startDate: month.startDate, endDate: month.endDate, offset: 0, limit: 1 });
  const dueWindow = useMemo(() => ({ startAt: '2000-01-01T03:00:00.000Z', endAt: new Date(new Date(range.endsAt).getTime() + DUE_WINDOW_DAYS * 86_400_000).toISOString(), status: 'PENDING' as const }), [range.endsAt]);
  const dueEntries = useCashFlow(dueWindow, { enabled: canViewFinance });
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('ACTIVE');
  const debouncedSearch = useDebouncedValue(orderSearch.trim());
  const activeOrders = useServiceOrdersList({ attention: orderFilter, search: debouncedSearch || undefined, offset: 0, limit: 50 }, { enabled: canManageServiceOrders });

  // The screen stays open on the front desk: refresh periodically and roll
  // "today" over at midnight instead of showing yesterday's agenda and cash.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = todayRange();
      setRange((current) => (current.startsAt === next.startsAt ? current : next));
      void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'dashboard-business-summary' });
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [queryClient]);

  const metrics = today.data?.metrics;
  // Managers browse every open order; everyone else sees their own queue.
  const plateQuery = orderSearch.trim().toLowerCase();
  const tableOrders = canManageServiceOrders
    ? activeOrders.data?.items ?? []
    : (today.data?.mine.items ?? []).filter((item) => !plateQuery || `${item.vehiclePlate} ${item.customerName} ${item.orderNumber}`.toLowerCase().includes(plateQuery));
  const tableTotal = canManageServiceOrders ? activeOrders.data?.total ?? 0 : today.data?.mine.total ?? 0;
  const tableLoading = canManageServiceOrders ? activeOrders.isLoading : today.isLoading;
  const tableError = canManageServiceOrders ? activeOrders.isError : today.isError;
  const payables = (dueEntries.data?.entries ?? []).filter((entry) => entry.type === 'EXPENSE' && entry.status === 'PENDING').sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const receivables = (dueEntries.data?.entries ?? []).filter((entry) => entry.type === 'INCOME' && entry.status === 'PENDING').sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const workload = today.data?.workload ?? [];
  const waiting = today.data?.waiting;
  const mine = today.data?.mine;
  // Mechanics work their own queue; the shop-wide team view is for whoever manages orders.
  const showTeam = canManageServiceOrders;
  const showMine = canManageServiceOrders && (mine?.total ?? 0) > 0;
  const todayAppointments = (appointments.data?.items ?? [])
    .filter((item) => !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(item.status))
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  const occupiedHours = todayAppointments.reduce((total, item) => total + Math.max(0, (new Date(item.endsAt).getTime() - new Date(item.startsAt).getTime()) / 3_600_000), 0);
  const isRefreshing = today.isFetching || appointments.isFetching || forecast.isFetching || dueInstallments.isFetching || dailyCashFlow.isFetching || activeOrders.isFetching || dueEntries.isFetching;
  const approvals = waiting?.approvals;
  const lastUpdatedAt = today.dataUpdatedAt ? new Date(today.dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  const contactsToday = (forecast.data?.days.find((day) => day.date === forecast.data?.today)?.customers ?? []).filter((customer) => customer.kind === 'MAINTENANCE');
  const birthdaysToday = (forecast.data?.days.find((day) => day.date === forecast.data?.today)?.customers ?? []).filter((customer) => customer.kind === 'BIRTHDAY').length;
  const contactsWeek = (forecast.data?.days ?? []).filter((day) => forecast.data && day.date <= addDays(forecast.data.today, 6)).flatMap((day) => day.customers).filter((customer) => customer.kind === 'MAINTENANCE').length;

  function refreshDashboard() {
    void queryClient.invalidateQueries();
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Painel" title="Operação de hoje" description={`${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} · Agenda, pendências e veículos que exigem decisão agora.`} actions={<>
          {canViewFinance && <Link href="/financeiro" className="flex items-center gap-2 rounded-button border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-muted/40"><CurrencyCircleDollar className="size-4 text-text-muted" aria-hidden="true" /><span className="text-text-muted">Recebido hoje</span><strong className="tabular-nums text-text">{dailyCashFlow.isLoading ? '…' : formatCurrencyBRL(dailyCashFlow.data?.realizedIncomeCents ?? 0)}</strong></Link>}
          {lastUpdatedAt && <span className="text-xs text-text-muted" aria-live="polite">Atualizado às {lastUpdatedAt}</span>}
          <Button variant="outline" size="sm" onClick={refreshDashboard} disabled={isRefreshing}><ArrowClockwise className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />Atualizar</Button>
          {canManageServiceOrders && <NewServiceOrderQuickStart size="sm" />}
      </>} />

      <section aria-label="Resumo das ordens de serviço" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile order={0} href="/ordens-de-servico" label="OS em andamento" value={metrics?.active} caption={metrics?.overdue ? `${metrics.overdue} com entrega atrasada` : 'nenhuma entrega atrasada'} captionTone={metrics?.overdue ? 'danger' : 'muted'} icon={Wrench} tone="primary" loading={today.isLoading} error={today.isError} />
        <KpiTile order={1} href="/ordens-de-servico?status=DELIVERED" label="Entregues este mês" value={deliveredThisMonth.data?.total} caption={`desde 01/${month.startDate.slice(5, 7)}`} icon={CheckCircle} tone={(deliveredThisMonth.data?.total ?? 0) > 0 ? 'success' : 'neutral'} loading={deliveredThisMonth.isLoading} error={deliveredThisMonth.isError} />
        <KpiTile order={2} href="/ordens-de-servico?status=AWAITING_APPROVAL" label="Aguardando aprovação" value={approvals?.count} caption={waitingCaption(approvals, 'há mais de 2 dias', 'o mais antigo espera')} captionTone={approvals?.stale ? 'danger' : 'muted'} icon={HourglassMedium} tone={approvals?.stale ? 'danger' : (approvals?.count ?? 0) > 0 ? 'warning' : 'neutral'} loading={today.isLoading} error={today.isError} />
        <KpiTile order={3} href="/ordens-de-servico" label="Previsão de entrega hoje" value={metrics?.dueToday} caption={metrics?.ready ? `${metrics.ready} ${metrics.ready === 1 ? 'pronta' : 'prontas'} aguardando retirada` : 'nenhuma pronta no pátio'} icon={CalendarCheck} tone={(metrics?.dueToday ?? 0) > 0 ? 'info' : 'neutral'} loading={today.isLoading} error={today.isError} />
      </section>

      <Card data-reveal style={{ '--reveal-order': 4 } as React.CSSProperties} className="overflow-hidden">
        <CardHeader className="gap-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">{canManageServiceOrders ? 'OS em andamento' : 'Sua fila de trabalho'}{!tableLoading && !tableError && <Badge variant="neutral" className="tabular-nums">{tableTotal}</Badge>}</CardTitle>
            <p className="mt-1 text-sm text-text-muted">{canManageServiceOrders ? 'Da mais recente para a mais antiga, com o próximo passo de cada uma.' : 'Ordens atribuídas a você, por prioridade.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageServiceOrders && <div role="group" aria-label="Filtrar OS" className="flex rounded-button border border-border bg-muted/40 p-0.5">
              {ORDER_FILTERS.map((filter) => {
                const count = filter.value === 'OVERDUE' ? metrics?.overdue : filter.value === 'UNASSIGNED' ? metrics?.unassigned : undefined;
                const selected = orderFilter === filter.value;
                return <button key={filter.value} type="button" aria-pressed={selected} onClick={() => setOrderFilter(filter.value)} className={`flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'bg-card text-text shadow-card' : 'text-text-muted hover:text-text'}`}>{filter.label}{count ? <span className={`tabular-nums ${filter.value === 'OVERDUE' ? 'text-danger' : ''}`}>{count}</span> : null}</button>;
              })}
            </div>}
            <label className="relative w-full sm:w-52">
              <span className="sr-only">Buscar por placa, cliente ou número da OS</span>
              <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <Input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Placa, cliente ou nº" className="h-9 pl-8 text-sm" />
            </label>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tableLoading ? <RowsSkeleton /> : tableError ? <ErrorBlock action={refreshDashboard} /> : tableOrders.length === 0 ? <EmptyBlock icon={orderSearch ? MagnifyingGlass : CheckCircle} title={orderSearch ? 'Nenhuma OS encontrada' : canManageServiceOrders ? orderFilter === 'ACTIVE' ? 'Nenhuma OS em andamento' : 'Nada neste filtro' : 'Nada na sua fila'} detail={orderSearch ? 'Confira a placa ou o nome digitado.' : canManageServiceOrders ? 'Abra uma OS para acompanhar aqui.' : 'Nenhuma OS atribuída a você no momento.'} /> : <OrdersTable items={tableOrders} />}
          {!tableLoading && !tableError && tableTotal > tableOrders.length && !orderSearch && <Link href="/ordens-de-servico" className="flex items-center justify-center gap-1.5 border-t border-border px-5 py-3 text-xs font-semibold text-primary-ink hover:bg-muted/40 dark:text-primary">Ver todas as {tableTotal} OS<ArrowRight className="size-3.5" /></Link>}
          {!tableLoading && !tableError && tableOrders.length > 0 && (tableTotal <= tableOrders.length || orderSearch) && <Link href="/ordens-de-servico" className="flex items-center justify-center gap-1.5 border-t border-border px-5 py-3 text-xs font-semibold text-primary-ink hover:bg-muted/40 dark:text-primary">Abrir quadro de OS<ArrowRight className="size-3.5" /></Link>}
        </CardContent>
      </Card>

      {canViewFinance && <section aria-label="Contas a pagar e a receber" className="grid gap-5 lg:grid-cols-2">
        <DuePanel order={5} title="Contas a pagar" href="/financeiro/contas-a-pagar" entries={payables} loading={dueEntries.isLoading} error={dueEntries.isError} onRetry={dueEntries.refetch} emptyTitle="Nada a pagar" emptyDetail={`Nenhuma conta vencida ou a vencer em ${DUE_WINDOW_DAYS} dias.`} />
        <DuePanel order={6} title="Contas a receber" href="/financeiro/contas-a-receber" entries={receivables} loading={dueEntries.isLoading} error={dueEntries.isError} onRetry={dueEntries.refetch} emptyTitle="Nada a receber" emptyDetail={`Nenhum recebimento vencido ou previsto em ${DUE_WINDOW_DAYS} dias.`} />
      </section>}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="flex-row items-start justify-between border-b border-border">
            <div><CardTitle>Agenda de hoje</CardTitle><p className="mt-1 text-sm text-text-muted">{todayAppointments.length} {todayAppointments.length === 1 ? 'atendimento pendente' : 'atendimentos pendentes'}{todayAppointments.length > 0 ? ` · ${occupiedHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h reservadas` : ''}</p></div>
            <Button asChild variant="ghost" size="sm" className="text-primary"><Link href="/agenda">Abrir agenda<ArrowRight className="size-4" /></Link></Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">
            {appointments.isLoading ? <RowsSkeleton rows={4} /> : appointments.isError ? <ErrorBlock action={appointments.refetch} /> : todayAppointments.length === 0 ? <EmptyBlock icon={CalendarBlank} title="Agenda livre hoje" detail="Novos agendamentos aparecerão aqui." tone="neutral" /> : <div className="divide-y divide-border">{todayAppointments.slice(0, 5).map((item) => <AppointmentRow key={item.id} item={item} />)}{todayAppointments.length > 5 && <Link href="/agenda" className="block px-5 py-3 text-center text-xs font-semibold text-primary hover:bg-muted/40">+ {todayAppointments.length - 5} na agenda de hoje</Link>}</div>}
          </CardContent>
        </Card>
        {showMine && <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="flex-row items-start justify-between"><div><CardTitle>Minhas OS</CardTitle><p className="mt-1 text-sm text-text-muted">{mine?.total ? `${mine.total} ${mine.total === 1 ? 'OS atribuída a você' : 'OS atribuídas a você'}` : 'O que está atribuído a você.'}</p></div><Button asChild variant="ghost" size="sm" className="text-primary"><Link href="/ordens-de-servico">Abrir quadro</Link></Button></CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">{today.isLoading ? <RowsSkeleton rows={3} /> : today.isError ? <ErrorBlock action={refreshDashboard} /> : (mine?.items.length ?? 0) === 0 ? <EmptyBlock icon={CheckCircle} title="Nada na sua fila" detail="Nenhuma OS atribuída a você no momento." tone="success" /> : <div className="divide-y divide-border">{mine!.items.map((item) => <OrderRow key={item.id} item={item} />)}{mine!.total > mine!.items.length && <Link href="/ordens-de-servico" className="block px-5 py-3 text-center text-xs font-semibold text-primary hover:bg-muted/40">+ {mine!.total - mine!.items.length} na sua fila</Link>}</div>}</CardContent>
        </Card>}
        {user?.role === 'MECHANIC' && <MyProductivityCard />}

        {showTeam && <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader><CardTitle>OS por técnico</CardTitle><p className="mt-1 text-sm text-text-muted">Quantidade de OS abertas; não mede horas disponíveis.</p></CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">{today.isLoading ? <RowsSkeleton rows={3} /> : today.isError ? <ErrorBlock action={refreshDashboard} /> : workload.length === 0 ? <EmptyBlock icon={Users} title="Nenhuma equipe cadastrada" detail="Cadastre os técnicos em Configurações para acompanhar as OS." tone="neutral" /> : <div className="divide-y divide-border">{workload.slice(0, 6).map((entry) => { const load = entry.notStarted + entry.inProgress + entry.waitingParts; const unassigned = !entry.technicianId; const details = [entry.inProgress > 0 && `${entry.inProgress} em execução`, entry.notStarted > 0 && `${entry.notStarted} não ${entry.notStarted === 1 ? 'iniciada' : 'iniciadas'}`, entry.waitingParts > 0 && `${entry.waitingParts} aguardando peça`].filter(Boolean).join(' · '); return <div key={entry.technicianId ?? 'unassigned'} className="flex items-center justify-between gap-3 px-5 py-3.5"><div className="min-w-0"><p className="truncate text-sm font-semibold">{entry.technicianName}</p><p className="mt-0.5 truncate text-xs text-text-muted">{details || 'Sem OS no momento'}</p></div><Badge variant={unassigned ? 'critical' : load === 0 ? 'success' : load >= 4 ? 'attention' : 'default'}>{load === 0 && !unassigned ? 'Sem OS' : `${load} OS`}</Badge></div>; })}</div>}</CardContent>
        </Card>}

        {canViewAlerts && <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="flex-row items-start justify-between"><div><CardTitle>Clientes para contatar</CardTitle><p className="mt-1 text-sm text-text-muted">{forecast.data ? `${contactsToday.length} hoje · ${contactsWeek} nos próximos 7 dias${birthdaysToday ? ` · ${birthdaysToday} ${birthdaysToday === 1 ? 'aniversariante' : 'aniversariantes'}` : ''}` : 'Lembretes de cuidado e revisão.'}</p></div><Button asChild variant="ghost" size="sm" className="text-primary"><Link href="/relacionamento">Ver previsão</Link></Button></CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">{forecast.isLoading ? <RowsSkeleton rows={3} /> : forecast.isError ? <ErrorBlock action={forecast.refetch} /> : contactsToday.length === 0 ? <EmptyBlock icon={CheckCircle} title={forecast.data?.enabled ? 'Nenhum contato hoje' : 'Régua de cuidado pausada'} detail={forecast.data?.enabled ? 'Nenhum cliente com lembrete previsto para hoje.' : 'Ative os disparos em Fidelização de clientes para os lembretes saírem.'} tone={forecast.data?.enabled ? 'success' : 'neutral'} /> : <div className="divide-y divide-border">{contactsToday.slice(0, 4).map((customer) => { const first = customer.items[0]; const extra = customer.items.length - 1; return <Link key={customer.customerId} href="/relacionamento" className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"><div className="min-w-0"><p className="truncate text-sm font-semibold text-text">{customer.customerName}</p><p className="mt-0.5 truncate text-xs text-text-muted">{first.serviceName} · {first.vehicleName} · {first.plate}{extra > 0 ? ` +${extra}` : ''}</p></div><Badge variant={first.late ? 'attention' : 'default'}>{first.late ? 'Atrasado' : `Vence ${first.dueAt.slice(8, 10)}/${first.dueAt.slice(5, 7)}`}</Badge></Link>; })}{contactsToday.length > 4 && <Link href="/relacionamento" className="block px-5 py-3 text-center text-xs font-semibold text-primary hover:bg-muted/40">+ {contactsToday.length - 4} {contactsToday.length - 4 === 1 ? 'cliente' : 'clientes'} para contatar hoje</Link>}</div>}</CardContent>
        </Card>}

        {canViewFinance && <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="flex-row items-start justify-between"><div><CardTitle>O mês em números</CardTitle><p className="mt-1 text-sm text-text-muted">Recebido no mês contra o mês anterior.</p></div><Button asChild variant="ghost" size="sm" className="text-primary"><Link href="/financeiro">Financeiro</Link></Button></CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">{monthSummary.isLoading ? <RowsSkeleton rows={3} /> : monthSummary.isError || !monthSummary.data ? <ErrorBlock action={monthSummary.refetch} /> : <MonthNumbers data={monthSummary.data} />}</CardContent>
        </Card>}

        {canManageReceipts && !canViewFinance && <Card className="flex h-full flex-col overflow-hidden"><CardHeader className="flex-row items-start justify-between"><div><CardTitle>Pendências administrativas</CardTitle><p className="mt-1 text-sm text-text-muted">{dueInstallments.data?.total ? `${dueInstallments.data.total} ${dueInstallments.data.total === 1 ? 'parcela vencida ou a vencer' : 'parcelas vencidas ou a vencer'} em 3 dias.` : 'Parcelas vencidas ou a vencer.'}</p></div><Button asChild variant="ghost" size="sm" className="text-primary"><Link href="/financeiro/contas-a-receber">Financeiro</Link></Button></CardHeader><CardContent className="flex flex-1 flex-col divide-y divide-border p-0">{(dueInstallments.data?.items ?? []).map((item) => { const overdue = new Date(item.dueAt).getTime() < Date.now(); return <Link key={item.id} href={`/ordens-de-servico/${item.serviceOrderId}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/40"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.customerName} · parcela {item.installmentNumber}/{item.installmentCount}</p><p className="mt-0.5 text-xs text-text-muted">{item.orderNumber ? `OS ${item.orderNumber} · ` : ''}{overdue ? 'venceu' : 'vence'} em {new Date(item.dueAt).toLocaleDateString('pt-BR')}</p></div><div className="flex shrink-0 flex-col items-end gap-1"><span className="text-sm font-bold tabular-nums">{formatCurrencyBRL(item.amountCents)}</span><Badge variant={overdue ? 'critical' : 'attention'}>{overdue ? 'Vencida' : 'A vencer'}</Badge></div></Link>; })}{(dueInstallments.data?.items.length ?? 0) === 0 && <EmptyBlock icon={CheckCircle} title="Administrativo em dia" detail="Nenhuma parcela exige ação agora." tone="success" />}</CardContent></Card>}
      </section>

    </div>
  );
}

function waitingCaption(item: DashboardWaitingResponse | undefined, staleLabel: string, oldestLabel: string): string {
  if (!item || item.count === 0) return 'nada parado aqui';
  const parts = [item.stale > 0 ? `${item.stale} ${staleLabel}` : `${oldestLabel} há ${item.oldestDays} ${item.oldestDays === 1 ? 'dia' : 'dias'}`];
  if (item.amountCents !== undefined) parts.push(formatCurrencyBRL(item.amountCents));
  return parts.join(' · ');
}

function MonthNumbers({ data }: { data: DashboardBusinessSummaryResponse }) {
  const change = data.previousMonthRevenueCents ? Math.round(((data.monthRevenueCents - data.previousMonthRevenueCents) / data.previousMonthRevenueCents) * 100) : null;
  const rows = [
    { label: 'Recebido no mês', value: formatCurrencyBRL(data.monthRevenueCents), note: change === null ? 'sem base de comparação' : `${change >= 0 ? '+' : ''}${change}% sobre o mês anterior`, tone: change !== null && change < 0 ? 'text-danger' : 'text-text-muted' },
    { label: 'Ticket médio', value: formatCurrencyBRL(data.averageTicketCents), note: `${data.deliveredThisMonth} ${data.deliveredThisMonth === 1 ? 'OS entregue' : 'OS entregues'} no mês`, tone: 'text-text-muted' },
    { label: 'A receber', value: formatCurrencyBRL(data.accountsReceivableCents), note: 'saldo aberto das OS', tone: 'text-text-muted' },
  ];
  return <div className="divide-y divide-border">{rows.map((row) => <div key={row.label} className="flex items-center justify-between gap-3 px-5 py-3.5"><div className="min-w-0"><p className="text-sm font-semibold">{row.label}</p><p className={`mt-0.5 truncate text-xs ${row.tone}`}>{row.note}</p></div><span className="shrink-0 text-base font-bold tabular-nums">{row.value}</span></div>)}</div>;
}

function addDays(date: string, days: number): string { return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10); }

// Calendar dates (local time) from the 1st of the month up to today, as the order list expects.
function monthToDate(todayStartsAt: string): { startDate: string; endDate: string } {
  const today = new Date(todayStartsAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  const prefix = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  return { startDate: `${prefix}-01`, endDate: `${prefix}-${pad(today.getDate())}` };
}

type KpiTone = 'primary' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';
const KPI_TONES: Record<KpiTone, { bar: string; chip: string }> = {
  primary: { bar: 'bg-primary', chip: 'bg-primary/15 text-primary-ink dark:text-primary' },
  neutral: { bar: 'bg-border', chip: 'bg-muted text-text-muted' },
  success: { bar: 'bg-success', chip: 'bg-success-subtle text-success' },
  warning: { bar: 'bg-warning', chip: 'bg-warning-subtle text-warning' },
  danger: { bar: 'bg-danger', chip: 'bg-danger-subtle text-danger' },
  info: { bar: 'bg-info', chip: 'bg-info-subtle text-info' },
};

function KpiTile({ href, label, value, caption, captionTone = 'muted', icon: Icon, tone, loading, error, order }: { href: string; label: string; value?: number; caption: string; captionTone?: 'muted' | 'danger'; icon: React.ComponentType<{ className?: string; weight?: 'regular' | 'duotone' }>; tone: KpiTone; loading: boolean; error?: boolean; order: number }) {
  const toneClasses = KPI_TONES[tone];
  return (
    <Link
      href={href}
      data-reveal
      style={{ '--reveal-order': order } as React.CSSProperties}
      className="group relative flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-card p-3.5 shadow-card transition-[box-shadow,border-color] duration-normal ease-settle hover:border-text-muted/30 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${toneClasses.bar}`} />
      <div className="flex items-start justify-between gap-2">
        <p data-metric-label className="text-xs font-semibold leading-4 text-text-muted sm:text-sm sm:leading-5">{label}</p>
        <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-button sm:size-10 ${toneClasses.chip}`}><Icon className="size-4 sm:size-5" weight="duotone" /></span>
      </div>
      <div className="mt-1 flex min-h-9 items-end sm:mt-2 sm:min-h-12">
        {loading ? <div className="h-8 w-14 animate-pulse rounded bg-muted sm:h-10" /> : <p data-metric-value className="font-bold tabular-nums leading-none tracking-tight text-text text-3xl sm:text-4xl xl:text-[2.75rem]">{error ? '—' : value ?? 0}</p>}
      </div>
      <p data-metric-caption className={`mt-2 flex min-h-8 items-start justify-between gap-2 text-xs leading-4 ${captionTone === 'danger' && !error ? 'font-semibold text-danger' : 'text-text-muted'}`}>
        <span>{error ? 'Dados indisponíveis. Atualize a página.' : caption}</span>
        <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-text-muted opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100" />
      </p>
    </Link>
  );
}

function nextAction(item: ServiceOrderListItemResponse, overdue: boolean): string {
  if (overdue) return 'Reprogramar entrega e avisar cliente';
  if (item.status === 'WAITING_PARTS') return 'Confirmar previsão da peça';
  if (item.status === 'AWAITING_APPROVAL') return 'Cobrar resposta do cliente';
  if (item.status === 'COMPLETED') return 'Avisar cliente para retirada';
  if (!item.technicianName) return 'Atribuir técnico responsável';
  if (item.status === 'OPEN') return 'Iniciar execução';
  return 'Acompanhar execução';
}

function DeliveryCell({ value, overdue }: { value?: string; overdue: boolean }) {
  if (!value) return <span className="text-xs text-text-muted">sem prazo</span>;
  const date = new Date(value);
  const isToday = date.toDateString() === new Date().toDateString();
  const label = isToday ? `hoje ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (overdue) return <Badge variant="critical" className="tabular-nums">{label}</Badge>;
  if (isToday) return <Badge variant="info" className="tabular-nums">{label}</Badge>;
  return <span className="text-sm tabular-nums text-text">{label}</span>;
}

function Plate({ value }: { value: string }) {
  return <span className="inline-flex items-center rounded-[6px] border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-text">{value || '—'}</span>;
}

function OrdersTable({ items }: { items: ServiceOrderListItemResponse[] }) {
  const now = new Date();
  const rows = items.map((item) => {
    const overdue = Boolean(item.expectedDeliveryAt && new Date(item.expectedDeliveryAt) < now && item.status !== 'COMPLETED');
    return { item, overdue, action: nextAction(item, overdue) };
  });
  return (
    <div className="md:max-h-[480px] md:overflow-y-auto">
      {/* Phones get a short stack of rows (no scroll inside the page scroll); the table needs room for its columns. */}
      <ul className="divide-y divide-border md:hidden">
        {rows.slice(0, MOBILE_ORDER_ROWS).map(({ item, overdue, action }) => (
          <li key={item.id}>
            <Link href={`/ordens-de-servico/${item.id}`} className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold tabular-nums text-text-muted">#{item.orderNumber}</span><Plate value={item.vehiclePlate} /><StatusBadge status={item.status} /></div>
                <p className="mt-1.5 truncate text-sm font-semibold text-text">{item.vehicleBrand} {item.vehicleModel} · {item.customerName}</p>
                <p className={`mt-0.5 text-xs font-semibold ${overdue ? 'text-danger' : 'text-primary-ink dark:text-primary'}`}>{action}</p>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-text-muted"><DeliveryCell value={item.expectedDeliveryAt} overdue={overdue} /><span className="truncate">{item.technicianName ?? 'sem técnico'}</span></div>
              </div>
              <ArrowRight className="mt-1 size-4 shrink-0 text-text-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="sticky top-0 z-10 bg-card text-xs font-semibold text-text-muted shadow-[inset_0_-1px_0_var(--border)]">
          <tr>
            <th scope="col" className="py-2.5 pl-5 pr-3 font-semibold">OS</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Placa</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Veículo e cliente</th>
            <th scope="col" className="hidden px-3 py-2.5 font-semibold lg:table-cell">Técnico</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Previsão</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
            <th scope="col" className="hidden px-3 py-2.5 font-semibold xl:table-cell">Próximo passo</th>
            <th scope="col" className="w-10 pr-5"><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ item, overdue, action }) => (
            <tr key={item.id} className="group relative transition-colors hover:bg-muted/40">
              <td className="py-3 pl-5 pr-3 font-bold tabular-nums text-text">
                {/* The whole row opens the order; the link covers it. */}
                <Link href={`/ordens-de-servico/${item.id}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring" aria-label={`Abrir OS ${item.orderNumber}, ${item.vehiclePlate}`}>{item.orderNumber}</Link>
              </td>
              <td className="px-3 py-3"><Plate value={item.vehiclePlate} /></td>
              <td className="max-w-[260px] px-3 py-3"><p className="truncate font-semibold text-text">{item.vehicleBrand} {item.vehicleModel}</p><p className="truncate text-xs text-text-muted">{item.customerName}</p></td>
              <td className="hidden max-w-[160px] truncate px-3 py-3 lg:table-cell">{item.technicianName ? <span className="text-text">{item.technicianName}</span> : <span className="text-xs font-semibold text-warning">sem técnico</span>}</td>
              <td className="whitespace-nowrap px-3 py-3"><DeliveryCell value={item.expectedDeliveryAt} overdue={overdue} /></td>
              <td className="px-3 py-3"><StatusBadge status={item.status} /></td>
              <td className={`hidden max-w-[240px] truncate px-3 py-3 text-xs font-semibold xl:table-cell ${overdue ? 'text-danger' : 'text-text-muted'}`}>{action}</td>
              <td className="pr-5 text-right"><ArrowRight className="ml-auto size-4 text-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DuePanel({ title, href, entries, loading, error, onRetry, emptyTitle, emptyDetail, order }: { title: string; href: string; entries: FinancialEntryResponse[]; loading: boolean; error: boolean; onRetry: () => unknown; emptyTitle: string; emptyDetail: string; order: number }) {
  const now = new Date();
  const total = entries.reduce((sum, entry) => sum + entry.amountCents, 0);
  const overdueCount = entries.filter((entry) => new Date(entry.dueAt) < now).length;
  return (
    <Card data-reveal style={{ '--reveal-order': order } as React.CSSProperties} className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-text-muted">{loading || error ? `Vencidas e próximos ${DUE_WINDOW_DAYS} dias` : <>{entries.length} {entries.length === 1 ? 'lançamento' : 'lançamentos'}{overdueCount > 0 && <> · <span className="font-semibold text-danger">{overdueCount} {overdueCount === 1 ? 'vencido' : 'vencidos'}</span></>}</>}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {!loading && !error && entries.length > 0 && <span className="text-lg font-bold tabular-nums text-text">{formatCurrencyBRL(total)}</span>}
          <Link href={href} className="text-xs font-semibold text-primary-ink hover:underline dark:text-primary">Ver todas</Link>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-0">
        {loading ? <RowsSkeleton rows={3} /> : error ? <ErrorBlock action={onRetry} /> : entries.length === 0 ? <EmptyBlock icon={CheckCircle} title={emptyTitle} detail={emptyDetail} /> : (
          <ul className="divide-y divide-border">
            {entries.slice(0, 5).map((entry) => {
              const overdue = new Date(entry.dueAt) < now;
              const party = entry.supplierName ?? entry.customerName;
              const target = entry.serviceOrderId ? `/ordens-de-servico/${entry.serviceOrderId}` : href;
              return (
                <li key={entry.id}>
                  <Link href={target} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                    <Badge variant={overdue ? 'critical' : 'neutral'} className="w-[4.25rem] shrink-0 justify-center tabular-nums">{new Date(entry.dueAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text">{entry.description}</p>
                      <p className="truncate text-xs text-text-muted">{[party, entry.serviceOrderNumber ? `OS ${entry.serviceOrderNumber}` : entry.categoryName].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span className={`shrink-0 text-sm font-bold tabular-nums ${overdue ? 'text-danger' : 'text-text'}`}>{formatCurrencyBRL(entry.amountCents)}</span>
                  </Link>
                </li>
              );
            })}
            {entries.length > 5 && <li><Link href={href} className="block px-5 py-3 text-center text-xs font-semibold text-primary-ink hover:bg-muted/40 dark:text-primary">+ {entries.length - 5} {entries.length - 5 === 1 ? 'lançamento' : 'lançamentos'}</Link></li>}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AppointmentRow({ item }: { item: AppointmentResponse }) {
  return <Link href="/agenda" className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"><time className="w-11 shrink-0 text-sm font-bold tabular-nums text-primary">{new Date(item.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-text">{item.customerName} · {item.vehiclePlate}</p><p className="mt-0.5 truncate text-xs text-text-muted">{item.serviceDescription}</p></div><Badge variant={item.status === 'CONFIRMED' ? 'success' : item.status === 'IN_SERVICE' ? 'info' : 'default'}>{APPOINTMENT_STATUS_LABELS[item.status]}</Badge></Link>;
}

function OrderRow({ item }: { item: ServiceOrderListItemResponse }) {
  const overdue = item.expectedDeliveryAt && new Date(item.expectedDeliveryAt) < new Date();
  const action = overdue ? 'Reprogramar entrega e avisar cliente' : item.status === 'WAITING_PARTS' ? 'Confirmar previsão da peça' : item.status === 'AWAITING_APPROVAL' ? 'Cobrar resposta do cliente' : !item.technicianName ? 'Atribuir técnico responsável' : item.status === 'COMPLETED' ? 'Avisar cliente para retirada' : item.status === 'OPEN' ? 'Iniciar execução' : 'Acompanhar execução';
  const due = item.expectedDeliveryAt ? new Date(item.expectedDeliveryAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'sem prazo';
  return <Link href={`/ordens-de-servico/${item.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"><div className="flex size-10 shrink-0 items-center justify-center rounded-button bg-muted text-xs font-bold text-text">{item.vehiclePlate.slice(-4)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-text">{item.vehicleBrand} {item.vehicleModel}</p><StatusBadge status={item.status} />{overdue && <Badge variant="critical">Atrasada</Badge>}</div><p className="mt-1 text-xs font-semibold text-primary">{action}</p><p className="mt-0.5 truncate text-[11px] text-text-muted">Prazo: {due} · Responsável: {item.technicianName ?? 'não atribuído'} · {item.customerName}</p></div><ArrowRight className="size-4 shrink-0 text-text-muted" /></Link>;
}

function RowsSkeleton({ rows = 4 }: { rows?: number }) { return <div className="divide-y divide-border">{Array.from({ length: rows }).map((_, index) => <div key={index} className="flex items-center gap-3 px-5 py-4"><div className="size-10 animate-pulse rounded-button bg-muted" /><div className="flex-1 space-y-2"><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /></div></div>)}</div>; }
function EmptyBlock({ icon: Icon, title, detail, tone = 'neutral' }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string; tone?: 'neutral' | 'success' }) { const toneClass = tone === 'success' ? 'bg-success-subtle text-success' : 'bg-muted text-text-muted'; return <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center"><div className={`mb-3 flex size-10 items-center justify-center rounded-full ${toneClass}`}><Icon className="size-5" /></div><p className="text-sm font-semibold text-text">{title}</p><p className="mt-1 text-xs text-text-muted">{detail}</p></div>; }
function ErrorBlock({ action }: { action: () => unknown }) { return <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center"><Warning className="mb-3 size-5 text-danger" /><p className="text-sm font-semibold text-text">Não foi possível carregar estes dados.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => action()}>Tentar novamente</Button></div>; }
