'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, CalendarBlank, CheckCircle, CurrencyCircleDollar, ArrowClockwise, Warning, Users, Wallet, Wrench } from '@phosphor-icons/react';
import type { AppointmentResponse, ServiceOrderListItemResponse } from '@oficina/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prioritizeOperationalOrders, todayRange } from '@/features/dashboard/dashboard-model';
import { useAppointments } from '@/features/appointments/hooks/use-appointments';
import { useMaintenanceAlertsList } from '@/features/maintenance-alerts/hooks/use-maintenance-alerts';
import { StatusBadge } from '@/features/service-orders/components/StatusBadge';
import { NewServiceOrderQuickStart } from '@/features/service-orders/components/NewServiceOrderQuickStart';
import { useServiceOrdersList } from '@/features/service-orders/hooks/use-service-orders';
import { useDueServiceOrderInstallments } from '@/features/service-orders/hooks/use-service-orders';
import { useCashFlow } from '@/features/financial/hooks/use-financial';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';

const EMPTY_ORDERS: ServiceOrderListItemResponse[] = [];
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
  const canManageReceipts = hasPermission(user, 'receipts.manage');
  const canManageServiceOrders = hasPermission(user, 'service_orders.manage');
  const canViewFinance = hasPermission(user, 'finance.view');
  const range = useMemo(() => todayRange(), []);
  const open = useServiceOrdersList({ offset: 0, limit: 100, status: 'OPEN' });
  const awaitingApproval = useServiceOrdersList({ offset: 0, limit: 100, status: 'AWAITING_APPROVAL' });
  const inProgress = useServiceOrdersList({ offset: 0, limit: 100, status: 'IN_PROGRESS' });
  const waitingParts = useServiceOrdersList({ offset: 0, limit: 100, status: 'WAITING_PARTS' });
  const completed = useServiceOrdersList({ offset: 0, limit: 100, status: 'COMPLETED' });
  const dueInstallments = useDueServiceOrderInstallments(canManageReceipts ? 4 : 0);
  const appointments = useAppointments(range);
  const alerts = useMaintenanceAlertsList({ offset: 0, limit: 4, status: 'OPEN' });
  const dailyCashFlow = useCashFlow({ startAt: range.startsAt, endAt: range.endsAt }, { enabled: canViewFinance });

  const queries = [open, awaitingApproval, inProgress, waitingParts, completed];
  const openOrdersTotal = (open.data?.total ?? 0) + (awaitingApproval.data?.total ?? 0) + (inProgress.data?.total ?? 0) + (waitingParts.data?.total ?? 0);
  const allOperationalItems = useMemo(() => prioritizeOperationalOrders([
    ...(waitingParts.data?.items ?? EMPTY_ORDERS),
    ...(awaitingApproval.data?.items ?? EMPTY_ORDERS),
    ...(open.data?.items ?? EMPTY_ORDERS),
    ...(inProgress.data?.items ?? EMPTY_ORDERS),
    ...(completed.data?.items ?? EMPTY_ORDERS),
  ]), [waitingParts.data?.items, awaitingApproval.data?.items, open.data?.items, inProgress.data?.items, completed.data?.items]);
  const operationalItems = allOperationalItems.slice(0, 6);
  const overdueOrders = allOperationalItems.filter((item) => item.expectedDeliveryAt && new Date(item.expectedDeliveryAt) < new Date());
  const technicianWorkload = useMemo(() => {
    const counts = new Map<string, number>();
    [...(inProgress.data?.items ?? []), ...(waitingParts.data?.items ?? [])].forEach((item) => counts.set(item.technicianName ?? 'Sem técnico', (counts.get(item.technicianName ?? 'Sem técnico') ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [inProgress.data?.items, waitingParts.data?.items]);
  const todayAppointments = (appointments.data?.items ?? [])
    .filter((item) => !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(item.status))
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  const occupiedHours = todayAppointments.reduce((total, item) => total + Math.max(0, (new Date(item.endsAt).getTime() - new Date(item.startsAt).getTime()) / 3_600_000), 0);
  const isRefreshing = queries.some((query) => query.isFetching) || appointments.isFetching || alerts.isFetching || dueInstallments.isFetching || dailyCashFlow.isFetching;
  const hasOperationalError = queries.some((query) => query.isError);

  function refreshDashboard() {
    queries.forEach((query) => void query.refetch());
    void appointments.refetch();
    void alerts.refetch();
    if (canManageReceipts) void dueInstallments.refetch();
    if (canViewFinance) void dailyCashFlow.refetch();
  }

  return (
    <div className="flex flex-col gap-5">
      <header data-reveal className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text">Operação de hoje</h2>
          <p className="mt-1.5 text-sm text-text-muted">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} · Agenda, pendências e veículos que exigem decisão agora.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Button variant="outline" size="sm" onClick={refreshDashboard} disabled={isRefreshing}><ArrowClockwise className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />Atualizar</Button>
          {canManageServiceOrders && <NewServiceOrderQuickStart size="sm" />}
        </div>
      </header>

      <section aria-label="Pendências operacionais" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {canViewFinance
          ? <MetricLink order={0} href="/financeiro" label="Faturamento do dia" value={formatCurrencyBRL(dailyCashFlow.data?.realizedIncomeCents ?? 0)} caption="recebido hoje" icon={CurrencyCircleDollar} tone="neutral" loading={dailyCashFlow.isLoading} />
          : <MetricLink order={0} href="/agenda" label="Agenda de hoje" value={todayAppointments.length} caption={`${occupiedHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h reservadas`} icon={CalendarBlank} tone="neutral" loading={appointments.isLoading} />}
        <MetricLink order={1} href="/ordens-de-servico" label="OS abertas" value={openOrdersTotal} caption="em andamento na oficina" icon={ArrowClockwise} tone="primary" loading={queries.some((query) => query.isLoading)} />
        <MetricLink order={2} href="/ordens-de-servico" label="OS atrasadas" value={overdueOrders.length} caption="previsão de entrega vencida" icon={Warning} tone="danger" loading={queries.some((query) => query.isLoading)} />
        <MetricLink order={3} href="/ordens-de-servico?status=COMPLETED" label="Prontos para entrega" value={completed.data?.total} caption="avisar e entregar" icon={CheckCircle} tone="success" loading={completed.isLoading} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.4fr)]">
        <Card data-reveal style={{ '--reveal-order': 4 } as React.CSSProperties} className="flex h-full flex-col overflow-hidden">
          <CardHeader className="flex-row items-start justify-between border-b border-border">
            <div><CardTitle>Agenda de hoje</CardTitle><p className="mt-1 text-sm text-text-muted">{todayAppointments.length} {todayAppointments.length === 1 ? 'atendimento pendente' : 'atendimentos pendentes'}</p></div>
            <Button asChild variant="ghost" size="sm" className="text-primary"><Link href="/agenda">Abrir agenda<ArrowRight className="size-4" /></Link></Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center p-0">
            {appointments.isLoading ? <RowsSkeleton rows={4} /> : appointments.isError ? <ErrorBlock action={appointments.refetch} /> : todayAppointments.length === 0 ? <EmptyBlock icon={CalendarBlank} title="Agenda livre hoje" detail="Novos agendamentos aparecerão aqui." tone="neutral" /> : <div className="divide-y divide-border">{todayAppointments.slice(0, 5).map((item) => <AppointmentRow key={item.id} item={item} />)}</div>}
          </CardContent>
        </Card>

        <Card data-reveal style={{ '--reveal-order': 5 } as React.CSSProperties} className="flex h-full flex-col overflow-hidden">
          <CardHeader className="flex-row items-start justify-between border-b border-border">
            <div><CardTitle>Atenção agora</CardTitle><p className="mt-1 text-sm text-text-muted">Atrasos e bloqueios aparecem primeiro.</p></div>
            <Button asChild variant="ghost" size="sm" className="text-primary"><Link href="/ordens-de-servico">Abrir quadro<ArrowRight className="size-4" /></Link></Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center p-0">
            {queries.some((query) => query.isLoading) ? <RowsSkeleton /> : hasOperationalError ? <ErrorBlock action={refreshDashboard} /> : operationalItems.length === 0 ? <EmptyBlock icon={CheckCircle} title="Operação em dia" detail="Nenhuma OS exige atenção agora." tone="success" /> : <div className="divide-y divide-border">{operationalItems.map((item) => <OrderRow key={item.id} item={item} />)}</div>}
          </CardContent>
        </Card>
      </section>

      <section className={`grid gap-5 ${canManageReceipts ? 'xl:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader><CardTitle>Carga da equipe</CardTitle><p className="mt-1 text-sm text-text-muted">OS em execução ou bloqueadas por técnico.</p></CardHeader>
          <CardContent className={`flex flex-1 flex-col p-0 ${technicianWorkload.length === 0 ? 'justify-center' : 'justify-start'}`}>{technicianWorkload.length === 0 ? <EmptyBlock icon={Users} title="Nenhuma carga ativa" detail="Os técnicos ainda não possuem OS em andamento." tone="neutral" /> : <div className="divide-y divide-border">{technicianWorkload.slice(0, 6).map(([name, count]) => <div key={name} className="flex items-center justify-between gap-3 px-5 py-3.5"><div className="flex min-w-0 items-center gap-3"><span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"><Wrench className="size-4" /></span><span className="truncate text-sm font-semibold">{name}</span></div><Badge variant={name === 'Sem técnico' ? 'critical' : count >= 4 ? 'attention' : 'default'}>{count} OS</Badge></div>)}</div>}</CardContent>
        </Card>

        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="flex-row items-start justify-between"><div><CardTitle>Clientes para contatar</CardTitle><p className="mt-1 text-sm text-text-muted">Manutenções preventivas vencidas.</p></div><Button asChild variant="ghost" size="sm" className="text-primary"><Link href="/alertas-de-manutencao">Ver todos</Link></Button></CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center p-0">{alerts.isLoading ? <RowsSkeleton rows={3} /> : alerts.isError ? <ErrorBlock action={alerts.refetch} /> : (alerts.data?.items ?? []).length === 0 ? <EmptyBlock icon={CheckCircle} title="Nenhum contato pendente" detail="Os alertas preventivos estão em dia." tone="success" /> : <div className="divide-y divide-border">{alerts.data?.items.map((alert) => <Link key={alert.id} href="/alertas-de-manutencao" className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"><div className="min-w-0"><p className="truncate text-sm font-semibold text-text">{alert.customerName}</p><p className="mt-0.5 truncate text-xs text-text-muted">{alert.vehicleBrand} {alert.vehicleModel} · {alert.vehiclePlate}</p></div><Badge variant="attention">{alert.monthsOverdue} {alert.monthsOverdue === 1 ? 'mês' : 'meses'}</Badge></Link>)}</div>}</CardContent>
        </Card>

        {canManageReceipts && <Card className="flex h-full flex-col overflow-hidden"><CardHeader className="flex-row items-start justify-between"><div><CardTitle>Pendências administrativas</CardTitle><p className="mt-1 text-sm text-text-muted">Parcelas vencidas ou a vencer.</p></div><Button asChild variant="ghost" size="sm" className="text-primary"><Link href="/financeiro/contas-a-receber">Financeiro</Link></Button></CardHeader><CardContent className="flex flex-1 flex-col justify-center divide-y divide-border p-0">{(dueInstallments.data?.items ?? []).map((item) => <Link key={item.id} href={`/ordens-de-servico/${item.serviceOrderId}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/40"><div><p className="text-sm font-semibold">Parcela {item.installmentNumber}/{item.installmentCount} · {item.customerName}</p><p className="mt-0.5 text-xs text-text-muted">Vence em {new Date(item.dueAt).toLocaleDateString('pt-BR')}</p></div><Wallet className="size-4 text-warning" /></Link>)}{(dueInstallments.data?.items.length ?? 0) === 0 && <EmptyBlock icon={CheckCircle} title="Administrativo em dia" detail="Nenhuma parcela exige ação agora." tone="success" />}</CardContent></Card>}
      </section>

    </div>
  );
}

function MetricLink({ href, label, value, caption, icon: Icon, tone, loading, order }: { href: string; label: string; value?: number | string; caption: string; icon: React.ComponentType<{ className?: string }>; tone: 'primary' | 'neutral' | 'danger' | 'success'; loading: boolean; order: number }) {
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
        {loading ? <div className="h-7 w-16 animate-pulse rounded bg-muted sm:h-9" /> : <p data-metric-value className={`min-w-0 font-bold tabular-nums leading-tight tracking-tight text-text [overflow-wrap:anywhere] ${valueSize}`}>{formattedValue}</p>}
      </div>
      <p data-metric-label className="mt-2 min-h-8 text-xs font-semibold leading-4 text-text sm:min-h-10 sm:text-sm sm:leading-5">{label}</p>
      <p data-metric-caption className="mt-1 min-h-8 text-xs leading-4 text-text-muted">{caption}</p>
    </Link>
  );
}

function AppointmentRow({ item }: { item: AppointmentResponse }) {
  return <Link href="/agenda" className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"><time className="w-11 shrink-0 text-sm font-bold tabular-nums text-primary">{new Date(item.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-text">{item.customerName} · {item.vehiclePlate}</p><p className="mt-0.5 truncate text-xs text-text-muted">{item.serviceDescription}</p></div><Badge variant={item.status === 'CONFIRMED' ? 'success' : item.status === 'IN_SERVICE' ? 'info' : 'default'}>{APPOINTMENT_STATUS_LABELS[item.status]}</Badge></Link>;
}

function OrderRow({ item }: { item: ServiceOrderListItemResponse }) {
  const overdue = item.expectedDeliveryAt && new Date(item.expectedDeliveryAt) < new Date();
  const reason = overdue ? `Entrega atrasada há ${daysSince(item.expectedDeliveryAt!)} ${daysSince(item.expectedDeliveryAt!) === 1 ? 'dia' : 'dias'}` : item.status === 'WAITING_PARTS' ? 'Aguardando chegada de peças' : item.status === 'AWAITING_APPROVAL' ? 'Orçamento aguardando resposta do cliente' : !item.technicianName ? 'Precisa de técnico responsável' : item.status === 'COMPLETED' ? 'Cliente deve ser avisado para retirada' : item.status === 'OPEN' ? 'Aguardando início da execução' : 'Serviço em andamento';
  return <Link href={`/ordens-de-servico/${item.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"><div className="flex size-10 shrink-0 items-center justify-center rounded-button bg-muted text-xs font-bold text-text">{item.vehiclePlate.slice(-4)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-text">{item.vehicleBrand} {item.vehicleModel}</p><StatusBadge status={item.status} />{overdue && <Badge variant="critical">Atrasada</Badge>}</div><p className="mt-1 truncate text-xs font-semibold text-text-muted">{reason}</p><p className="mt-0.5 truncate text-[11px] text-text-muted">{item.customerName}{item.technicianName ? ` · ${item.technicianName}` : ' · Sem técnico'}</p></div><ArrowRight className="size-4 shrink-0 text-text-muted" /></Link>;
}

function daysSince(value: string): number { return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)); }

function RowsSkeleton({ rows = 4 }: { rows?: number }) { return <div className="divide-y divide-border">{Array.from({ length: rows }).map((_, index) => <div key={index} className="flex items-center gap-3 px-5 py-4"><div className="size-10 animate-pulse rounded-button bg-muted" /><div className="flex-1 space-y-2"><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /></div></div>)}</div>; }
function EmptyBlock({ icon: Icon, title, detail, tone = 'neutral' }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string; tone?: 'neutral' | 'success' }) { const toneClass = tone === 'success' ? 'bg-success-subtle text-success' : 'bg-muted text-text-muted'; return <div className="flex flex-col items-center justify-center px-6 py-10 text-center"><div className={`mb-3 flex size-10 items-center justify-center rounded-full ${toneClass}`}><Icon className="size-5" /></div><p className="text-sm font-semibold text-text">{title}</p><p className="mt-1 text-xs text-text-muted">{detail}</p></div>; }
function ErrorBlock({ action }: { action: () => unknown }) { return <div className="flex flex-col items-center justify-center px-6 py-10 text-center"><Warning className="mb-3 size-5 text-danger" /><p className="text-sm font-semibold text-text">Não foi possível carregar estes dados.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => action()}>Tentar novamente</Button></div>; }
