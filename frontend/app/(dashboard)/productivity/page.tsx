'use client';

import { useMemo, useState } from 'react';
import { ChartBar, ShieldWarning } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTechnicianProductivity } from '@/features/service-orders/hooks/use-service-orders';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';

function monthRange(month: string): { startAt: string; endAt: string } {
  const [year, monthIndex] = month.split('-').map(Number);
  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 1);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

export default function ProductivityPage() {
  const user = useAuthStore((state) => state.user);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const range = useMemo(() => monthRange(month), [month]);
  const canView = hasPermission(user, 'service_orders.prices');
  const query = useTechnicianProductivity(range);

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
  const totals = items.reduce((sum, item) => ({ completedCount: sum.completedCount + item.completedCount, laborRevenueCents: sum.laborRevenueCents + item.laborRevenueCents }), { completedCount: 0, laborRevenueCents: 0 });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[220px]">
          <Label htmlFor="productivity-month">Período</Label>
          <Input id="productivity-month" type="month" className="mt-2" value={month} onChange={(event) => setMonth(event.target.value)} />
        </div>
        <div className="flex gap-4 text-sm">
          <div className="rounded-card border border-border bg-card px-4 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">OS entregues</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-text">{totals.completedCount}</p>
          </div>
          <div className="rounded-card border border-border bg-card px-4 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Mão de obra gerada</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-text">{formatCurrencyBRL(totals.laborRevenueCents)}</p>
          </div>
        </div>
      </div>

      {query.isLoading && (
        <div role="status" aria-label="Carregando produtividade" className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-card bg-surface" />)}
        </div>
      )}

      {query.isError && <div className="rounded-card border border-danger/30 bg-danger-subtle p-8 text-center text-sm font-semibold text-danger-strong">Não foi possível carregar a produtividade dos técnicos.</div>}

      {!query.isLoading && !query.isError && items.length === 0 && (
        <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-muted">Nenhum técnico ativo cadastrado ainda.</div>
      )}

      {!query.isLoading && !query.isError && items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Técnico</TableHead>
              <TableHead className="text-right">OS entregues</TableHead>
              <TableHead className="text-right">Mão de obra gerada</TableHead>
              <TableHead className="text-right">Tempo médio por OS</TableHead>
              <TableHead className="text-right">Em andamento agora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.technicianId}>
                <TableCell className="font-semibold text-text">{item.technicianName}</TableCell>
                <TableCell className="text-right tabular-nums">{item.completedCount}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrencyBRL(item.laborRevenueCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{item.avgCompletionHours == null ? '—' : formatHours(item.avgCompletionHours)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={item.activeOrders === 0 ? 'default' : item.activeOrders >= 4 ? 'attention' : 'default'}>{item.activeOrders}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <p className="flex items-center gap-2 text-xs text-text-muted"><ChartBar className="size-3.5" />Tempo médio é calculado entre a abertura e a entrega da OS. "Em andamento agora" não depende do período selecionado — é sempre a carga atual.</p>
    </div>
  );
}

function formatHours(hours: number): string {
  if (hours < 24) return `${hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
  const days = hours / 24;
  return `${days.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} d`;
}
