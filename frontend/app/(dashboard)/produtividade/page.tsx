'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChartBar, ShieldWarning, Timer } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCommissions, useCopyProductivityTargets, useMyProductivity, useProductivityTrend, useSetCommissionRule, useSetProductivityTarget, useTechnicianProductivity, useTechnicianProductivityOrders } from '@/features/service-orders/hooks/use-service-orders';
import { IdleTimeControl } from '@/features/service-orders/components/IdleTimeControl';
import type { TechnicianCommission, OpenWorkSession, TechnicianProductivityItem, TechnicianProductivityResponse } from '@oficina/contracts';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';

function monthRange(month: string): { startAt: string; endAt: string } {
  const [year, monthIndex] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1, 3));
  const end = new Date(Date.UTC(year, monthIndex, 1, 3));
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function currentMonth(): string { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date()); }
function previousMonth(month: string): string { const [year, index] = month.split('-').map(Number); const date = new Date(Date.UTC(year, index - 2, 1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`; }
function changePercent(current: number, previous: number): string { if (!previous) return '—'; const value = (current - previous) * 100 / previous; return `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`; }
const hours = (minutes: number) => `${(minutes / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
const LONG_OPEN_MINUTES = 8 * 60;
const duration = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, '0')}` : `${Math.round(minutes)} min`;
// Below 80% the job took much longer than the catalog says; from 100% on, it was done in the standard time or less.
const efficiencyTone = (value: number | null | undefined) => value == null ? 'text-text-muted' : value >= 100 ? 'text-success' : value < 80 ? 'text-warning' : 'text-text';

export default function ProductivityPage() {
  const user = useAuthStore((state) => state.user);
  const [month, setMonth] = useState(currentMonth);
  const [selected, setSelected] = useState<string | null>(null);
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const range = useMemo(() => monthRange(validMonth ? month : currentMonth()), [month, validMonth]);
  const previousRange = useMemo(() => monthRange(previousMonth(validMonth ? month : currentMonth())), [month, validMonth]);
  const canView = hasPermission(user, 'service_orders.prices');
  const canSeeOwn = hasPermission(user, 'service_orders.view');
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const query = useTechnicianProductivity(range, canView && validMonth);
  const previous = useTechnicianProductivity(previousRange, canView && validMonth);
  const trend = useProductivityTrend({ month: validMonth ? month : currentMonth() }, canView && validMonth);
  const copyTargets = useCopyProductivityTargets();
  const [copyMessage, setCopyMessage] = useState('');
  const previousByTechnician = useMemo(() => new Map((previous.data?.items ?? []).map(item => [item.technicianId, item])), [previous.data]);

  function exportCsv() {
    if (!query.data) return;
    const rows = [['Técnico', 'OS em que trabalhou', 'Mão de obra (R$)', 'Minutos trabalhados', 'Eficiência (%)', 'Valor por hora (R$)', 'Minutos em OS no mês', 'Ocupação (%)', 'Retornos em garantia', 'Minutos parado', 'OS estimadas', 'Carga atual'], ...query.data.items.map(item => [item.technicianName, item.completedCount, (item.laborRevenueCents / 100).toFixed(2), item.workedMinutes, item.efficiencyPercent ?? '', item.valuePerHourCents == null ? '' : (item.valuePerHourCents / 100).toFixed(2), item.sessionMinutes, item.occupancyPercent ?? '', item.reworkCount, item.idleMinutes, item.estimatedCount, item.activeOrders])];
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `produtividade-${month}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  if (!canView && canSeeOwn) return <MyProductivity month={month} onMonth={setMonth} validMonth={validMonth} range={range} previousRange={previousRange} />;

  if (!canView) {
    return (
      <div className="rounded-card border border-border bg-card p-10 text-center">
        <ShieldWarning className="mx-auto size-8 text-text-muted" />
        <h2 className="mt-3 font-bold text-text">Acesso restrito</h2>
        <p className="mt-1 text-sm text-text-muted">Seu perfil não possui acesso à produtividade por técnico.</p>
      </div>
    );
  }

  const items = query.data?.items ?? [];
  const totals = query.data?.totals;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3 sm:justify-between">
        <div className="max-w-[220px]">
          <Label htmlFor="productivity-month">Período</Label>
          <Input id="productivity-month" type="month" className="mt-2" value={month} onChange={(event) => { setMonth(event.target.value); setSelected(null); }} />
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && <Button variant="outline" disabled={copyTargets.isPending || !validMonth} onClick={() => copyTargets.mutate({ fromMonth: previousMonth(month), toMonth: month }, { onSuccess: result => setCopyMessage(result.copied ? `Metas de ${result.copied} técnico(s) copiadas do mês anterior.` : 'Todos os técnicos já têm meta neste mês, ou o mês anterior não tinha metas.'), onError: error => setCopyMessage(extractErrorMessage(error)) })}>{copyTargets.isPending ? 'Copiando…' : 'Copiar metas do mês anterior'}</Button>}
          <Button variant="outline" disabled={!query.data} onClick={exportCsv}>Exportar CSV</Button>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 text-sm md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-card border border-border bg-card px-4 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">OS entregues</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-text">{totals?.completedCount ?? 0}</p>
            {previous.data && <p className="text-xs text-text-muted">vs. mês anterior: {changePercent(totals?.completedCount ?? 0, previous.data.totals.completedCount)}</p>}
          </div>
          <div className="rounded-card border border-border bg-card px-4 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Mão de obra líquida</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-text">{formatCurrencyBRL(totals?.laborRevenueCents ?? 0)}</p>
            {previous.data && <p className="text-xs text-text-muted">vs. mês anterior: {changePercent(totals?.laborRevenueCents ?? 0, previous.data.totals.laborRevenueCents)}</p>}
          </div>
          <div className="rounded-card border border-border bg-card px-4 py-2.5"><p className="text-xs font-bold uppercase tracking-wide text-text-muted">Tempo registrado</p><p className="mt-0.5 text-lg font-bold tabular-nums text-text">{hours(totals?.workedMinutes ?? 0)}</p>{previous.data && <p className="text-xs text-text-muted">vs. mês anterior: {changePercent(totals?.workedMinutes ?? 0, previous.data.totals.workedMinutes)}</p>}</div>
          <div className="rounded-card border border-border bg-card px-4 py-2.5"><p className="text-xs font-bold uppercase tracking-wide text-text-muted">Sem atribuição</p><p className="mt-0.5 text-lg font-bold tabular-nums text-text">{totals?.unassignedCount ?? 0}</p></div>
          <div className="rounded-card border border-border bg-card px-4 py-2.5" title="Tempo padrão dos serviços entregues (catálogo) sobre o tempo registrado nessas OS."><p className="text-xs font-bold uppercase tracking-wide text-text-muted">Eficiência</p><p className={`mt-0.5 text-lg font-bold tabular-nums ${efficiencyTone(totals?.efficiencyPercent)}`}>{totals?.efficiencyPercent != null ? `${totals.efficiencyPercent}%` : '—'}</p><p className="text-xs text-text-muted">{totals?.efficiencyBaseMinutes ? `${hours(totals.soldMinutes ?? 0)} vendidas em ${hours(totals.efficiencyBaseMinutes)}` : 'Precisa de tempo padrão no catálogo'}</p></div>
          <div className="rounded-card border border-border bg-card px-4 py-2.5" title="Mão de obra das OS com tempo registrado, dividida pelas horas registradas."><p className="text-xs font-bold uppercase tracking-wide text-text-muted">Valor por hora</p><p className="mt-0.5 text-lg font-bold tabular-nums text-text">{totals?.valuePerHourCents != null ? formatCurrencyBRL(totals.valuePerHourCents) : '—'}</p>{query.data?.laborRateCents ? <p className="text-xs text-text-muted">Hora da oficina: {formatCurrencyBRL(query.data.laborRateCents)}</p> : null}</div>
        </div>
      </div>

      {!validMonth && <p className="text-sm text-danger-strong">Escolha um mês válido.</p>}
      {copyMessage && <p role="status" className="text-sm text-text-muted">{copyMessage}</p>}
      <OpenSessionsWarning sessions={query.data?.openSessions ?? []} />
      {totals && totals.estimatedCount > 0 && <p className="rounded-card border border-warning/30 bg-warning/5 p-3 text-sm text-text-muted">{totals.estimatedCount} OS com atribuição estimada por falta de registro de trabalho. Dados antigos podem refletir alterações posteriores à entrega.</p>}

      {query.isLoading && (
        <div role="status" aria-label="Carregando produtividade" className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-card bg-surface" />)}
        </div>
      )}

      {query.isError && <div className="rounded-card border border-danger/30 bg-danger-subtle p-8 text-center text-sm font-semibold text-danger-strong">Não foi possível carregar a produtividade dos técnicos. <Button variant="outline" size="sm" onClick={() => query.refetch()}>Tentar novamente</Button></div>}

      {!query.isLoading && !query.isError && items.length === 0 && (
        <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-muted">Nenhum técnico ou OS entregue neste período.</div>
      )}

      {!query.isLoading && !query.isError && items.length > 0 && query.data && <div className="grid gap-4 xl:grid-cols-2"><TeamBars report={query.data} /><TrendChart months={trend.data?.months ?? []} selected={month} loading={trend.isLoading} /></div>}

      {!query.isLoading && !query.isError && items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Técnico</TableHead>
              <TableHead className="text-right">OS em que trabalhou</TableHead>
              <TableHead className="text-right">Mão de obra líquida</TableHead>
              <TableHead className="text-right">Tempo registrado</TableHead>
              <TableHead className="text-right" title="Tempo padrão do catálogo sobre o tempo registrado">Eficiência</TableHead>
              <TableHead className="text-right">Valor por hora</TableHead>
              <TableHead className="text-right" title="Tempo em OS no mês sobre as horas de funcionamento">Ocupação</TableHead>
              <TableHead className="text-right" title="OS em que trabalhou que voltaram em garantia neste mês">Retornos</TableHead>
              <TableHead className="text-right" title="Tempo registrado fora de OS: esperando peça, limpeza, deslocamento">Parado</TableHead>
              <TableHead className="text-right">Carga atual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <Fragment key={item.technicianId}>
              <TableRow key={item.technicianId}>
                <TableCell><button className="font-semibold text-primary-strong underline-offset-2 hover:underline" aria-expanded={selected === item.technicianId} onClick={() => setSelected(selected === item.technicianId ? null : item.technicianId)}>{item.technicianName}</button>{item.estimatedCount > 0 && <span className="ml-2 text-xs text-warning">{item.estimatedCount} estimada(s)</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{item.completedCount}<Delta current={item.completedCount} previous={previousByTechnician.get(item.technicianId)?.completedCount} /></TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrencyBRL(item.laborRevenueCents)}<Delta current={item.laborRevenueCents} previous={previousByTechnician.get(item.technicianId)?.laborRevenueCents} /></TableCell>
                <TableCell className="text-right tabular-nums">{item.workedMinutes ? hours(item.workedMinutes) : '—'}<Delta current={item.workedMinutes} previous={previousByTechnician.get(item.technicianId)?.workedMinutes} /></TableCell>
                <TableCell className={`text-right font-semibold tabular-nums ${efficiencyTone(item.efficiencyPercent)}`}>{item.efficiencyPercent != null ? `${item.efficiencyPercent}%` : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{item.valuePerHourCents != null ? formatCurrencyBRL(item.valuePerHourCents) : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{item.occupancyPercent != null ? `${item.occupancyPercent}%` : '—'}</TableCell>
                <TableCell className={`text-right tabular-nums ${item.reworkCount ? 'font-semibold text-warning' : ''}`}>{item.reworkCount || '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{item.idleMinutes ? hours(item.idleMinutes) : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{item.activeOrders}</TableCell>
              </TableRow>
              {selected === item.technicianId && <TableRow key={`${item.technicianId}-details`}><TableCell colSpan={10} className="bg-surface"><div className="space-y-3 p-2 text-sm"><TargetEditor month={month} technicianId={item.technicianId} target={item.target} actual={{ completedCount: item.completedCount, laborRevenueCents: item.laborRevenueCents, workedMinutes: item.workedMinutes }} editable={canManage} /><OrderDetails range={range} technicianId={item.technicianId} /></div></TableCell></TableRow>}
              </Fragment>
            ))}
            {totals && <TableRow className="border-t-2 border-border font-bold hover:bg-transparent">
              <TableCell>Equipe</TableCell>
              <TableCell className="text-right tabular-nums" title="OS diferentes entregues no mês. Uma OS feita por dois técnicos conta uma vez aqui.">{totals.completedCount} OS</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrencyBRL(totals.laborRevenueCents)}</TableCell>
              <TableCell className="text-right tabular-nums">{hours(totals.workedMinutes)}</TableCell>
              <TableCell className={`text-right tabular-nums ${efficiencyTone(totals.efficiencyPercent)}`}>{totals.efficiencyPercent != null ? `${totals.efficiencyPercent}%` : '—'}</TableCell>
              <TableCell className="text-right tabular-nums">{totals.valuePerHourCents != null ? formatCurrencyBRL(totals.valuePerHourCents) : '—'}</TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums">{totals.reworkCount || '—'}</TableCell>
              <TableCell className="text-right tabular-nums">{totals.idleMinutes ? hours(totals.idleMinutes) : '—'}</TableCell>
              <TableCell className="text-right tabular-nums">{items.reduce((sum, item) => sum + item.activeOrders, 0)}</TableCell>
            </TableRow>}
          </TableBody>
        </Table>
      )}

      {canManage && validMonth && !query.isError && <Commissions range={range} month={month} />}

      <p className="flex items-center gap-2 text-xs text-text-muted"><ChartBar className="size-3.5" />O mês considera a entrega em São Paulo. Carga atual reúne OS em execução, aguardando peças ou prontas para entrega e independe do mês escolhido. Uma OS compartilhada aparece para cada técnico que trabalhou nela, mas conta uma vez no total da equipe. Abaixo de cada número, a variação em relação ao mês anterior. Eficiência só considera OS cujos serviços têm tempo padrão no catálogo; ocupação compara o tempo em OS com as horas de funcionamento da agenda até hoje.</p>
    </div>
  );
}

function OrderDetails({ range, technicianId }: { range: { startAt: string; endAt: string }; technicianId: string }) {
  const [offset, setOffset] = useState(0);
  const page = useTechnicianProductivityOrders({ ...range, technicianId, offset, limit: 20 });
  const orders = page.data?.items ?? [];
  return <div className="space-y-2"><strong>OS entregues no período</strong>
    {page.isLoading && <p className="text-text-muted">Carregando OS…</p>}
    {page.isError && <p className="text-danger-strong">Não foi possível carregar as OS. <button className="underline" onClick={() => page.refetch()}>Tentar novamente</button></p>}
    {!page.isLoading && !page.isError && !orders.length && <p className="text-text-muted">Nenhuma OS nesta página.</p>}
    {orders.map(order => { const over = order.standardMinutes && order.orderWorkedMinutes > order.standardMinutes * 1.3;
      return <div key={order.id} className="flex flex-wrap justify-between gap-2 border-t border-border pt-2"><Link className="text-primary-strong underline" href={`/ordens-de-servico/${order.id}`}>OS #{order.orderNumber}</Link><span>{new Date(order.deliveredAt).toLocaleDateString('pt-BR')} · {formatCurrencyBRL(order.laborCents)} · {order.workedMinutes ? `${duration(order.workedMinutes)} dele` : 'tempo não registrado'}{order.estimated ? ' · estimada' : ''}
        {order.standardMinutes ? <span className={over ? 'font-semibold text-warning' : 'text-text-muted'}> · previsto {duration(order.standardMinutes)}, real {order.orderWorkedMinutes ? duration(order.orderWorkedMinutes) : '—'}{over ? ' (demorou mais)' : ''}</span> : <span className="text-text-muted"> · sem tempo padrão</span>}</span></div>; })}
    {(offset > 0 || (page.data?.total ?? 0) > 20) && <div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={offset === 0 || page.isFetching} onClick={() => setOffset(Math.max(0, offset - 20))}>Anterior</Button><span className="text-xs text-text-muted">{offset + 1}–{Math.min(offset + 20, page.data?.total ?? 0)} de {page.data?.total ?? 0}</span><Button size="sm" variant="outline" disabled={offset + 20 >= (page.data?.total ?? 0) || page.isFetching} onClick={() => setOffset(offset + 20)}>Próxima</Button></div>}
  </div>;
}

function TargetEditor({ month, technicianId, target, actual, editable }: { month: string; technicianId: string; target: { completedCount: number; laborRevenueCents: number; workedMinutes: number } | null; actual: { completedCount: number; laborRevenueCents: number; workedMinutes: number }; editable: boolean }) {
  const save = useSetProductivityTarget();
  const [completedCount, setCompletedCount] = useState(target?.completedCount ?? 0);
  const [laborReais, setLaborReais] = useState(target ? target.laborRevenueCents / 100 : 0);
  const [workedHours, setWorkedHours] = useState(target ? target.workedMinutes / 60 : 0);
  const progress = (value: number, goal: number) => goal > 0 ? `${Math.round(value * 100 / goal)}%` : '—';
  return <div className="rounded-card border border-border bg-card p-3"><strong>Meta mensal</strong>{target ? <p className="mt-1 text-text-muted">OS: {actual.completedCount}/{target.completedCount} ({progress(actual.completedCount, target.completedCount)}) · Mão de obra: {formatCurrencyBRL(actual.laborRevenueCents)}/{formatCurrencyBRL(target.laborRevenueCents)} ({progress(actual.laborRevenueCents, target.laborRevenueCents)}) · Tempo: {(actual.workedMinutes / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/{(target.workedMinutes / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h ({progress(actual.workedMinutes, target.workedMinutes)})</p> : <p className="mt-1 text-text-muted">Ainda não há meta definida para este mês.</p>}
    {editable && <div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-xs">OS<Input aria-label="Meta de OS" type="number" min="0" step="1" value={completedCount} onChange={event => setCompletedCount(Number(event.target.value))} className="mt-1 w-24" /></label><label className="text-xs">Mão de obra (R$)<Input aria-label="Meta de mão de obra em reais" type="number" min="0" step="0.01" value={laborReais} onChange={event => setLaborReais(Number(event.target.value))} className="mt-1 w-32" /></label><label className="text-xs">Horas<Input aria-label="Meta de horas" type="number" min="0" step="0.1" value={workedHours} onChange={event => setWorkedHours(Number(event.target.value))} className="mt-1 w-24" /></label><Button size="sm" disabled={save.isPending || !Number.isInteger(completedCount) || completedCount < 0 || laborReais < 0 || workedHours < 0} onClick={() => save.mutate({ technicianId, month, completedCount, laborRevenueCents: Math.round(laborReais * 100), workedMinutes: Math.round(workedHours * 60) })}>{save.isPending ? 'Salvando…' : 'Salvar meta'}</Button></div>}
    {save.isError && <p className="mt-2 text-danger-strong">{extractErrorMessage(save.error)}</p>}
  </div>;
}

function Delta({ current, previous }: { current: number; previous?: number }) {
  if (!previous) return null;
  const value = changePercent(current, previous);
  return <span className={`block text-xs font-normal ${current >= previous ? 'text-success' : 'text-danger-strong'}`} title="Em relação ao mês anterior">{value}</span>;
}

// Timers running now: one forgotten overnight shows up here before it ruins the month.
function OpenSessionsWarning({ sessions }: { sessions: OpenWorkSession[] }) {
  const flagged = sessions.filter(session => session.capped || session.workedMinutes >= LONG_OPEN_MINUTES);
  if (!flagged.length) return null;
  return <div role="alert" className="rounded-card border border-warning/30 bg-warning/5 p-3 text-sm">
    <p className="flex items-center gap-2 font-semibold text-text"><Timer className="size-4 text-warning" aria-hidden="true" />{flagged.length === 1 ? 'Um cronômetro parece esquecido' : `${flagged.length} cronômetros parecem esquecidos`}</p>
    <p className="mt-1 text-text-muted">O tempo para de contar no fechamento da oficina. Abra a OS para encerrar ou corrigir o registro.</p>
    <ul className="mt-2 space-y-1">{flagged.map(session => <li key={session.id}><Link className="font-semibold text-primary-strong underline-offset-2 hover:underline" href={`/ordens-de-servico/${session.serviceOrderId}`}>OS #{session.orderNumber}</Link> · {session.technicianName} · desde {new Date(session.startedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}{session.capped ? ' · passou do fechamento' : ` · ${hours(session.workedMinutes)}`}</li>)}</ul>
  </div>;
}

// A technician without access to prices sees their own month: orders, time, current load and target.
function MyProductivity({ month, onMonth, validMonth, range, previousRange }: { month: string; onMonth: (month: string) => void; validMonth: boolean; range: { startAt: string; endAt: string }; previousRange: { startAt: string; endAt: string } }) {
  const query = useMyProductivity(range, validMonth);
  const previous = useMyProductivity(previousRange, validMonth);
  const data = query.data;
  const progress = (value: number, goal: number) => goal > 0 ? `${Math.round(value * 100 / goal)}% da meta` : null;
  const cards = data ? [
    { label: 'OS entregues em que trabalhei', value: String(data.completedCount), goal: data.target ? progress(data.completedCount, data.target.completedCount) : null, before: previous.data?.completedCount, current: data.completedCount },
    { label: 'Tempo registrado', value: hours(data.workedMinutes), goal: data.target ? progress(data.workedMinutes, data.target.workedMinutes) : null, before: previous.data?.workedMinutes, current: data.workedMinutes },
    { label: 'OS comigo agora', value: String(data.activeOrders), goal: null, before: undefined, current: data.activeOrders },
    ...(data.efficiencyPercent != null ? [{ label: 'Eficiência', value: `${data.efficiencyPercent}%`, goal: null, before: undefined, current: data.efficiencyPercent }] : []),
    ...(data.reworkCount ? [{ label: 'Retornos em garantia', value: String(data.reworkCount), goal: null, before: undefined, current: data.reworkCount }] : []),
    ...(data.laborRevenueCents !== undefined ? [{ label: 'Mão de obra', value: formatCurrencyBRL(data.laborRevenueCents), goal: data.target?.laborRevenueCents ? progress(data.laborRevenueCents, data.target.laborRevenueCents) : null, before: previous.data?.laborRevenueCents, current: data.laborRevenueCents }] : []),
  ] : [];
  return <div className="flex flex-col gap-5">
    <div className="max-w-[220px]"><Label htmlFor="productivity-month">Período</Label><Input id="productivity-month" type="month" className="mt-2" value={month} onChange={event => onMonth(event.target.value)} /></div>
    <h2 className="text-lg font-bold text-text">Minha produtividade</h2>
    {!validMonth && <p className="text-sm text-danger-strong">Escolha um mês válido.</p>}
    {query.isLoading && <div role="status" aria-label="Carregando produtividade" className="h-24 animate-pulse rounded-card bg-surface" />}
    {query.isError && <div className="rounded-card border border-danger/30 bg-danger-subtle p-6 text-center text-sm font-semibold text-danger-strong">Não foi possível carregar sua produtividade. <Button variant="outline" size="sm" onClick={() => query.refetch()}>Tentar novamente</Button></div>}
    {data && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(card => <div key={card.label} className="rounded-card border border-border bg-card px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-text-muted">{card.label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-text">{card.value}</p>
      {card.goal && <p className="text-xs text-text-muted">{card.goal}</p>}
      {card.before !== undefined && card.before > 0 && <p className="text-xs text-text-muted">vs. mês anterior: {changePercent(card.current, card.before)}</p>}
    </div>)}</div>}
    {data && !data.target && <p className="text-sm text-text-muted">Ainda não há meta definida para você neste mês.</p>}
    <IdleTimeControl />
    <p className="flex items-center gap-2 text-xs text-text-muted"><ChartBar className="size-3.5" />Conta as OS entregues no mês em que você registrou tempo ou foi o técnico responsável. Inicie e encerre seu trabalho na própria OS; o tempo para de contar no fechamento da oficina.</p>
  </div>;
}

type BarMetric = 'labor' | 'time' | 'efficiency';
const BAR_METRICS: Array<{ key: BarMetric; label: string; value: (item: TechnicianProductivityItem) => number | null; format: (value: number) => string }> = [
  { key: 'labor', label: 'Mão de obra', value: item => item.laborRevenueCents, format: formatCurrencyBRL },
  { key: 'time', label: 'Horas em OS', value: item => item.sessionMinutes, format: hours },
  { key: 'efficiency', label: 'Eficiência', value: item => item.efficiencyPercent, format: value => `${value}%` },
];

// One bar per technician for the chosen measure; efficiency shows the 100% line.
function TeamBars({ report }: { report: TechnicianProductivityResponse }) {
  const [metric, setMetric] = useState<BarMetric>('labor');
  const config = BAR_METRICS.find(entry => entry.key === metric)!;
  const rows = report.items.map(item => ({ id: item.technicianId, name: item.technicianName, value: config.value(item) })).filter((row): row is { id: string; name: string; value: number } => row.value != null).sort((a, b) => b.value - a.value);
  const max = Math.max(metric === 'efficiency' ? 100 : 0, ...rows.map(row => row.value), 1);
  return <section aria-label="Comparativo da equipe" className="rounded-card border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-text">Comparativo da equipe</h2>
      <div role="group" aria-label="Medida do comparativo" className="flex gap-1">{BAR_METRICS.map(entry => <Button key={entry.key} size="sm" variant={metric === entry.key ? 'default' : 'outline'} aria-pressed={metric === entry.key} onClick={() => setMetric(entry.key)}>{entry.label}</Button>)}</div></div>
    {rows.length ? <ul className="mt-4 space-y-2.5">{rows.map(row => <li key={row.id} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-sm">
      <span className="truncate font-medium text-text" title={row.name}>{row.name}</span>
      <span className="relative h-3 rounded-full bg-surface"><span className={`absolute inset-y-0 left-0 rounded-full ${metric === 'efficiency' && row.value < 80 ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${Math.max(2, row.value * 100 / max)}%` }} />{metric === 'efficiency' && <span aria-hidden="true" className="absolute inset-y-[-3px] w-px bg-text-muted" style={{ left: `${100 * 100 / max}%` }} />}</span>
      <span className="tabular-nums text-text-muted">{config.format(row.value)}</span>
    </li>)}</ul> : <p className="mt-4 text-sm text-text-muted">{metric === 'efficiency' ? 'Cadastre o tempo padrão dos serviços no catálogo e registre o tempo nas OS para medir a eficiência.' : 'Sem dados neste mês.'}</p>}
  </section>;
}

// Team labor in the last six months, with delivered orders under each bar.
function TrendChart({ months, selected, loading }: { months: Array<{ month: string; completedCount: number; laborRevenueCents: number; workedMinutes: number }>; selected: string; loading: boolean }) {
  const max = Math.max(1, ...months.map(month => month.laborRevenueCents));
  const label = (key: string) => { const [year, index] = key.split('-').map(Number); return new Date(Date.UTC(year, index - 1, 15)).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', ''); };
  return <section aria-label="Evolução dos últimos 6 meses" className="rounded-card border border-border bg-card p-4">
    <h2 className="font-bold text-text">Evolução dos últimos 6 meses</h2><p className="text-xs text-text-muted">Mão de obra da equipe e OS entregues por mês.</p>
    {loading ? <div className="mt-4 h-40 animate-pulse rounded-card bg-surface" /> : <ol className="mt-4 grid h-44 grid-cols-6 items-end gap-2">{months.map(month => <li key={month.month} className="flex h-full flex-col items-center justify-end gap-1 text-center" aria-label={`${label(month.month)}: ${formatCurrencyBRL(month.laborRevenueCents)}, ${month.completedCount} OS`}>
      <span className="text-[11px] tabular-nums text-text-muted">{month.laborRevenueCents ? formatCurrencyBRL(Math.round(month.laborRevenueCents / 100) * 100).replace(/,00$/, '') : ''}</span>
      <span className={`w-full max-w-10 rounded-t ${month.month === selected ? 'bg-primary' : 'bg-primary/35'}`} style={{ height: `${Math.max(2, month.laborRevenueCents * 100 / max)}%` }} />
      <span className={`text-xs capitalize ${month.month === selected ? 'font-bold text-text' : 'text-text-muted'}`}>{label(month.month)}</span>
      <span className="text-[11px] tabular-nums text-text-muted">{month.completedCount} OS</span>
    </li>)}</ol>}
  </section>;
}

// The month's commission per technician, ready to pay: labor times the percentage, plus the bonus when the labor target is met.
function Commissions({ range, month }: { range: { startAt: string; endAt: string }; month: string }) {
  const query = useCommissions(range);
  const items = query.data?.items ?? [];
  function exportCsv() {
    const rows = [['Técnico', 'Mão de obra (R$)', 'Comissão (%)', 'Bônus por meta (%)', 'Meta atingida', 'Retornos em garantia', 'A pagar (R$)'], ...items.map(item => [item.technicianName, (item.laborRevenueCents / 100).toFixed(2), item.laborPercentBp == null ? '' : (item.laborPercentBp / 100).toFixed(2), (item.bonusPercentBp / 100).toFixed(2), item.targetReached ? 'Sim' : 'Não', item.reworkCount, (item.commissionCents / 100).toFixed(2)])];
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `comissoes-${month}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  return <section aria-label="Comissões do mês" className="rounded-card border border-border bg-card p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-bold text-text">Comissões do mês</h2><p className="text-xs text-text-muted">Percentual sobre a mão de obra de cada técnico, mais o bônus quando a meta de mão de obra é atingida. Só gerentes e administradores veem.</p></div>
      <div className="flex items-center gap-3"><span className="text-sm">Total: <strong className="tabular-nums">{formatCurrencyBRL(query.data?.totalCents ?? 0)}</strong></span><Button size="sm" variant="outline" disabled={!items.length} onClick={exportCsv}>Exportar comissões</Button></div></div>
    {query.isLoading && <p className="mt-3 text-sm text-text-muted">Carregando comissões…</p>}
    {query.isError && <p className="mt-3 text-sm text-danger-strong">Não foi possível carregar as comissões. <button className="underline" onClick={() => query.refetch()}>Tentar novamente</button></p>}
    {items.length > 0 && <div className="mt-3 divide-y divide-border">{items.map(item => <CommissionRow key={item.technicianId} item={item} />)}</div>}
  </section>;
}

function CommissionRow({ item }: { item: TechnicianCommission }) {
  const save = useSetCommissionRule();
  const [labor, setLabor] = useState(item.laborPercentBp == null ? '' : String(item.laborPercentBp / 100));
  const [bonus, setBonus] = useState(String(item.bonusPercentBp / 100));
  const toBp = (value: string) => Math.round(Number(value.replace(',', '.')) * 100);
  const valid = labor !== '' && [labor, bonus || '0'].every(value => Number.isFinite(Number(value.replace(',', '.'))) && toBp(value) >= 0 && toBp(value) <= 10_000);
  return <div className="flex flex-wrap items-end justify-between gap-3 py-3 text-sm">
    <div className="min-w-40"><p className="font-semibold text-text">{item.technicianName}</p><p className="text-xs text-text-muted">Mão de obra {formatCurrencyBRL(item.laborRevenueCents)}{item.targetReached ? ' · meta atingida' : ''}{item.reworkCount ? ` · ${item.reworkCount} retorno(s)` : ''}</p></div>
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs">Comissão (%)<Input aria-label={`Comissão de ${item.technicianName}`} inputMode="decimal" className="mt-1 w-20" value={labor} placeholder="—" onChange={event => setLabor(event.target.value)} /></label>
      <label className="text-xs">Bônus meta (%)<Input aria-label={`Bônus de ${item.technicianName}`} inputMode="decimal" className="mt-1 w-20" value={bonus} onChange={event => setBonus(event.target.value)} /></label>
      <Button size="sm" variant="outline" disabled={!valid || save.isPending} onClick={() => save.mutate({ technicianId: item.technicianId, laborPercentBp: toBp(labor), bonusPercentBp: toBp(bonus || '0') })}>{save.isPending ? 'Salvando…' : 'Salvar'}</Button>
      <p className="w-28 text-right"><span className="block text-xs text-text-muted">A pagar</span><strong className="tabular-nums">{item.laborPercentBp == null ? '—' : formatCurrencyBRL(item.commissionCents)}</strong></p>
    </div>
    {save.isError && <p className="w-full text-danger-strong">{extractErrorMessage(save.error)}</p>}
  </div>;
}
