'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Money, Package, Briefcase, CurrencyCircleDollar, ClockCountdown, Gauge, ArrowClockwise, Wrench } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { useDashboardBusinessSummary } from '../hooks/use-dashboard-summary';

const STATUS_LABELS = { OPEN: 'Aguardando início', AWAITING_APPROVAL: 'Aguardando aprovação', IN_PROGRESS: 'Em execução', WAITING_PARTS: 'Aguardando peças', COMPLETED: 'Pronta para entrega', DELIVERED: 'Entregue · aguardando pagamento' } as const;

export function BusinessOverview() {
  const summary = useDashboardBusinessSummary();
  if (summary.isLoading) return <FinancialSkeleton />;
  if (summary.isError || !summary.data) return <div className="rounded-card border border-danger/30 bg-danger-subtle p-8 text-center"><p className="text-sm font-semibold text-danger-strong">Não foi possível carregar o módulo financeiro.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => summary.refetch()}>Tentar novamente</Button></div>;

  const data = summary.data;
  const change = data.previousMonthRevenueCents ? Math.round(((data.monthRevenueCents - data.previousMonthRevenueCents) / data.previousMonthRevenueCents) * 100) : null;
  const compositionTotal = data.partsRevenueCents + data.laborRevenueCents;
  const partsShare = compositionTotal ? Math.round((data.partsRevenueCents / compositionTotal) * 100) : 0;
  const maxRevenue = Math.max(...data.monthlyRevenue.map((item) => item.revenueCents), 1);

  return <div className="space-y-5">
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Desempenho financeiro</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-text">Resultado e carteira</h2><p className="mt-1 text-sm text-text-muted">Valores realizados, composição da receita e dinheiro parado na operação.</p></div>
      <Button variant="outline" size="sm" onClick={() => summary.refetch()} disabled={summary.isFetching}><ArrowClockwise className={`size-4 ${summary.isFetching ? 'animate-spin' : ''}`} />Atualizar</Button>
    </header>

    <section className="grid gap-3 lg:grid-cols-[1.5fr_repeat(2,1fr)]">
      <Card className="overflow-hidden border-primary/30 bg-primary text-primary-foreground">
        <CardContent className="p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider opacity-75">Faturamento realizado no mês</p><p className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{formatCurrencyBRL(data.monthRevenueCents)}</p></div><CurrencyCircleDollar className="size-7 opacity-70" /></div>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm"><span>{data.receiptsThisMonth} recebimentos confirmados</span>{change !== null && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${change >= 0 ? 'bg-white/15' : 'bg-black/15'}`}>{change >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}{Math.abs(change)}% vs. mês anterior</span>}</div>
        </CardContent>
      </Card>
      <Metric label="Ticket médio" value={formatCurrencyBRL(data.averageTicketCents)} detail="por OS entregue no mês" icon={Gauge} />
      <Metric label="Contas a receber" value={formatCurrencyBRL(data.accountsReceivableCents)} detail="saldo ainda não confirmado no caixa" icon={Briefcase} />
    </section>

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric label="Em execução" value={formatCurrencyBRL(data.inProgressCents)} detail="valor sendo produzido agora" icon={Wrench} compact />
      <Metric label="Pronto a faturar" value={formatCurrencyBRL(data.completedAwaitingDeliveryCents)} detail="OS concluídas aguardando entrega" icon={Money} compact />
      <Metric label="Entregas atrasadas" value={String(data.overdueDeliveries)} detail="previsão de entrega vencida" icon={ClockCountdown} compact critical={data.overdueDeliveries > 0} />
      <Metric label="Mês anterior" value={formatCurrencyBRL(data.previousMonthRevenueCents)} detail="base de comparação" icon={CurrencyCircleDollar} compact />
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <Card>
        <CardHeader><CardTitle>Evolução das entradas no caixa</CardTitle><p className="mt-1 text-sm text-text-muted">Somente recebimentos efetivamente confirmados.</p></CardHeader>
        <CardContent><div className="flex h-64 items-end gap-3 border-b border-border pb-2">{data.monthlyRevenue.map((item) => {
          const date = new Date(`${item.month}-02T12:00:00`);
          const height = item.revenueCents ? Math.max(7, Math.round((item.revenueCents / maxRevenue) * 100)) : 2;
          return <div key={item.month} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-bold text-text opacity-0 transition-opacity group-hover:opacity-100">{formatCurrencyBRL(item.revenueCents)}</span><div className="w-full max-w-16 rounded-t-sm bg-primary/75 transition-colors group-hover:bg-primary" style={{ height: `${height}%` }} /><span className="text-xs capitalize text-text-muted">{date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span></div>;
        })}</div></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Composição das vendas entregues</CardTitle><p className="mt-1 text-sm text-text-muted">Peças e mão de obra das OS entregues; não representa recebimento.</p></CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-full bg-muted"><div className="flex h-3"><div className="bg-primary" style={{ width: `${partsShare}%` }} /><div className="bg-warning" style={{ width: `${100 - partsShare}%` }} /></div></div>
          <div className="mt-6 space-y-4"><Composition icon={Package} label="Peças" value={data.partsRevenueCents} share={partsShare} color="bg-primary" /><Composition icon={Wrench} label="Mão de obra" value={data.laborRevenueCents} share={compositionTotal ? 100 - partsShare : 0} color="bg-warning" /></div>
          <div className="mt-6 rounded-button border border-dashed border-border p-3 text-xs leading-5 text-text-muted">Margem e lucro ainda não são calculados porque o sistema não registra custo de aquisição das peças e despesas da oficina.</div>
        </CardContent>
      </Card>
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
      <Card className="overflow-hidden">
        <CardHeader><CardTitle>Recebimentos pendentes</CardTitle><p className="mt-1 text-sm text-text-muted">Maiores saldos ainda não confirmados no caixa.</p></CardHeader>
        <CardContent className="p-0">{data.financialPipeline.length === 0 ? <Empty text="Nenhuma OS com valor em aberto." /> : <div className="divide-y divide-border">{data.financialPipeline.map((order) => <Link key={order.id} href={`/service-orders/${order.id}`} className="group grid gap-2 px-5 py-4 transition-colors hover:bg-muted/40 sm:grid-cols-[1fr_auto]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-text">OS #{String(order.orderNumber).padStart(5, '0')}</strong><span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-text-muted">{STATUS_LABELS[order.status]}</span></div><p className="mt-1 truncate text-sm text-text-muted">{order.customerName} · {order.vehicleLabel} · {order.vehiclePlate}</p></div><div className="flex items-center justify-between gap-4 sm:justify-end"><strong className="text-sm tabular-nums text-text">{formatCurrencyBRL(order.amountCents)}</strong><ArrowRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5" /></div></Link>)}</div>}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Serviços que mais faturam</CardTitle><p className="mt-1 text-sm text-text-muted">Mão de obra nas entregas do mês.</p></CardHeader>
        <CardContent>{data.topServices.length === 0 ? <Empty text="Ainda não há mão de obra entregue neste mês." /> : <ol className="space-y-4">{data.topServices.map((service, index) => <li key={service.description} className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-text-muted">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-text">{service.description}</p><div className="mt-1 flex justify-between text-xs text-text-muted"><span>{service.count} {service.count === 1 ? 'lançamento' : 'lançamentos'}</span><strong className="text-text">{formatCurrencyBRL(service.revenueCents)}</strong></div></div></li>)}</ol>}</CardContent>
      </Card>
    </section>
  </div>;
}

function Metric({ label, value, detail, icon: Icon, compact, critical }: { label: string; value: string; detail: string; icon: React.ComponentType<{ className?: string }>; compact?: boolean; critical?: boolean }) {
  return <Card><CardContent className={compact ? 'p-4' : 'p-5'}><Icon className={`size-5 ${critical ? 'text-danger' : 'text-primary'}`} /><p className={`${compact ? 'mt-3 text-xl' : 'mt-5 text-2xl'} font-bold tracking-tight text-text`}>{value}</p><p className="mt-1 text-sm font-semibold text-text">{label}</p><p className="mt-1 text-xs leading-4 text-text-muted">{detail}</p></CardContent></Card>;
}
function Composition({ icon: Icon, label, value, share, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; share: number; color: string }) { return <div className="flex items-center gap-3"><span className={`flex size-9 items-center justify-center rounded-button text-white ${color}`}><Icon className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><span className="text-sm font-semibold text-text">{label}</span><strong className="text-sm text-text">{share}%</strong></div><p className="text-xs text-text-muted">{formatCurrencyBRL(value)}</p></div></div>; }
function Empty({ text }: { text: string }) { return <p className="px-5 py-10 text-center text-sm text-text-muted">{text}</p>; }
function FinancialSkeleton() { return <div className="space-y-4"><div className="h-20 animate-pulse rounded-card bg-muted" /><div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-card bg-muted" />)}</div><div className="h-72 animate-pulse rounded-card bg-muted" /></div>; }
