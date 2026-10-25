import type { FinancialEntryResponse } from '@oficina/contracts';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { PAYMENT_LABELS, reportDate, reportOrigin, reportStatus, type summarizeReport } from '../financial-report';

export function FinancialAnalyticalTable({ entries, totals, print = false }: { entries: FinancialEntryResponse[]; totals: ReturnType<typeof summarizeReport>; print?: boolean }) {
  const cell = print ? 'border-slate-200 p-1 text-[10px] leading-[1.35]' : 'border-border px-3 py-3 text-xs leading-relaxed';
  const muted = print ? 'text-slate-500' : 'text-text-muted';
  return <table aria-label="Detalhamento de receitas e despesas" className={`w-full table-fixed border-collapse ${print ? 'financial-analytical-table text-slate-950' : 'min-w-[1150px] text-text'}`}>
    <colgroup>{[7, 7, 23, 15, 11, 10, 7, 10, 10].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
    <thead><tr className={print ? 'border-y-2 border-slate-800 bg-slate-100 text-left text-slate-700' : 'border-b border-border bg-muted/60 text-left text-text-muted'}>
      {['Vencimento / ref.', 'Realização', 'Descrição / observações', 'Cliente / fornecedor', 'Categoria', 'Origem / pagamento', 'Situação', 'Receita', 'Despesa'].map((label, index) => <th key={label} scope="col" className={`${cell} font-bold ${index >= 7 ? 'text-right' : ''}`}>{label}</th>)}
    </tr></thead>
    <tbody>{entries.length ? entries.map((entry, index) => <tr key={`${entry.source}-${entry.id}`} className={`border-b ${print ? `border-slate-200 ${index % 2 ? 'bg-slate-50' : ''}` : 'border-border'}`}>
      <td className={`${cell} align-top`}>{reportDate(entry.dueAt)}</td>
      <td className={`${cell} align-top`}>{entry.status === 'PAID' ? reportDate(entry.paidAt) : '-'}</td>
      <td className={`${cell} align-top [overflow-wrap:anywhere]`}><span className={`mr-1 text-[9px] font-bold uppercase ${muted}`}>{entry.type === 'INCOME' ? 'Receita' : 'Despesa'}</span>{' '}<strong className="font-semibold">{entry.description}</strong>{entry.notes && <p className={`mt-0.5 whitespace-pre-wrap ${muted}`}>{entry.notes}</p>}</td>
      <td className={`${cell} align-top [overflow-wrap:anywhere]`}>{entry.customerName ?? entry.supplierName ?? 'Não informado'}</td>
      <td className={`${cell} align-top [overflow-wrap:anywhere]`}>{entry.categoryName}</td>
      <td className={`${cell} align-top [overflow-wrap:anywhere]`}><strong className="font-semibold">{reportOrigin(entry)}</strong>{entry.vehiclePlate && <p className={muted}>{entry.vehiclePlate}</p>}{entry.paymentMethod && <p className={muted}>{PAYMENT_LABELS[entry.paymentMethod] ?? entry.paymentMethod}</p>}</td>
      <td className={`${cell} align-top`}>{reportStatus(entry)}</td>
      <td className={`${cell} whitespace-nowrap text-right align-top font-semibold tabular-nums`}>{entry.type === 'INCOME' ? formatCurrencyBRL(entry.amountCents) : '-'}</td>
      <td className={`${cell} whitespace-nowrap text-right align-top font-semibold tabular-nums`}>{entry.type === 'EXPENSE' ? formatCurrencyBRL(entry.amountCents) : '-'}</td>
    </tr>) : <tr><td colSpan={9} className={`${cell} py-8 text-center ${muted}`}>Nenhum lançamento encontrado para os filtros selecionados.</td></tr>}</tbody>
    <tfoot><tr className={`border-t-2 ${print ? 'border-slate-800 bg-slate-100' : 'border-border bg-muted/60'}`}><th colSpan={7} scope="row" className={`${cell} text-left font-bold`}>Totais do filtro ({totals.count} lançamentos)</th><td className={`${cell} whitespace-nowrap text-right font-bold tabular-nums`}>{formatCurrencyBRL(totals.totalIncome)}</td><td className={`${cell} whitespace-nowrap text-right font-bold tabular-nums`}>{formatCurrencyBRL(totals.totalExpense)}</td></tr></tfoot>
  </table>;
}
