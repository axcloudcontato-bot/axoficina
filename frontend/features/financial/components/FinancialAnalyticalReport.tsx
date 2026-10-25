'use client';

import { useId, useState } from 'react';
import { Printer } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { currentReportMonth, defaultReportFilters, filterReportEntries, monthReportRange, reportPrintUrl, reportRequest, summarizeReport, type FinancialReportFilters } from '../financial-report';
import { useCashFlow } from '../hooks/use-financial';
import { FinancialAnalyticalTable } from './FinancialAnalyticalTable';

const PAGE_SIZE = 50;

export function FinancialAnalyticalReport() {
  const id = useId();
  const [month, setMonth] = useState(currentReportMonth);
  const [filters, setFilters] = useState<FinancialReportFilters>(() => defaultReportFilters());
  const [requestedPage, setPage] = useState(0);
  const request = reportRequest(filters);
  const flow = useCashFlow(request ?? { startAt: '', endAt: '' }, { enabled: Boolean(request) });
  const entries = filterReportEntries(flow.data?.entries ?? [], filters);
  const totals = summarizeReport(entries);
  const categories = [...new Set([filters.category, ...(flow.data?.entries.map(entry => entry.categoryName) ?? [])].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pages - 1);
  const pageEntries = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  function change(next: Partial<FinancialReportFilters>) { setFilters(previous => ({ ...previous, ...next })); setPage(0); }

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Controle financeiro</p><h2 className="mt-1 text-2xl font-bold text-text">Relatório financeiro analítico</h2><p className="mt-1 text-sm text-text-muted">Cada receita e despesa, com identificação, datas, situação e observações.</p></div><Button disabled={!request || !flow.data || flow.isFetching} onClick={() => window.open(reportPrintUrl(filters), '_blank', 'noopener,noreferrer')}><Printer className="size-4" />Imprimir analítico / PDF</Button></header>
    <section aria-label="Filtros do relatório analítico" className="rounded-card border border-border bg-card p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Atalho de mês" id={`${id}-month`}><Input id={`${id}-month`} type="month" value={month} onChange={event => { setMonth(event.target.value); if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) change(monthReportRange(event.target.value)); }} /></Field>
        <Field label="Data inicial" id={`${id}-start`}><Input id={`${id}-start`} type="date" value={filters.startDate} onChange={event => change({ startDate: event.target.value })} /></Field>
        <Field label="Data final" id={`${id}-end`}><Input id={`${id}-end`} type="date" value={filters.endDate} onChange={event => change({ endDate: event.target.value })} /></Field>
        <Field label="Consultar pela data de" id={`${id}-basis`}><Select value={filters.dateField} onValueChange={value => change({ dateField: value as FinancialReportFilters['dateField'], status: value === 'PAID' ? 'PAID' : 'ALL' })}><SelectTrigger id={`${id}-basis`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DUE">Vencimento / referência</SelectItem><SelectItem value="PAID">Pagamento / recebimento</SelectItem></SelectContent></Select></Field>
        <Field label="Natureza" id={`${id}-type`}><Select value={filters.type} onValueChange={value => change({ type: value as FinancialReportFilters['type'] })}><SelectTrigger id={`${id}-type`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Receitas e despesas</SelectItem><SelectItem value="INCOME">Somente receitas</SelectItem><SelectItem value="EXPENSE">Somente despesas</SelectItem></SelectContent></Select></Field>
        <Field label="Situação" id={`${id}-status`}><Select value={filters.status} disabled={filters.dateField === 'PAID'} onValueChange={value => change({ status: value as FinancialReportFilters['status'] })}><SelectTrigger id={`${id}-status`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todas as situações</SelectItem><SelectItem value="PAID">Realizadas</SelectItem><SelectItem value="PENDING">A receber / a pagar</SelectItem></SelectContent></Select></Field>
        <Field label="Categoria" id={`${id}-category`}><Select value={filters.category || 'ALL'} onValueChange={value => change({ category: value === 'ALL' ? '' : value })}><SelectTrigger id={`${id}-category`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todas as categorias</SelectItem>{categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Buscar no relatório" id={`${id}-search`}><Input id={`${id}-search`} value={filters.search} maxLength={150} onChange={event => change({ search: event.target.value })} placeholder="Cliente, fornecedor, OS, placa ou descrição" /></Field>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-text-muted">{filters.dateField === 'PAID' ? 'Período por pagamento ou recebimento. Apenas movimentos realizados entram nesta consulta.' : 'Lançamentos manuais e parcelas são consultados pelo vencimento. Recebimentos de OS usam a data em que foram recebidos.'} Datas no horário de Brasília. A data final está incluída.</p>
      {!request && <p role="alert" className="mt-3 text-sm text-danger">Informe datas válidas, com a data inicial anterior ou igual à data final.</p>}
    </section>
    {request && flow.isError && <div role="alert" className="rounded-card border border-danger/30 bg-danger-subtle p-5 text-sm">Não foi possível carregar o relatório. <Button variant="outline" size="sm" onClick={() => flow.refetch()}>Tentar novamente</Button></div>}
    {request && flow.isPending && <p role="status" className="p-6 text-sm text-text-muted">Carregando relatório analítico...</p>}
    {request && flow.data && <>
      <section aria-label="Totais do relatório" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Receitas realizadas', totals.income], ['Despesas realizadas', totals.expense], ['Resultado realizado', totals.balance], ['Saldo com previstos', totals.projectedBalance]].map(([label, value]) => <div key={label} className="min-w-0 rounded-card border border-border bg-card p-4"><p className="text-xs font-semibold text-text-muted">{label}</p><p className="mt-2 break-words text-xl font-bold tabular-nums text-text">{formatCurrencyBRL(Number(value))}</p></div>)}</section>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-muted"><p>{entries.length} lançamento{entries.length === 1 ? '' : 's'} no filtro{flow.isFetching ? ' · Atualizando...' : ''}</p><p>A receber: <strong className="text-text">{formatCurrencyBRL(totals.pendingIncome)}</strong> · A pagar: <strong className="text-text">{formatCurrencyBRL(totals.pendingExpense)}</strong></p></div>
      <section className="overflow-hidden rounded-card border border-border bg-card"><div className="overflow-x-auto"><FinancialAnalyticalTable entries={pageEntries} totals={totals} /></div></section>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted"><p>A impressão inclui todos os {entries.length} lançamentos filtrados, em A4 paisagem.</p><nav aria-label="Páginas do relatório" className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button><span>Página {page + 1} de {pages}</span><Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Próxima</Button></nav></div>
    </>}
  </div>;
}
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>; }
