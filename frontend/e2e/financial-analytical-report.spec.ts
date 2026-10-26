import { expect, test, type Page } from '@playwright/test';
import { LEGAL_VERSION, type FinancialEntryResponse } from '@oficina/contracts';
import { summarizeReport } from '../features/financial/financial-report';

function fixtures(): FinancialEntryResponse[] {
  return Array.from({ length: 108 }, (_, index) => ({
    id: `entry-${index}`, categoryName: index % 2 ? 'Peças e manutenção' : 'Serviços automotivos', type: index % 2 ? 'EXPENSE' : 'INCOME',
    description: index === 107 ? 'ÚLTIMO LANÇAMENTO ANALÍTICO' : index === 0 ? 'Recebimento de ordem de serviço' : `Movimento analítico ${String(index).padStart(3, '0')}`,
    amountCents: index === 2 ? 9999999900 : 15000 + index, dueAt: `2026-10-${String(index % 25 + 1).padStart(2, '0')}T12:00:00Z`,
    status: index % 3 ? 'PENDING' : 'PAID', paidAt: index % 3 ? undefined : '2026-10-10T12:00:00Z',
    customerName: index % 2 ? undefined : index === 0 ? 'Márcia Oliveira' : `Cliente ${index}`,
    supplierName: index % 2 ? 'Autopeças Forte e Serviços Automotivos Ltda.' : undefined,
    notes: index === 0 ? 'Recebimento conferido pela recepção.' : index === 1 ? 'Documento fiscal e aquisição de peças para manutenção. '.repeat(9).slice(0, 500) : `Observação do lançamento ${index}`,
    source: index === 0 ? 'SERVICE_ORDER' : 'MANUAL', serviceOrderNumber: index === 0 ? 8 : undefined, vehiclePlate: index === 0 ? 'ABC1D23' : undefined, paymentMethod: index === 0 ? 'PIX' : undefined,
  }));
}

async function setup(page: Page, canView = true) {
  const rows = fixtures(); const requests: Record<string, unknown>[] = [];
  await page.clock.setFixedTime(new Date('2026-10-25T15:00:00Z'));
  await page.context().addInitScript(({ version, canView }) => {
    localStorage.setItem('ax-privacy-choice', JSON.stringify({ version, necessary: true, analytics: false, marketing: false, savedAt: new Date().toISOString() }));
    localStorage.setItem('oficina-auth', JSON.stringify({ state: { accessToken: 'analytical-test', refreshToken: 'test', user: { id: 'u1', tenantId: 't1', name: 'Financeiro', role: 'ADMIN', status: 'active', permissions: canView ? ['finance.view'] : ['customers.view'] } }, version: 0 }));
  }, { version: LEGAL_VERSION, canView });
  await page.context().route('**/api/v1/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    const path = new URL(route.request().url()).pathname;
    let json: unknown = { items: [], total: 0, has_more: false };
    if (path.endsWith('/settings/branding')) json = { company: { name: 'AX Oficina Mecânica - Serviços e Manutenção Automotiva' } };
    if (path.endsWith('/financial/categories')) json = { categories: [] };
    if (path.endsWith('/financial/cash-flow')) {
      const body = route.request().postDataJSON(); requests.push(body);
      const entries = body.date_field === 'PAID' ? rows.filter(entry => entry.status === 'PAID') : rows;
      const totals = summarizeReport(entries);
      json = { realized_income_cents: totals.income, realized_expense_cents: totals.expense, realized_balance_cents: totals.balance, projected_income_cents: totals.pendingIncome, projected_expense_cents: totals.pendingExpense, projected_balance_cents: totals.projectedBalance, entries, categories: [] };
    }
    await route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  return { rows, requests };
}

test('the analytical report paginates its preview and carries the exact filters into the full print view', async ({ page }) => {
  await setup(page); await page.goto('/financeiro/relatorios');
  await expect(page.getByRole('heading', { name: 'Relatório financeiro analítico', exact: true })).toBeVisible();
  const table = page.getByRole('table', { name: 'Detalhamento de receitas e despesas' });
  await expect(table.getByRole('row')).toHaveCount(52);
  await expect(page.getByText('108 lançamentos no filtro', { exact: true })).toBeVisible();
  await expect(table.getByText('Totais do filtro (108 lançamentos)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(page.getByText('Página 2 de 3', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar no relatório', { exact: true }).fill('marcia pix abc1d23');
  await expect(page.getByText('1 lançamento no filtro', { exact: true })).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table.getByText('Márcia Oliveira', { exact: true })).toBeVisible();
  await expect(table.getByText('OS #00008', { exact: true })).toBeVisible();
  await expect(page.getByText('Página 1 de 1', { exact: true })).toBeVisible();
  const popupPromise = page.context().waitForEvent('page');
  await page.getByRole('button', { name: 'Imprimir analítico / PDF', exact: true }).click();
  const popup = await popupPromise; await popup.waitForLoadState();
  await expect(popup.getByRole('heading', { name: 'Relatório financeiro analítico', exact: true })).toBeVisible();
  expect(new URL(popup.url()).searchParams.get('search')).toBe('marcia pix abc1d23');
  await expect(popup.getByRole('table').getByRole('row')).toHaveCount(3);
  await popup.close();
});

test('date basis is explicit, invalid periods cannot print and the filters fit mobile screens', async ({ page }) => {
  const state = await setup(page); await page.goto('/financeiro/relatorios');
  await page.getByRole('combobox', { name: 'Consultar pela data de', exact: true }).click();
  await page.getByRole('option', { name: 'Pagamento / recebimento', exact: true }).click();
  await expect.poll(() => state.requests.at(-1)).toMatchObject({ date_field: 'PAID', status: 'PAID', start_at: '2026-10-01T03:00:00.000Z', end_at: '2026-11-01T03:00:00.000Z' });
  await expect(page.getByRole('combobox', { name: 'Situação', exact: true })).toBeDisabled();
  await expect(page.getByText('36 lançamentos no filtro', { exact: true })).toBeVisible();
  await page.getByLabel('Data final', { exact: true }).fill('2026-09-30');
  await expect(page.getByRole('alert').filter({ hasText: 'Informe datas válidas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Imprimir analítico / PDF', exact: true })).toBeDisabled();
  await page.getByLabel('Data final', { exact: true }).fill('2026-10-31');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator('#main-content').locator('..')).toHaveCSS('padding-left', width >= 768 ? '256px' : '0px');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'artifacts/financial-analytical-desktop.png', fullPage: true });
});

test('the print route does not request financial information for a user without financial permission', async ({ page }) => {
  const state = await setup(page, false); await page.goto('/financeiro/imprimir?mode=analytical&month=2026-10');
  await expect(page.getByRole('alert').filter({ hasText: 'não possui acesso às informações financeiras' })).toBeVisible();
  expect(state.requests).toHaveLength(0);
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('prints every filtered entry to PDF, including multiple pages, an empty result and a legacy portrait document', async ({ page }) => {
  await setup(page); await page.goto('/financeiro/imprimir?mode=analytical&month=2026-10');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(110);
  await expect(page.getByText('ÚLTIMO LANÇAMENTO ANALÍTICO', { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: 'artifacts/financial-analytical-landscape.pdf', printBackground: true, preferCSSPageSize: true });
  await page.goto('/financeiro/imprimir?mode=analytical&month=2026-10&search=SEM-RESULTADO');
  await expect(page.getByRole('table').getByText('Nenhum lançamento encontrado para os filtros selecionados.', { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: 'artifacts/financial-analytical-empty.pdf', printBackground: true, preferCSSPageSize: true });
  await page.goto('/financeiro/imprimir?mode=transactions&month=2026-10');
  await expect(page.getByRole('heading', { name: 'Movimentações financeiras', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: 'artifacts/financial-transactions-portrait.pdf', printBackground: true, preferCSSPageSize: true });
});
