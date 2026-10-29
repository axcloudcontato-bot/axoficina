import { describe, expect, it } from 'vitest';
import type { FinancialEntryResponse } from '@oficina/contracts';
import { currentReportMonth, defaultReportFilters, filterReportEntries, monthFinancialRequest, monthReportRange, reportFiltersFromParams, reportPrintUrl, reportRequest, summarizeReport } from '../financial-report';

it('uses the same Brasília month for due and realized financial views', () => {
  const due = monthFinancialRequest('2026-10');
  const paid = monthFinancialRequest('2026-10', 'PAID');
  expect(due.startAt).toBe('2026-10-01T03:00:00.000Z');
  expect(due.endAt).toBe('2026-11-01T03:00:00.000Z');
  expect(paid.dateField).toBe('PAID');
  expect(paid.status).toBe('PAID');
});

const entry = (overrides: Partial<FinancialEntryResponse>): FinancialEntryResponse => ({ id: '1', categoryName: 'Serviços', description: 'Receita', type: 'INCOME', amountCents: 100, dueAt: '2026-10-10T12:00:00Z', status: 'PAID', source: 'MANUAL', ...overrides });
describe('Analytical report filtering and totals', () => {
  it('uses an inclusive Brasília calendar range and a distinct realization basis', () => {
    expect(currentReportMonth(new Date('2026-11-01T02:59:00Z'))).toBe('2026-10');
    expect(monthReportRange('2028-02')).toEqual({ startDate: '2028-02-01', endDate: '2028-02-29' });
    expect(reportRequest(defaultReportFilters('2026-10'))).toEqual({ startAt: '2026-10-01T03:00:00.000Z', endAt: '2026-11-01T03:00:00.000Z', dateField: 'DUE' });
    expect(reportRequest({ ...defaultReportFilters('2026-10'), dateField: 'PAID' })).toMatchObject({ dateField: 'PAID', status: 'PAID' });
    expect(reportRequest({ ...defaultReportFilters(), startDate: '2026-02-31' })).toBeNull();
    expect(reportRequest({ ...defaultReportFilters(), startDate: '2026-10-20', endDate: '2026-10-10' })).toBeNull();
  });
  it('searches names, notes, OS, plate and payment without requiring accents', () => {
    const rows = [entry({ id: '1', customerName: 'Márcia', notes: 'Revisão geral', source: 'SERVICE_ORDER', serviceOrderNumber: 12, vehiclePlate: 'ABC1D23', paymentMethod: 'PIX' }), entry({ id: '2', type: 'EXPENSE', supplierName: 'Autopeças Ágil', categoryName: 'Peças', description: 'Compra de filtro' })];
    const filters = defaultReportFilters();
    expect(filterReportEntries(rows, { ...filters, search: 'marcia revisao pix abc1d23' }).map(item => item.id)).toEqual(['1']);
    expect(filterReportEntries(rows, { ...filters, search: 'OS 00012' }).map(item => item.id)).toEqual(['1']);
    expect(filterReportEntries(rows, { ...filters, category: 'Peças', type: 'EXPENSE', search: 'agil' }).map(item => item.id)).toEqual(['2']);
    expect(filterReportEntries(rows, { ...filters, status: 'PENDING' })).toHaveLength(0);
  });
  it('separates pending from realized values and includes all records in totals', () => {
    const rows = [entry({ amountCents: 10001 }), entry({ id: '2', type: 'EXPENSE', amountCents: 100 }), entry({ id: '3', status: 'PENDING', amountCents: 200 }), entry({ id: '4', type: 'EXPENSE', status: 'PENDING', amountCents: 50 })];
    expect(summarizeReport(rows)).toEqual({ income: 10001, expense: 100, pendingIncome: 200, pendingExpense: 50, balance: 9901, projectedBalance: 10051, totalIncome: 10201, totalExpense: 150, count: 4 });
    expect(summarizeReport(Array.from({ length: 123 }, (_, index) => entry({ id: String(index) })))).toMatchObject({ count: 123, income: 12300 });
  });
  it('preserves every applied filter in the print URL', () => {
    const filters = { ...defaultReportFilters('2026-10'), search: 'Márcia & Filhos', category: 'Peças + serviços', type: 'EXPENSE' as const, status: 'PENDING' as const };
    const url = new URL(reportPrintUrl(filters), 'http://localhost');
    expect(url.searchParams.get('mode')).toBe('analytical');
    expect(reportFiltersFromParams(url.searchParams)).toEqual(filters);
  });
});
