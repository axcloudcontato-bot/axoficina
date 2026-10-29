'use client';

import { useMemo, useState } from 'react';
import { CATALOG_ITEM_TYPE_LABELS, CATALOG_REPORT_DAYS, type CatalogReportRow } from '@oficina/contracts';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { marginPercent } from '../catalog-pricing';
import { useCatalogReport } from '../hooks/use-catalog';

type Sort = 'revenue' | 'quantity' | 'margin';
const selectClass = 'h-10 rounded-button border border-input bg-background px-3 text-sm';

export function CatalogReport() {
  const [days, setDays] = useState<number>(90);
  const [sort, setSort] = useState<Sort>('revenue');
  const query = useCatalogReport(days);
  const rows = query.data?.rows ?? [];
  const hasMargin = rows.some(row => row.marginCents !== undefined);

  const sorted = useMemo(() => {
    const value = (row: CatalogReportRow) => sort === 'quantity' ? row.quantity : sort === 'margin' ? row.marginCents ?? Number.NEGATIVE_INFINITY : row.revenueCents;
    return [...rows].sort((a, b) => value(b) - value(a));
  }, [rows, sort]);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-2xl text-sm text-text-muted">O que mais saiu nas ordens de serviço entregues no período, antes do desconto da OS. {hasMargin ? 'O lucro só aparece para itens com custo conhecido.' : ''}</p>
      <div className="flex gap-2">
        <select aria-label="Período" className={selectClass} value={days} onChange={event => setDays(Number(event.target.value))}>{CATALOG_REPORT_DAYS.map(option => <option key={option} value={option}>Últimos {option} dias</option>)}</select>
        <select aria-label="Ordenar por" className={selectClass} value={sort} onChange={event => setSort(event.target.value as Sort)}><option value="revenue">Maior faturamento</option><option value="quantity">Mais unidades</option>{hasMargin && <option value="margin">Maior lucro</option>}</select>
      </div>
    </div>
    <section className="overflow-x-auto rounded-card border border-border bg-card shadow-sm">
      <table className="w-full min-w-[560px] text-sm">
        <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted"><th className="px-5 py-3 font-semibold">Item</th><th className="px-3 py-3 text-right font-semibold">Qtd.</th><th className="px-3 py-3 text-right font-semibold">OS</th><th className="px-3 py-3 text-right font-semibold">Faturado</th>{hasMargin && <th className="px-5 py-3 text-right font-semibold">Lucro</th>}</tr></thead>
        <tbody>
          {sorted.map(row => <tr key={row.key} className="border-b border-border last:border-0">
            <td className="px-5 py-3"><p className="font-semibold">{row.name}</p><p className="text-xs text-text-muted">{CATALOG_ITEM_TYPE_LABELS[row.type]}{row.catalogItemId ? '' : ' · digitado na OS'}</p></td>
            <td className="px-3 py-3 text-right tabular-nums">{row.quantity.toLocaleString('pt-BR')}</td>
            <td className="px-3 py-3 text-right tabular-nums">{row.orders}</td>
            <td className="px-3 py-3 text-right font-bold tabular-nums">{formatCurrencyBRL(row.revenueCents)}</td>
            {hasMargin && <td className="px-5 py-3 text-right tabular-nums">{row.marginCents === undefined ? <span className="text-text-muted">—</span> : <><span className={`font-bold ${row.marginCents < 0 ? 'text-danger' : ''}`}>{formatCurrencyBRL(row.marginCents)}</span> <span className="text-xs text-text-muted">{marginPercent(row.revenueCents, row.revenueCents - row.marginCents)}%</span></>}</td>}
          </tr>)}
        </tbody>
      </table>
      {!query.isLoading && sorted.length === 0 && <p className="p-10 text-center text-sm text-text-muted">Nenhuma venda nas OS entregues neste período.</p>}
    </section>
  </div>;
}
