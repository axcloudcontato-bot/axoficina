'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarBlank, CheckCircle, CurrencyCircleDollar, ArrowClockwise, Warning, Users, Wallet, Wrench } from '@phosphor-icons/react';
import type { AppointmentResponse, DashboardBusinessSummaryResponse, DashboardWaitingResponse, ServiceOrderListItemResponse } from '@oficina/contracts';
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
import { useDueServiceOrderInstallments } from '@/features/service-orders/hooks/use-service-orders';
import { useCashFlow } from '@/features/financial/hooks/use-financial';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';

const REFRESH_INTERVAL_MS = 60_000;
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
  const canViewFinance = hasPermission(user, 'finance.view');
  const { hasModule } = useEntitlements();
  const canViewAlerts = hasPermission(user, 'alerts.view') && hasModule('cuidado');
  const [range, setRange] = useState(() => todayRange());
  // One request carries the exact counts, the prioritized rows and the workload.
  const today = useDashboardToday(range);
  const monthSummary = useDashboardBusinessSummary(canViewFinance);
  const dueInstallments = useDueServiceOrderInstallments(canManageReceipts ? 4 : 0);
  const appointments = useAppointments(range);
  const forecast = useCareForecast(canViewAlerts);
  const dailyCashFlow = useCashFlow({ startAt: range.startsAt, endAt: range.endsAt }, { enabled: canViewFinance });

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
  const operationalItems = canManageServiceOrders ? today.data?.attention.items ?? [] : today.data?.mine.items ?? [];
  const hiddenAttention = Math.max(0, (canManageServiceOrders ? today.data?.attention.total ?? 0 : today.data?.mine.total ?? 0) - operationalItems.length);
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
  const isRefreshing = today.isFetching || appointments.isFetching || forecast.isFetching || dueInstallments.isFetching || dailyCashFlow.isFetching;
  const lastUpdatedAt = today.dataUpdatedAt ? new Date(today.dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  const contactsToday = (forecast.data?.days.find((day) => day.date === forecast.data?.today)?.customers ?? []).filter((customer) => customer.kind === 'MAINTENANCE');
  const birthdaysToday = (forecast.data?.days.find((day) => day.date === forecast.data?.today)?.customers ?? []).filter((customer) => customer.kind === 'BIRTHDAY').length;
  const contactsWeek = (forecast.data?.days ?? []).filter((day) => forecast.data && day.date <= addDays(forecast.data.today, 6)).flatMap((day) => day.customers).filter((customer) => customer.kind === 'MAINTENANCE').length;

  function refreshDashboard() {
    void queryClient.invalidateQueries();
  }

  return (
    <div className="flex flex-col gap-5">
      <header data-reveal className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text">Operação de hoje</h2>
          <p className="mt-1.5 text-sm text-text-muted">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} · Agenda, pendências e veículos que exigem decisão agora.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {canViewFinance && <Link href="/financeiro" className="flex items-center gap-2 rounded-button border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-muted/40"><CurrencyCircleDollar className="size-4 text-text-muted" aria-hidden="true" /><span className="text-text-muted">Recebido hoje</span><strong className="tabular-nums text-text">{dailyCashFlow.isLoading ? '…' : formatCurrencyBRL(dailyCashFlow.data?.realizedIncomeCents ?? 0)}</strong></Link>}
          {lastUpdatedAt && <span className="text-xs text-text-muted" aria-live="polite">Atualizado às {lastUpdatedAt}</span>}
          <Button variant="outline" size="sm" onClick={refreshDashboard} disabled={isRefreshing}><ArrowClockwise className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />Atualizar</Button>
          {canManageServiceOrders && <NewServiceOrderQuickStart size="sm" />}
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <Card data-reveal style={{ '--reveal-order': 8 } as React.CSSProperties} className="flex h-full flex-col overflow-hidden">
          <CardHeader className="flex-row items-start justify-between border-b border-border">
            <div><CardTitle>{canManageServiceOrders ? 'Atenção agora' : 'Sua fila de trabalho'}</CardTitle><p className="mt-1 text-sm text-text-muted">{canManageServiceOrders ? 'Atrasos, bloqueios e decisões pendentes.' : 'Ordens atribuídas a você, por prioridade.'}</p></div>
            <Button asChild variant="ghost" size="sm" className="text-primary"><Link href="/ordens-de-servico">Abrir quadro<ArrowRight className="size-4" /></Link></Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">
            {today.isLoading ? <RowsSkeleton /> : today.isError ? <ErrorBlock action={refreshDashboard} /> : operationalItems.length === 0 ? <EmptyBlock icon={CheckCircle} title={canManageServiceOrders ? 'Operação em dia' : 'Nada na sua fila'} detail={canManageServiceOrders ? 'Nenhuma OS exige atenção agora.' : 'Nenhuma OS atribuída a você no momento.'} tone="success" /> : <div className="divide-y divide-border">{operationalItems.map((item) => <OrderRow key={item.id} item={item} />)}{hiddenAttention > 0 && <Link href="/ordens-de-servico" className="block px-5 py-3 text-center text-xs font-semibold text-primary hover:bg-muted/40">+ {hiddenAttention} {hiddenAttention === 1 ? 'outra OS' : 'outras OS'} pedindo atenção</Link>}</div>}
          </CardContent>
        </Card>
        <Card data-reveal style={{ '--reveal-order': 7 } as React.CSSProperties} className="flex h-full flex-col overflow-hidden">
          <CardHeader className="flex-row items-start justify-between border-b border-border">
            <div><CardTitle>Agenda de hoje</CardTitle><p className="mt-1 text-sm text-text-muted">{todayAppointments.length} {todayAppointments.length === 1 ? 'atendimento pendente' : 'atendimentos pendentes'}</p></div>
            <Button asChild variant="ghost" size="sm" className="text-primary"><Link href="/agenda">Abrir agenda<ArrowRight className="size-4" /></Link></Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">
            {appointments.isLoading ? <RowsSkeleton rows={4} /> : appointments.isError ? <ErrorBlock action={appointments.refetch} /> : todayAppointments.length === 0 ? <EmptyBlock icon={CalendarBlank} title="Agenda livre hoje" detail="Novos agendamentos aparecerão aqui." tone="neutral" /> : <div className="divide-y divide-border">{todayAppointments.slice(0, 5).map((item) => <AppointmentRow key={item.id} item={item} />)}{todayAppointments.length > 5 && <Link href="/agenda" className="block px-5 py-3 text-center text-xs font-semibold text-primary hover:bg-muted/40">+ {todayAppointments.length - 5} na agenda de hoje</Link>}</div>}
          </CardContent>
        </Card>

      </section>

      {canManageServiceOrders && <section aria-label="Prioridades da oficina" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricLink order={0} href="/ordens-de-servico?attention=OVERDUE" label="Entregas atrasadas" value={metrics?.overdue} caption="prazo prometido vencido" icon={Warning} tone="danger" loading={today.isLoading} error={today.isError} />
        <MetricLink order={1} href="/ordens-de-servico?status=AWAITING_APPROVAL" label="Aguardando aprovação" value={waiting?.approvals.count} caption={waitingCaption(waiting?.approvals, 'há mais de 2 dias', 'o mais antigo espera')} icon={Warning} tone={waiting?.approvals.stale ? 'danger' : 'neutral'} loading={today.isLoading} error={today.isError} />
        <MetricLink order={2} href="/ordens-de-servico?status=COMPLETED" label="Prontas para entrega" value={metrics?.ready} caption={waitingCaption(waiting?.ready, 'há mais de 3 dias no pátio', 'o mais antigo espera')} icon={CheckCircle} tone={waiting?.ready.stale ? 'danger' : 'success'} loading={today.isLoading} error={today.isError} />
        <MetricLink order={3} href="/agenda" label="Agenda de hoje" value={todayAppointments.length} caption={`${occupiedHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h reservadas`} icon={CalendarBlank} tone="neutral" loading={appointments.isLoading} error={appointments.isError} />
      </section>}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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

        {canManageReceipts && <Card className="flex h-full flex-col overflow-hidden"><CardHeader className="flex-row items-start justify-between"><div><CardTitle>Pendências administrativas</CardTitle><p className="mt-1 text-sm text-text-muted">{dueInstallments.data?.total ? `${dueInstallments.data.total} ${dueInstallments.data.total === 1 ? 'parcela vencida ou a vencer' : 'parcelas vencidas ou a vencer'} em 3 dias.` : 'Parcelas vencidas ou a vencer.'}</p></div><Button asChild variant="ghost" size="sm" className="text-primary"><Link href="/financeiro/contas-a-receber">Financeiro</Link></Button></CardHeader><CardContent className="flex flex-1 flex-col divide-y divide-border p-0">{(dueInstallments.data?.items ?? []).map((item) => { const overdue = new Date(item.dueAt).getTime() < Date.now(); return <Link key={item.id} href={`/ordens-de-servico/${item.serviceOrderId}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/40"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.customerName} · parcela {item.installmentNumber}/{item.installmentCount}</p><p className="mt-0.5 text-xs text-text-muted">{item.orderNumber ? `OS ${item.orderNumber} · ` : ''}{overdue ? 'venceu' : 'vence'} em {new Date(item.dueAt).toLocaleDateString('pt-BR')}</p></div><div className="flex shrink-0 flex-col items-end gap-1"><span className="text-sm font-bold tabular-nums">{formatCurrencyBRL(item.amountCents)}</span><Badge variant={overdue ? 'critical' : 'attention'}>{overdue ? 'Vencida' : 'A vencer'}</Badge></div></Link>; })}{(dueInstallments.data?.items.length ?? 0) === 0 && <EmptyBlock icon={CheckCircle} title="Administrativo em dia" detail="Nenhuma parcela exige ação agora." tone="success" />}</CardContent></Card>}
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

function MetricLink({ href, label, value, caption, icon: Icon, tone, loading, error, order }: { href: string; label: string; value?: number | string; caption: string; icon: React.ComponentType<{ className?: string }>; tone: 'primary' | 'neutral' | 'danger' | 'success'; loading: boolean; error?: boolean; order: number }) {
  const toneClass = tone === 'primary' ? 'bg-primary/10 text-primary' : tone === 'danger' ? 'bg-danger-subtle text-danger' : tone === 'success' ? 'bg-success-subtle text-success' : 'bg-muted text-text-muted';
  const formattedValue = String(value ?? 0);
  const valueSize = typeof value === 'string'
    ? formattedValue.length > 11 ? 'text-sm sm:text-xl xl:text-2xl' : 'text-xl sm:text-2xl xl:text-3xl'
    : formattedValue.length > 6 ? 'text-lg sm:text-2xl xl:text-3xl' : 'text-2xl sm:text-3xl xl:text-4xl';
  return (
    <Link
      href={href}
      data-reveal
      style={{ '--reveal-order': order } as React.CSSProperties}
      className="group min-w-0 rounded-card border border-border bg-card p-3.5 shadow-card transition-[box-shadow,border-color,background-color] duration-normal ease-settle hover:border-primary/30 hover:bg-selection/30 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5 xl:p-6"
    >
      <div className="flex items-center justify-between gap-2" aria-hidden="true">
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-button sm:size-9 ${toneClass}`}><Icon className="size-4 sm:size-[18px]" /></span>
        <ArrowRight className="size-3.5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 sm:size-4" />
      </div>
      <div className="mt-3 flex min-h-8 items-end sm:mt-4 sm:min-h-10 xl:min-h-12">
        {loading ? <div className="h-7 w-16 animate-pulse rounded bg-muted sm:h-9" /> : <p data-metric-value className={`min-w-0 font-bold tabular-nums leading-tight tracking-tight text-text [overflow-wrap:anywhere] ${valueSize}`}>{error ? '—' : formattedValue}</p>}
      </div>
      <p data-metric-label className="mt-2 min-h-8 text-xs font-semibold leading-4 text-text sm:min-h-10 sm:text-sm sm:leading-5">{label}</p>
      <p data-metric-caption className="mt-1 min-h-8 text-xs leading-4 text-text-muted">{error ? 'Dados indisponíveis. Atualize a página.' : caption}</p>
    </Link>
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
