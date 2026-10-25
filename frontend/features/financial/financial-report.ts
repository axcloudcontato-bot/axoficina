import type { FinancialEntryResponse, ListFinancialEntriesRequest } from '@oficina/contracts';

export interface FinancialReportFilters {
  startDate: string;
  endDate: string;
  dateField: 'DUE' | 'PAID';
  type: 'ALL' | 'INCOME' | 'EXPENSE';
  status: 'ALL' | 'PENDING' | 'PAID';
  category: string;
  search: string;
}
export const PAYMENT_LABELS: Record<string, string> = { PIX: 'PIX', CASH: 'Dinheiro', DEBIT_CARD: 'Cartão de débito', CREDIT_CARD: 'Cartão de crédito', BANK_TRANSFER: 'Transferência', OTHER: 'Outros' };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const dayFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' });
export const reportDate = (value?: string) => value && Number.isFinite(Date.parse(value)) ? dayFormat.format(new Date(value)) : '-';
export const reportStatus = (entry: FinancialEntryResponse) => entry.status === 'PAID' ? entry.type === 'INCOME' ? 'Recebida' : 'Paga' : entry.type === 'INCOME' ? 'A receber' : 'A pagar';
export const reportOrigin = (entry: FinancialEntryResponse) => entry.source === 'SERVICE_ORDER' ? entry.serviceOrderNumber !== undefined ? `OS #${String(entry.serviceOrderNumber).padStart(5, '0')}` : 'Ordem de serviço' : 'Manual';

export function currentReportMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(now);
  return `${parts.find(item => item.type === 'year')!.value}-${parts.find(item => item.type === 'month')!.value}`;
}
export function monthReportRange(month: string) {
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : currentReportMonth();
  const last = new Date(`${valid}-01T12:00:00Z`); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
  return { startDate: `${valid}-01`, endDate: last.toISOString().slice(0, 10) };
}
export function defaultReportFilters(month = currentReportMonth()): FinancialReportFilters {
  return { ...monthReportRange(month), dateField: 'DUE', type: 'ALL', status: 'ALL', category: '', search: '' };
}
export function reportRequest(filters: FinancialReportFilters): ListFinancialEntriesRequest | null {
  const validDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T12:00:00Z`)) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day;
  if (!validDay(filters.startDate) || !validDay(filters.endDate) || filters.startDate > filters.endDate) return null;
  const next = new Date(`${filters.endDate}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  return { startAt: new Date(`${filters.startDate}T00:00:00-03:00`).toISOString(), endAt: new Date(`${next.toISOString().split('T')[0]}T00:00:00-03:00`).toISOString(), dateField: filters.dateField, ...(filters.dateField === 'PAID' ? { status: 'PAID' } : {}) };
}
export function filterReportEntries(entries: FinancialEntryResponse[], filters: FinancialReportFilters) {
  const words = normalize(filters.search.trim()).split(/\s+/).filter(Boolean);
  return entries.filter(entry => (filters.type === 'ALL' || entry.type === filters.type) && (filters.status === 'ALL' || entry.status === filters.status) && (!filters.category || entry.categoryName === filters.category) && words.every(word => normalize([entry.description, entry.notes, entry.customerName, entry.supplierName, entry.categoryName, entry.vehiclePlate, reportOrigin(entry), entry.paymentMethod ? PAYMENT_LABELS[entry.paymentMethod] ?? entry.paymentMethod : ''].filter(Boolean).join(' ')).includes(word)))
    .sort((a, b) => (filters.dateField === 'PAID' ? a.paidAt ?? a.dueAt : a.dueAt).localeCompare(filters.dateField === 'PAID' ? b.paidAt ?? b.dueAt : b.dueAt) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id));
}
export function summarizeReport(entries: FinancialEntryResponse[]) {
  let income = 0, expense = 0, pendingIncome = 0, pendingExpense = 0;
  for (const entry of entries) {
    if (entry.type === 'INCOME') { if (entry.status === 'PAID') income += entry.amountCents; else pendingIncome += entry.amountCents; }
    else if (entry.status === 'PAID') expense += entry.amountCents; else pendingExpense += entry.amountCents;
  }
  return { income, expense, pendingIncome, pendingExpense, balance: income - expense, projectedBalance: income - expense + pendingIncome - pendingExpense, totalIncome: income + pendingIncome, totalExpense: expense + pendingExpense, count: entries.length };
}
export function reportPrintUrl(filters: FinancialReportFilters) {
  return `/financial/print?${new URLSearchParams({ mode: 'analytical', ...filters })}`;
}
export function reportFiltersFromParams(params: Pick<URLSearchParams, 'get'>): FinancialReportFilters {
  const defaults = defaultReportFilters(params.get('month') ?? undefined);
  return { startDate: params.get('startDate') ?? defaults.startDate, endDate: params.get('endDate') ?? defaults.endDate, dateField: params.get('dateField') === 'PAID' ? 'PAID' : 'DUE', type: ['INCOME', 'EXPENSE'].includes(params.get('type') ?? '') ? params.get('type') as FinancialReportFilters['type'] : 'ALL', status: params.get('dateField') === 'PAID' ? 'PAID' : ['PAID', 'PENDING'].includes(params.get('status') ?? '') ? params.get('status') as FinancialReportFilters['status'] : 'ALL', category: params.get('category') ?? '', search: params.get('search') ?? '' };
}
