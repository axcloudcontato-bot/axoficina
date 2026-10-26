import { expect, test, type Page } from '@playwright/test';
import { LEGAL_VERSION } from '@oficina/contracts';

async function setup(page: Page, options: { fullCustomerPage?: boolean; failSupplierOnce?: boolean; canCreateCustomer?: boolean } = {}) {
  await page.addInitScript(({ version, canCreateCustomer }) => {
    localStorage.setItem('ax-privacy-choice', JSON.stringify({ version, necessary: true, analytics: false, marketing: false, savedAt: new Date().toISOString() }));
    localStorage.setItem('oficina-auth', JSON.stringify({ state: { accessToken: 'financial-test', refreshToken: 'test', user: { id: 'u1', tenantId: 't1', name: 'Financeiro', role: 'ADMIN', status: 'active', permissions: ['finance.view', 'finance.manage', 'customers.view', ...(canCreateCustomer ? ['customers.manage'] : [])] } }, version: 0 }));
  }, { version: LEGAL_VERSION, canCreateCustomer: options.canCreateCustomer !== false });
  const suppliers: Record<string, unknown>[] = [];
  const customers = Array.from({ length: options.fullCustomerPage ? 100 : 1 }, (_, index) => ({ id: `customer-${index}`, tenant_id: 't1', type: 'PF', name: `Cliente ${index}`, document: '', phone: '11999998888', created_at: '2026-10-25T12:00:00Z' }));
  const entries: Record<string, unknown>[] = [];
  let supplierAttempts = 0;
  let customerCount = 0;
  const updates: Record<string, unknown>[] = [];
  await page.route('**/api/v1/**', async route => {
    const method = route.request().method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    const path = new URL(route.request().url()).pathname;
    const body = method === 'POST' ? route.request().postDataJSON() : {};
    let json: unknown = { items: [], total: 0, has_more: false };
    if (path.endsWith('/settings/branding')) json = { company: { name: 'AX Oficina' } };
    if (path.endsWith('/customer-reply-notifications')) json = { items: [], unread_count: 0 };
    if (path.endsWith('/financial/categories')) json = { categories: [{ id: 'expense-category', name: 'Peças', type: 'EXPENSE', group: 'CUSTOS', is_system: false }, { id: 'income-category', name: 'Outras receitas', type: 'INCOME', group: 'RECEITAS', is_system: false }] };
    if (path.endsWith('/financial/cash-flow')) json = { realized_income_cents: 0, realized_expense_cents: 0, projected_income_cents: 0, projected_expense_cents: 0, realized_balance_cents: 0, projected_balance_cents: 0, entries: [], categories: [] };
    if (path.endsWith('/financial/suppliers') && method === 'GET') json = { suppliers };
    if (path.endsWith('/financial/suppliers') && method === 'POST') {
      supplierAttempts++;
      if (options.failSupplierOnce && supplierAttempts === 1) return route.fulfill({ status: 400, json: { error: { code: 'VALIDATION_ERROR', message: 'Fornecedor já cadastrado.', status: 400 } }, headers: { 'access-control-allow-origin': '*' } });
      const supplier = { id: `supplier-${supplierAttempts}`, status: 'ACTIVE', ...body }; suppliers.push(supplier); json = { supplier };
    }
    if (path.endsWith('/financial/suppliers/update')) { updates.push(body); const index = suppliers.findIndex(item => item.id === body.id); suppliers[index] = { ...suppliers[index], ...body }; json = { supplier: suppliers[index] }; }
    if (path.endsWith('/customers/list')) json = { items: customers, total: customers.length, has_more: false };
    if (path.endsWith('/customers') && method === 'POST') { customerCount++; json = { customer: { id: 'created-customer', tenant_id: 't1', document: '', created_at: '2026-10-25T12:00:00Z', ...body } }; }
    if (path.endsWith('/financial/entries') && method === 'POST') { entries.push(body); json = { entry: { id: 'entry-1', ...body } }; }
    await route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  return { entries, suppliers, updates, get supplierAttempts() { return supplierAttempts; }, get customerCount() { return customerCount; } };
}

async function openEntry(page: Page, path: string, category: string) {
  await page.goto(path); await page.getByRole('button', { name: 'Novo lançamento', exact: true }).click();
  const entry = page.getByRole('dialog', { name: 'Novo lançamento', exact: true });
  await entry.getByLabel('Descrição', { exact: true }).fill('Lançamento em preenchimento');
  await entry.getByLabel('Valor', { exact: true }).fill('123,45');
  await entry.getByLabel('Vencimento', { exact: true }).fill('2026-10-30');
  await entry.getByLabel('Observação', { exact: true }).fill('Manter esta observação');
  await entry.getByRole('combobox', { name: 'Categoria', exact: true }).click();
  await page.getByRole('option', { name: category, exact: true }).click();
  return entry;
}

test('expense creates its supplier in a nested modal, preserves the entry on cancellation and selects the saved supplier', async ({ page }) => {
  const state = await setup(page); await page.setViewportSize({ width: 390, height: 844 });
  const entry = await openEntry(page, '/financial/payables', 'Peças');
  const plus = entry.getByRole('button', { name: 'Cadastrar novo fornecedor', exact: true });
  await plus.click();
  let supplier = page.getByRole('dialog', { name: 'Novo fornecedor', exact: true });
  await supplier.getByLabel('Nome ou razão social', { exact: true }).fill('Cadastro cancelado');
  await page.keyboard.press('Escape'); await expect(supplier).toHaveCount(0); await expect(plus).toBeFocused();
  expect(state.supplierAttempts).toBe(0); expect(state.entries).toHaveLength(0);
  await expect(entry.getByLabel('Descrição', { exact: true })).toHaveValue('Lançamento em preenchimento');
  await plus.click(); supplier = page.getByRole('dialog', { name: 'Novo fornecedor', exact: true });
  await expect(supplier.getByLabel('Nome ou razão social', { exact: true })).toHaveValue('');
  await supplier.getByLabel('Nome ou razão social', { exact: true }).fill('Autopeças Nova');
  await supplier.getByLabel('Telefone', { exact: true }).fill('11999998888');
  await supplier.getByRole('button', { name: 'Salvar fornecedor', exact: true }).click();
  await expect(supplier).toHaveCount(0);
  await expect(entry.getByRole('combobox', { name: 'Fornecedor', exact: true })).toContainText('Autopeças Nova');
  await expect(entry.getByLabel('Valor', { exact: true })).toHaveValue('123,45');
  await expect(entry.getByLabel('Observação', { exact: true })).toHaveValue('Manter esta observação');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/financial-inline-supplier-mobile.png' });
  expect(state.entries).toHaveLength(0);
  await entry.getByRole('button', { name: 'Salvar lançamento', exact: true }).click();
  await expect(entry).toHaveCount(0); expect(state.entries).toHaveLength(1);
  expect(state.entries[0]).toMatchObject({ type: 'EXPENSE', supplier_id: 'supplier-1', category_id: 'expense-category', amount_cents: 12345, description: 'Lançamento em preenchimento', notes: 'Manter esta observação' });
  expect(state.entries[0]).not.toHaveProperty('customer_id');
  await expect(page).toHaveURL(/\/financial\/payables$/);
});

test('income selects a newly registered customer even when the first hundred customer results do not contain it', async ({ page }) => {
  const state = await setup(page, { fullCustomerPage: true });
  const entry = await openEntry(page, '/financial/receivables', 'Outras receitas');
  const plus = entry.getByRole('button', { name: 'Cadastrar novo cliente', exact: true });
  await plus.click(); let customer = page.getByRole('dialog', { name: 'Novo cliente', exact: true });
  await customer.getByLabel('Nome', { exact: true }).fill('Cliente cancelado');
  await customer.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(customer).toHaveCount(0); await expect(plus).toBeFocused(); expect(state.customerCount).toBe(0);
  await plus.click(); customer = page.getByRole('dialog', { name: 'Novo cliente', exact: true });
  await customer.getByLabel('Nome', { exact: true }).fill('Cliente Nova Receita');
  await customer.getByLabel('Telefone', { exact: true }).fill('11999998888');
  await customer.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
  await expect(customer).toHaveCount(0); expect(state.customerCount).toBe(1);
  await expect(entry.getByRole('combobox', { name: 'Cliente', exact: true })).toContainText('Cliente Nova Receita');
  await expect(entry.getByRole('combobox', { name: 'Categoria', exact: true })).toContainText('Outras receitas');
  await expect(entry.getByLabel('Descrição', { exact: true })).toHaveValue('Lançamento em preenchimento');
  expect(state.entries).toHaveLength(0);
  await entry.getByRole('button', { name: 'Salvar lançamento', exact: true }).click();
  await expect(entry).toHaveCount(0);
  expect(state.entries[0]).toMatchObject({ type: 'INCOME', customer_id: 'created-customer', category_id: 'income-category', amount_cents: 12345, notes: 'Manter esta observação' });
  expect(state.entries[0]).not.toHaveProperty('supplier_id');
  await expect(page).toHaveURL(/\/financial\/receivables$/);
});

test('a supplier save failure preserves both forms and a retry does not submit the financial entry', async ({ page }) => {
  const state = await setup(page, { failSupplierOnce: true }); await page.setViewportSize({ width: 320, height: 900 });
  const entry = await openEntry(page, '/financial/payables', 'Peças');
  await entry.getByRole('button', { name: 'Cadastrar novo fornecedor', exact: true }).click();
  const supplier = page.getByRole('dialog', { name: 'Novo fornecedor', exact: true });
  await supplier.getByLabel('Nome ou razão social', { exact: true }).fill('Fornecedor após erro');
  await supplier.getByRole('button', { name: 'Salvar fornecedor', exact: true }).click();
  await expect(page.getByText('Fornecedor já cadastrado.', { exact: true })).toBeVisible();
  await expect(supplier.getByLabel('Nome ou razão social', { exact: true })).toHaveValue('Fornecedor após erro');
  expect(state.entries).toHaveLength(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await supplier.getByRole('button', { name: 'Salvar fornecedor', exact: true }).click();
  await expect(supplier).toHaveCount(0);
  await expect(entry.getByRole('combobox', { name: 'Fornecedor', exact: true })).toContainText('Fornecedor após erro');
  await expect(entry.getByLabel('Valor', { exact: true })).toHaveValue('123,45');
  expect(state.supplierAttempts).toBe(2); expect(state.entries).toHaveLength(0);
});

test('inline customer creation respects the existing customer registration permission', async ({ page }) => {
  const state = await setup(page, { canCreateCustomer: false });
  const entry = await openEntry(page, '/financial/receivables', 'Outras receitas');
  await expect(entry.getByRole('button', { name: 'Cadastrar novo cliente', exact: true })).toBeDisabled();
  await entry.getByRole('combobox', { name: 'Cliente', exact: true }).click();
  await page.getByRole('option', { name: 'Cliente 0', exact: true }).click();
  await expect(entry.getByRole('combobox', { name: 'Cliente', exact: true })).toContainText('Cliente 0');
  expect(state.customerCount).toBe(0);
});

test('the shared supplier form still creates and edits suppliers from their management screen', async ({ page }) => {
  const state = await setup(page); await page.goto('/financeiro/fornecedores');
  await page.getByRole('button', { name: 'Novo fornecedor', exact: true }).click();
  let supplier = page.getByRole('dialog', { name: 'Novo fornecedor', exact: true });
  await supplier.getByLabel('Nome ou razão social', { exact: true }).fill('Fornecedor do painel');
  await supplier.getByLabel('Pessoa de contato', { exact: true }).fill('Maria');
  await supplier.getByRole('button', { name: 'Salvar fornecedor', exact: true }).click();
  await expect(supplier).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar fornecedor', exact: true }).click();
  supplier = page.getByRole('dialog', { name: 'Editar fornecedor', exact: true });
  await expect(supplier.getByLabel('Pessoa de contato', { exact: true })).toHaveValue('Maria');
  await supplier.getByLabel('Nome ou razão social', { exact: true }).fill('Fornecedor atualizado');
  await supplier.getByRole('button', { name: 'Salvar fornecedor', exact: true }).click();
  await expect(supplier).toHaveCount(0);
  expect(state.updates[0]).toMatchObject({ id: 'supplier-1', name: 'Fornecedor atualizado', contact_name: 'Maria' });
  await expect(page.getByText('Fornecedor atualizado', { exact: true })).toBeVisible();
});
