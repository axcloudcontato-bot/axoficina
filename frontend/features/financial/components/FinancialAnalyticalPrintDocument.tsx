import type { CashFlowSummaryResponse, CompanySettingsResponse } from '@oficina/contracts';
import Image from 'next/image';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { filterReportEntries, reportDate, summarizeReport, type FinancialReportFilters } from '../financial-report';
import { FinancialAnalyticalTable } from './FinancialAnalyticalTable';

export function FinancialAnalyticalPrintDocument({ data, filters, company }: { data: CashFlowSummaryResponse; filters: FinancialReportFilters; company?: CompanySettingsResponse }) {
  const entries = filterReportEntries(data.entries, filters);
  const totals = summarizeReport(entries);
  return <article className="print-document financial-analytical-print mx-auto min-h-[186mm] min-w-[1050px] w-full max-w-[297mm] bg-white p-8 text-slate-950 shadow-lg print:min-w-0">
    <header className="mb-4 flex items-start justify-between gap-5 border-b-2 border-slate-800 pb-3"><div className="flex min-w-0 items-center gap-3">{company?.logoDataUrl && <Image src={company.logoDataUrl} alt="" width={44} height={44} unoptimized className="size-11 shrink-0 object-contain" />}<div><p className="text-xs font-bold uppercase tracking-wider text-slate-600">{company?.name ?? 'Oficina'}</p><h1 className="mt-1 text-xl font-bold">Relatório financeiro analítico</h1><p className="mt-1 text-xs">Período: {reportDate(`${filters.startDate}T12:00:00Z`)} a {reportDate(`${filters.endDate}T12:00:00Z`)} · Horário de Brasília</p></div></div><p className="shrink-0 text-right text-[10px] text-slate-500">Emitido em<br />{new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}<br />{entries.length} lançamentos</p></header>
    <div className="mb-4 space-y-1 text-[10px] leading-relaxed text-slate-600"><p className="font-semibold">{filters.dateField === 'PAID' ? 'Base: pagamento / recebimento no período. Apenas movimentos realizados.' : 'Base: vencimento dos lançamentos e parcelas; data do recebimento para receitas de OS.'}</p><p className="[overflow-wrap:anywhere]">Natureza: {filters.type === 'ALL' ? 'Receitas e despesas' : filters.type === 'INCOME' ? 'Somente receitas' : 'Somente despesas'} · Situação: {filters.status === 'ALL' ? 'Todas' : filters.status === 'PAID' ? 'Realizadas' : 'A receber / a pagar'} · Categoria: {filters.category || 'Todas'}{filters.search ? ` · Busca: ${filters.search}` : ''}</p></div>
    <section aria-label="Resumo do relatório" className="print-break-inside-avoid mb-5 grid grid-cols-6 gap-2">{[['Receitas realizadas', totals.income], ['Despesas realizadas', totals.expense], ['Resultado realizado', totals.balance], ['A receber', totals.pendingIncome], ['A pagar', totals.pendingExpense], ['Saldo com previstos', totals.projectedBalance]].map(([label, value]) => <div key={label} className="min-w-0 border border-slate-300 px-2 py-2"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-bold tabular-nums">{formatCurrencyBRL(Number(value))}</p></div>)}</section>
    <FinancialAnalyticalTable entries={entries} totals={totals} print />
  </article>;
}
