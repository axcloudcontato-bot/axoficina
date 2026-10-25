import { expect, test, type Page } from '@playwright/test';
import { LEGAL_VERSION } from '@oficina/contracts';

const customer = { id: 'c1', tenant_id: 't1', type: 'PF', name: 'Sergio Oliveira', document: '11144477735', phone: '11999998888', created_at: '2026-10-24T12:00:00Z' };
const vehicle = { id: 'v1', tenant_id: 't1', customer_id: 'c1', customer_name: customer.name, brand: 'Honda', model: 'HR-V', plate: 'ABC1D23', photos: [], created_at: customer.created_at };

test.beforeEach(async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem('ax-privacy-choice', JSON.stringify({ version, necessary: true, analytics: false, marketing: false, savedAt: new Date().toISOString() }));
    localStorage.setItem('oficina-auth', JSON.stringify({ state: { accessToken: 'reception-test', refreshToken: 'test-refresh', user: { id: 'u1', tenantId: 't1', name: 'Recepção', email: 'test@example.invalid', role: 'ADMIN', permissions: ['service_orders.view', 'service_orders.manage', 'service_orders.prices', 'customers.view', 'customers.manage', 'vehicles.view', 'vehicles.manage', 'alerts.view'], status: 'active', createdAt: '2026-10-24T00:00:00Z' } }, version: 0 }));
  }, LEGAL_VERSION);
});

async function mockReception(page: Page) {
  let savedCustomer = customer;
  let postedVehicle: Record<string, unknown> | undefined;
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    const request = route.request(); const path = new URL(request.url()).pathname;
    const body = request.method() === 'POST' ? request.postDataJSON() : {};
    let json: unknown = { items: [], total: 0, offset: 0, limit: 100, has_more: false };
    if (path.endsWith('/settings/branding')) json = { company: { name: 'AX Oficina' } };
    if (path.endsWith('/customer-reply-notifications')) json = { items: [], unread_count: 0 };
    if (path.endsWith('/customers/list')) json = { items: body.search === 'Sergio' ? [customer] : [], total: body.search === 'Sergio' ? 1 : 0 };
    if (path.endsWith('/vehicles/list')) json = { items: body.search === 'Sergio' || body.customer_id === 'c1' ? [vehicle] : [], total: 1 };
    if (path.endsWith('/service-orders/list') && body.search === 'Sergio') json = { items: [{ id: 'order-1', order_number: 4, customer_name: customer.name, vehicle_brand: 'Honda', vehicle_model: 'HR-V', vehicle_plate: 'ABC1D23' }], total: 1 };
    if (path.endsWith('/customers')) { savedCustomer = { ...customer, ...body, id: 'new-customer' }; json = { customer: savedCustomer }; }
    if (path.endsWith('/vehicles')) { postedVehicle = body; json = { vehicle: { ...vehicle, ...body, id: 'new-vehicle', customer_name: savedCustomer.name } }; }
    if (path.includes('/fipe/brands')) json = { brands: [{ id: 'honda', name: 'Honda' }] };
    if (path.includes('/fipe/models')) json = { models: [{ id: 'hrv', name: 'HR-V' }] };
    await route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  return { vehicleRequest: () => postedVehicle };
}

test('search text prefills CPF, name, email and the chosen destination without creating records', async ({ page }) => {
  await mockReception(page);
  await page.goto('/service-orders');
  for (const [text, field, expected] of [['11144477735', 'CPF ou CNPJ (opcional)', '111.444.777-35'], ['Maria Nova', 'Nome', 'Maria Nova'], ['nova@example.invalid', 'E-mail (opcional)', 'nova@example.invalid']]) {
    await page.getByRole('button', { name: 'Novo atendimento', exact: true }).click();
    await page.getByRole('textbox', { name: 'Pesquisar cliente ou veículo' }).fill(text);
    await page.getByRole('button', { name: 'Adicionar novo', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Novo cliente', exact: true });
    await expect(form.getByLabel(field, { exact: true })).toHaveValue(expected);
    await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Novo atendimento', exact: true }).click();
  await page.getByRole('textbox', { name: 'Pesquisar cliente ou veículo' }).fill('11999998888');
  await page.getByLabel('Usar o texto em').selectOption('phone');
  await page.getByRole('button', { name: 'Adicionar novo', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Novo cliente' }).getByLabel('Telefone', { exact: true })).toHaveValue('11999998888');
});

test('a searched plate survives customer creation and prefills the vehicle registration', async ({ page }) => {
  const api = await mockReception(page);
  await page.goto('/service-orders');
  await page.getByRole('button', { name: 'Novo atendimento', exact: true }).click();
  await page.getByRole('textbox', { name: 'Pesquisar cliente ou veículo' }).fill('xyz-9876');
  await page.getByRole('button', { name: 'Adicionar novo', exact: true }).click();
  const owner = page.getByRole('dialog', { name: 'Novo cliente', exact: true });
  await expect(owner.getByLabel('Nome', { exact: true })).toHaveValue('');
  await expect(owner.getByLabel('CPF ou CNPJ (opcional)', { exact: true })).toHaveValue('');
  await owner.getByLabel('Nome', { exact: true }).fill('Maria Nova');
  await owner.getByLabel('Telefone', { exact: true }).fill('11999998888');
  await owner.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
  const car = page.getByRole('dialog', { name: 'Novo veículo', exact: true });
  await expect(car.getByLabel('Placa', { exact: true })).toHaveValue('XYZ9876');
  await expect(car.getByText('Maria Nova', { exact: true })).toBeVisible();
  await car.getByLabel('Marca', { exact: true }).click();
  await page.getByRole('option', { name: 'Honda', exact: true }).click();
  await car.getByLabel('Modelo', { exact: true }).click();
  await page.getByRole('option', { name: 'HR-V', exact: true }).click();
  await car.getByRole('button', { name: 'Cadastrar veículo', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Nova ordem de serviço', exact: true })).toBeVisible();
  expect(api.vehicleRequest()).toMatchObject({ plate: 'XYZ9876', customer_id: 'new-customer' });
});

test('customers lead search results and the fixed header search shows the owner above the vehicle', async ({ page }) => {
  await mockReception(page); await page.goto('/service-orders');
  const search = page.getByRole('textbox', { name: 'Buscar páginas e ordens de serviço' });
  await expect(search).toBeVisible(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await search.fill('Sergio');
  const order = page.getByRole('dialog', { name: 'Buscar e navegar' }).getByRole('link', { name: /Sergio Oliveira.*Honda HR-V/ });
  await expect(order).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Novo atendimento', exact: true }).click();
  await page.getByRole('textbox', { name: 'Pesquisar cliente ou veículo' }).fill('Sergio');
  const dialog = page.getByRole('dialog', { name: 'Novo atendimento', exact: true });
  await expect(dialog.getByRole('region').first()).toHaveAccessibleName('Clientes');
  await expect(dialog.getByRole('region', { name: 'Veículos' }).getByRole('button', { name: /Sergio Oliveira.*Honda HR-V/ })).toBeVisible();
  await page.screenshot({ path: 'artifacts/reception-customer-first.png', fullPage: true });
});

test('header search stays exposed on narrow screens and the release icon retains the history', async ({ page }) => {
  await mockReception(page); await page.goto('/customers');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('#main-content').locator('..')).toHaveCSS('padding-left', width >= 768 ? '256px' : '0px');
    await expect(page.getByRole('textbox', { name: 'Buscar páginas e ordens de serviço' })).toBeInViewport();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/header-search-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Novidades do sistema', exact: true }).click();
  const history = page.getByRole('dialog', { name: 'Novidades do sistema', exact: true });
  await expect(history.getByRole('heading', { name: 'Atendimento com menos digitação' })).toBeVisible();
  await expect(page.getByTestId('unread-updates-indicator')).toHaveCount(0);
  await expect(history.locator('..')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'artifacts/system-updates-mobile.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Buscar páginas e ordens de serviço' })).toBeVisible();
  await expect(page.getByTestId('unread-updates-indicator')).toHaveCount(0);
  await page.getByRole('button', { name: 'Novidades do sistema', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Envio de fotos pelo celular' })).toBeVisible();
});
