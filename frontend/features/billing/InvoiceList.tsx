'use client';

import type { InvoiceStatus } from '@oficina/contracts';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { useBillingInvoices, useBillingStatus } from './use-billing';

const STATUS: Record<InvoiceStatus, { label: string; tone: string }> = {
  pending: { label: 'Aguardando pagamento', tone: 'bg-selection text-primary' },
  paid: { label: 'Paga', tone: 'bg-success-subtle text-success' },
  overdue: { label: 'Em atraso', tone: 'bg-danger-subtle text-danger' },
  canceled: { label: 'Cancelada', tone: 'bg-muted text-text-muted' },
  refunded: { label: 'Estornada', tone: 'bg-muted text-text-muted' },
};

const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');

export function InvoiceList() {
  const billing = useBillingStatus();
  const invoices = useBillingInvoices(Boolean(billing.data?.enabled));
  if (!billing.data?.enabled || invoices.isLoading) return null;
  const items = invoices.data?.items ?? [];
  return <section aria-label="Faturas" className="rounded-card border border-border bg-card p-5 shadow-sm">
    <h2 className="text-base font-bold">Faturas</h2>
    {invoices.isError && <p role="alert" className="mt-3 text-sm text-danger">Não foi possível carregar as faturas. <button className="underline" onClick={() => invoices.refetch()}>Tentar novamente</button></p>}
    {!invoices.isError && items.length === 0 && <p className="mt-3 text-sm text-text-muted">Nenhuma fatura ainda. Elas aparecem aqui depois da primeira cobrança.</p>}
    {items.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead><tr className="border-b border-border text-left text-xs text-text-muted"><th className="py-2 font-semibold">Vencimento</th><th className="py-2 font-semibold">Valor</th><th className="py-2 font-semibold">Situação</th><th className="py-2" /></tr></thead>
      <tbody>{items.map((invoice) => <tr key={invoice.id} className="border-b border-border last:border-0">
        <td className="py-2.5">{day(invoice.dueDate)}</td>
        <td className="py-2.5 font-semibold">{formatCurrencyBRL(invoice.amountCents)}</td>
        <td className="py-2.5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS[invoice.status].tone}`}>{STATUS[invoice.status].label}</span>{invoice.paidAt && <span className="ml-2 text-xs text-text-muted">em {day(invoice.paidAt)}</span>}</td>
        <td className="py-2.5 text-right">{invoice.invoiceUrl && (invoice.status === 'pending' || invoice.status === 'overdue' || invoice.status === 'paid') && <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">{invoice.status === 'paid' ? 'Ver recibo' : 'Pagar'}<span className="sr-only"> da fatura de {day(invoice.dueDate)}</span></a>}</td>
      </tr>)}</tbody></table></div>}
  </section>;
}
