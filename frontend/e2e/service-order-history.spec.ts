import { expect, test, type Page } from '@playwright/test';
import { LEGAL_VERSION } from '@oficina/contracts';

const delivered = { id: 'delivered-1', tenant_id: 't1', order_number: 104, customer_id: 'c1', customer_name: 'Sergio Oliveira', vehicle_id: 'v1', vehicle_brand: 'Honda', vehicle_model: 'HR-V', vehicle_plate: 'ABC1D23', status: 'DELIVERED', opened_at: '2026-10-01T12:00:00Z', closed_at: '2026-10-25T02:59:00Z', total_amount_cents: 15000, received_amount_cents: 15000, outstanding_amount_cents: 0, payment_status: 'PAID' };

async function setup(page: Page) {
  const bodies: Record<string, unknown>[] = [];
  await page.addInitScript((version) => {
    localStorage.setItem('ax-privacy-choice', JSON.stringify({ version, necessary: true, analytics: false, marketing: false, savedAt: new Date().toISOString() }));
    localStorage.setItem('oficina-auth', JSON.stringify({ state: { accessToken: 'history-test', refreshToken: 'test', user: { id: 'u1', tenantId: 't1', name: 'Recepção', email: 'test@example.invalid', role: 'ADMIN', permissions: ['service_orders.view', 'service_orders.manage', 'service_orders.prices'], status: 'active' } }, version: 0 }));
  }, LEGAL_VERSION);
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    const path = new URL(route.request().url()).pathname;
    let json: unknown = { items: [], total: 0, has_more: false };
    if (path.endsWith('/settings/branding')) json = { company: { name: 'AX Oficina' } };
    if (path.endsWith('/customer-reply-notifications')) json = { items: [], unread_count: 0 };
    if (path.endsWith('/service-orders/list')) {
      const body = route.request().postDataJSON(); bodies.push(body);
      json = { items: body.status === 'DELIVERED' ? [{ ...delivered, order_number: body.offset ? 105 : 104 }] : [], total: body.status === 'DELIVERED' ? 105 : 0, offset: body.offset, limit: body.limit, has_more: body.status === 'DELIVERED' && !body.offset, metrics: { active: 1, overdue: 0, waiting_parts: 0, ready: 1, delivered: 105 } };
    }
    await route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/service-orders');
  return bodies;
}

test('date range and delivered card query the server, preserve the period while paginating and show actual delivery dates', async ({ page }) => {
  const bodies = await setup(page);
  const card = page.getByRole('button', { name: /105 Entregues/ });
  await expect(card).toBeVisible();
  await page.getByLabel('Data inicial', { exact: true }).fill('2026-10-24');
  await page.getByLabel('Data final', { exact: true }).fill('2026-10-24');
  await page.getByRole('button', { name: 'Aplicar período', exact: true }).click();
  await expect.poll(() => bodies.at(-1)).toMatchObject({ start_date: '2026-10-24', end_date: '2026-10-24', date_field: 'OPENED', offset: 0 });
  await expect(card).toBeVisible(); await card.click();
  await expect.poll(() => bodies.at(-1)).toMatchObject({ start_date: '2026-10-24', end_date: '2026-10-24', date_field: 'CLOSED', status: 'DELIVERED' });
  await expect(page.getByRole('columnheader', { name: 'Entrega / cancelamento' })).toBeVisible();
  await expect(page.getByRole('link', { name: '24/10/2026, 23:59', exact: true })).toBeVisible();
  await expect(page.getByText('105 ordens encontradas', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect.poll(() => bodies.at(-1)).toMatchObject({ offset: 100, status: 'DELIVERED', start_date: '2026-10-24', end_date: '2026-10-24', date_field: 'CLOSED' });
  await expect(card).toBeVisible(); await expect(page.getByRole('link', { name: '#105', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Próxima', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  await expect(page.getByRole('link', { name: '#104', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/service-order-history-desktop.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Buscar ordens de serviço', exact: true }).fill('ABC1D23');
  await expect.poll(() => bodies.at(-1)).toMatchObject({ search: 'ABC1D23', offset: 0, date_field: 'CLOSED' });
});

test('shortcuts use Brasília dates, invalid ranges are blocked, clear returns to the active queue and mobile has no horizontal overflow', async ({ page }) => {
  const bodies = await setup(page);
  await page.clock.setFixedTime(new Date('2026-10-25T01:00:00Z'));
  await page.getByRole('button', { name: 'Hoje', exact: true }).click();
  await expect(page.getByLabel('Data inicial', { exact: true })).toHaveValue('2026-10-24');
  await expect.poll(() => bodies.at(-1)).toMatchObject({ start_date: '2026-10-24', end_date: '2026-10-24' });
  await page.getByRole('button', { name: 'Ontem', exact: true }).click();
  await expect(page.getByLabel('Data inicial', { exact: true })).toHaveValue('2026-10-23');
  await expect(page.getByLabel('Data final', { exact: true })).toHaveValue('2026-10-23');
  await page.getByRole('button', { name: 'Últimos 7 dias', exact: true }).click();
  await expect(page.getByLabel('Data inicial', { exact: true })).toHaveValue('2026-10-18');
  await page.getByLabel('Data inicial', { exact: true }).fill('2026-10-26');
  await expect(page.getByRole('button', { name: 'Aplicar período', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert').filter({ hasText: 'A data final' })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await expect(page.getByLabel('Data inicial', { exact: true })).toHaveValue('');
  await expect.poll(() => bodies.at(-1)).toMatchObject({ attention: 'ACTIVE', offset: 0, date_field: 'OPENED' });
  expect(bodies.at(-1)).not.toHaveProperty('start_date');
  await page.getByRole('combobox', { name: 'Filtrar por atenção necessária' }).click();
  await page.getByRole('option', { name: 'Todas as condições', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Visualizar lista', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Visualizar quadro', exact: true }).click();
  await expect.poll(() => bodies.at(-1)).toMatchObject({ attention: 'ACTIVE' });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('#main-content').locator('..')).toHaveCSS('padding-left', width >= 768 ? '256px' : '0px');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.locator('#main-content').locator('..')).toHaveCSS('padding-left', '0px');
  await page.screenshot({ path: 'artifacts/service-order-history-mobile.png', fullPage: true });
});
