'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChartBar, ShieldWarning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSetProductivityTarget, useTechnicianProductivity, useTechnicianProductivityOrders } from '@/features/service-orders/hooks/use-service-orders';
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
function changePercent(current: number, previous: number): string { return previous ? `${((current - previous) * 100 / previous).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'; }

export default function ProductivityPage() {
  const user = useAuthStore((state) => state.user);
  const [month, setMonth] = useState(currentMonth);
  const [selected, setSelected] = useState<string | null>(null);
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const range = useMemo(() => monthRange(validMonth ? month : currentMonth()), [month, validMonth]);
  const previousRange = useMemo(() => monthRange(previousMonth(validMonth ? month : currentMonth())), [month, validMonth]);
  const canView = hasPermission(user, 'service_orders.prices');
  const query = useTechnicianProductivity(range, canView && validMonth);
  const previous = useTechnicianProductivity(previousRange, canView && validMonth);

  function exportCsv() {
    if (!query.data) return;
    const rows = [['Técnico', 'OS entregues', 'Mão de obra (R$)', 'Minutos trabalhados', 'OS estimadas', 'Carga atual'], ...query.data.items.map(item => [item.technicianName, item.completedCount, (item.laborRevenueCents / 100).toFixed(2), item.workedMinutes, item.estimatedCount, item.activeOrders])];
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `produtividade-${month}.csv`; link.click(); URL.revokeObjectURL(url);
  }

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
        <Button variant="outline" disabled={!query.data} onClick={exportCsv}>Exportar CSV</Button>
        <div className="grid w-full grid-cols-2 gap-3 text-sm lg:w-auto lg:grid-cols-4">
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
          <div className="rounded-card border border-border bg-card px-4 py-2.5"><p className="text-xs font-bold uppercase tracking-wide text-text-muted">Tempo registrado</p><p className="mt-0.5 text-lg font-bold tabular-nums text-text">{((totals?.workedMinutes ?? 0) / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h</p></div>
          <div className="rounded-card border border-border bg-card px-4 py-2.5"><p className="text-xs font-bold uppercase tracking-wide text-text-muted">Sem atribuição</p><p className="mt-0.5 text-lg font-bold tabular-nums text-text">{totals?.unassignedCount ?? 0}</p></div>
        </div>
      </div>

      {!validMonth && <p className="text-sm text-danger-strong">Escolha um mês válido.</p>}
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

      {!query.isLoading && !query.isError && items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Técnico</TableHead>
              <TableHead className="text-right">OS entregues</TableHead>
              <TableHead className="text-right">Mão de obra líquida</TableHead>
              <TableHead className="text-right">Tempo registrado</TableHead>
              <TableHead className="text-right">Carga atual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <Fragment key={item.technicianId}>
              <TableRow key={item.technicianId}>
                <TableCell><button className="font-semibold text-primary-strong underline-offset-2 hover:underline" aria-expanded={selected === item.technicianId} onClick={() => setSelected(selected === item.technicianId ? null : item.technicianId)}>{item.technicianName}</button>{item.estimatedCount > 0 && <span className="ml-2 text-xs text-warning">{item.estimatedCount} estimada(s)</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{item.completedCount}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrencyBRL(item.laborRevenueCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{item.workedMinutes ? `${(item.workedMinutes / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h` : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{item.activeOrders}</TableCell>
              </TableRow>
              {selected === item.technicianId && <TableRow key={`${item.technicianId}-details`}><TableCell colSpan={5} className="bg-surface"><div className="space-y-3 p-2 text-sm"><TargetEditor month={month} technicianId={item.technicianId} target={item.target} actual={{ completedCount: item.completedCount, laborRevenueCents: item.laborRevenueCents, workedMinutes: item.workedMinutes }} editable={user?.role === 'ADMIN' || user?.role === 'MANAGER'} /><OrderDetails range={range} technicianId={item.technicianId} /></div></TableCell></TableRow>}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}

      <p className="flex items-center gap-2 text-xs text-text-muted"><ChartBar className="size-3.5" />O mês considera a entrega em São Paulo. Carga atual reúne OS em execução, aguardando peças ou prontas para entrega e independe do mês escolhido. Uma OS compartilhada pode aparecer para mais de um técnico.</p>
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
    {orders.map(order => <div key={order.id} className="flex flex-wrap justify-between gap-2 border-t border-border pt-2"><Link className="text-primary-strong underline" href={`/ordens-de-servico/${order.id}`}>OS #{order.orderNumber}</Link><span>{new Date(order.deliveredAt).toLocaleDateString('pt-BR')} · {formatCurrencyBRL(order.laborCents)} · {order.workedMinutes ? `${order.workedMinutes} min` : 'tempo não registrado'}{order.estimated ? ' · estimada' : ''}</span></div>)}
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
