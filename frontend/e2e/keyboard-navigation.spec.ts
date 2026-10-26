import { expect, test, type Page } from '@playwright/test';

const permissionKeys = ['dashboard.view', 'customers.view', 'customers.manage', 'vehicles.view', 'vehicles.manage', 'appointments.view', 'appointments.manage', 'service_orders.view', 'service_orders.manage', 'service_orders.prices', 'receipts.manage', 'alerts.view', 'settings.view', 'settings.manage', 'team.view'];
async function tabTo(page: Page, target: ReturnType<Page['getByRole']>) {
  for (let i = 0; i < 70; i++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ permissions }) => {
    localStorage.setItem('oficina-auth', JSON.stringify({ state: { accessToken: 'keyboard-test', refreshToken: 'test-refresh', user: { id: 'u1', tenantId: 't1', name: 'Teste', email: 'test@example.invalid', role: 'ADMIN', permissions, status: 'active', createdAt: '2026-10-24T00:00:00Z' } }, version: 0 }));
    localStorage.setItem('ax-privacy-choice', JSON.stringify({ version: '2026-10-24', necessary: true, analytics: false, marketing: false, savedAt: new Date().toISOString() }));
  }, { permissions: permissionKeys });
  const customer = { id: 'c1', tenant_id: 't1', type: 'PF', name: 'Maria', document: '', phone: '11999998888', created_at: '2026-10-24T00:00:00Z' };
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    let json: unknown = { items: [], total: 0, offset: 0, limit: 100, has_more: false };
    if (url.endsWith('/settings/branding')) json = { company: { name: 'Oficina de teste' } };
    else if (url.includes('/fipe/')) json = { brands: [], models: [] };
    else if (url.endsWith('/vehicles/list')) json = { items: [{ id: 'v1', tenant_id: 't1', customer_id: 'c1', customer_name: 'Maria', brand: 'Fiat', model: 'Uno', plate: 'ABC1D23', photos: [], created_at: '2026-10-24T00:00:00Z' }], total: 1, offset: 0, limit: 20, has_more: false };
    else if (url.endsWith('/customers/list')) json = { items: [customer, { ...customer, id: 'c2', name: 'Mariana' }], total: 2, offset: 0, limit: 100, has_more: false };
    else if (url.endsWith('/customers') && route.request().method() === 'POST') json = { customer: { ...customer, ...route.request().postDataJSON() } };
    else if (url.endsWith('/customers/update')) json = { customer: { ...customer, ...route.request().postDataJSON() } };
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' }, body: JSON.stringify(json) });
  });
});

test('skip link and command navigation work without a mouse and focus the destination content', async ({ page }) => {
  await page.goto('/clientes');
  await expect(page.getByRole('heading', { name: 'Clientes', exact: true }).first()).toBeVisible();
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Pular para o conteúdo principal' });
  await expect(skip).toBeFocused(); await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter'); await expect(page.locator('#main-content')).toBeFocused();
  await page.keyboard.press('Control+k');
  const search = page.getByRole('textbox', { name: 'Buscar páginas e ordens de serviço' });
  await expect(search).toBeFocused(); await expect(search).toHaveCount(1);
  await page.keyboard.type('veiculo'); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('navigation', { name: 'Páginas do sistema' }).getByRole('link', { name: 'Veículos' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page).toHaveURL(/\/vehicles$/);
  await expect(page.locator('#main-content')).toBeFocused();
});

test('header menus handle arrows, Escape, Tab and sidebar collapse retains focus', async ({ page }) => {
  await page.goto('/clientes');
  const theme = page.getByRole('button', { name: 'Tema', exact: true });
  await tabTo(page, theme); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Claro', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(page.getByRole('button', { name: 'Escuro', exact: true })).toBeFocused();
  await page.keyboard.press('Space'); await expect(page.locator('html')).toHaveClass(/dark/);
  await page.keyboard.press('Escape'); await expect(theme).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(page.getByRole('button', { name: 'Sistema', exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Perfil', exact: true })).toBeFocused();
  const collapse = page.getByRole('button', { name: 'Recolher menu lateral' });
  await tabTo(page, collapse); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Expandir menu lateral' })).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Clientes', exact: true })).toHaveAccessibleName('Clientes');
});

test('forms keep focus inside dialogs and restore it on cancellation or successful submission', async ({ page }) => {
  await page.goto('/clientes');
  const create = page.getByRole('button', { name: 'Editar', exact: true }).first();
  await tabTo(page, create); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Editar cliente' }); await expect(dialog).toBeVisible();
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('id'));
  await page.keyboard.press('Control+k'); await expect(page.getByRole('dialog', { name: 'Buscar e navegar' })).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.getAttribute('id'))).toBe(focused);
  await tabTo(page, dialog.getByRole('textbox', { name: 'Nome', exact: true })); await page.keyboard.press('Control+a'); await page.keyboard.type('Cliente teclado');
  await tabTo(page, dialog.getByRole('button', { name: 'Salvar alterações', exact: true })); await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0); await expect(create).toBeFocused();
  await page.keyboard.press('Enter'); await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(create).toBeFocused();
});

test('Escape closes customer suggestions before the order form and Tab skips options', async ({ page }) => {
  await page.goto('/ordens-de-servico');
  const create = page.getByRole('button', { name: 'Novo atendimento', exact: true });
  await tabTo(page, create); await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Pesquisar cliente ou veículo' })).toBeFocused();
  await page.keyboard.type('ABC');
  const vehicle = page.getByRole('button', { name: /Fiat Uno.*ABC1D23/ });
  await tabTo(page, vehicle); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Nova ordem de serviço' }); await expect(dialog).toBeVisible();
  const customer = dialog.getByRole('combobox', { name: 'Cliente', exact: true });
  await tabTo(page, customer); await page.keyboard.press('Control+a'); await page.keyboard.type('Ma'); await expect(page.getByRole('option')).toHaveCount(2);
  await page.keyboard.press('ArrowDown');
  const activeId = await customer.getAttribute('aria-activedescendant');
  await expect(page.locator(`[id="${activeId}"]`)).toContainText('Mariana');
  await page.keyboard.press('Escape'); await expect(customer).toHaveAttribute('aria-expanded', 'false'); await expect(dialog).toBeVisible();
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('option')).toHaveCount(2);
  await page.keyboard.press('Tab'); await expect(page.getByRole('option')).toHaveCount(0);
  await expect(customer).not.toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});

test('calendar dates work with arrows and a new appointment can be cancelled back to the focused date', async ({ page }) => {
  await page.goto('/agenda');
  const day = page.locator('[data-calendar-day][tabindex="0"]'); await expect(day).toBeVisible();
  await tabTo(page, day);
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  const focused = page.locator('[data-calendar-day]:focus'); await expect(focused).toHaveCount(1);
  await expect(page.locator('[data-calendar-day]').nth(1)).toBeFocused();
  const label = await focused.getAttribute('aria-label'); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: label!, exact: true })).toBeFocused();
});

test('keyboard navigation is also available on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/clientes');
  await page.keyboard.press('Control+k');
  const search = page.getByRole('textbox', { name: 'Buscar páginas e ordens de serviço' }); await expect(search).toBeFocused();
  await page.keyboard.type('privacidade'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/settings\/privacy$/); await expect(page.locator('#main-content')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
