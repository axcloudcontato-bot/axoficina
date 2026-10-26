import { expect, test } from '@playwright/test';
import { LEGAL_VERSION } from '@oficina/contracts';

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(({ version, canReadReplies }) => {
    localStorage.setItem('ax-privacy-choice', JSON.stringify({ version, necessary: true, analytics: false, marketing: false, savedAt: new Date().toISOString() }));
    localStorage.setItem('oficina-auth', JSON.stringify({ state: { accessToken: 'notifications-test', refreshToken: 'test-refresh', user: { id: 'u1', tenantId: 't1', name: 'Recepção', email: 'test@example.invalid', role: 'FRONT_DESK', permissions: ['service_orders.view', 'customers.view', ...(canReadReplies ? ['service_orders.prices'] : [])], status: 'active', createdAt: '2026-10-24T00:00:00Z' } }, version: 0 }));
  }, { version: LEGAL_VERSION, canReadReplies: !testInfo.title.includes('without access') });
});

const reply = { id: 'reply-1', service_order_id: 'order-1', order_number: 4, customer_name: 'Sergio Oliveira', question: 'Você aprova este orçamento para realizarmos o serviço?', selected_option: 'Aprovar orçamento', channel: 'WHATSAPP', answered_at: '2026-10-24T22:33:00.000Z', read_at: undefined as string | undefined };

test('new customer reply shows a toast, stays in the bell and persists the read state after reload', async ({ page }) => {
  let arrived = false;
  let readAt: string | undefined;
  let readCount = 0;
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    const path = new URL(route.request().url()).pathname;
    let json: unknown = { items: [], total: 0, offset: 0, limit: 100, has_more: false };
    if (path.endsWith('/customer-reply-notifications')) json = { items: arrived ? [{ ...reply, read_at: readAt }] : [], unread_count: arrived && !readAt ? 1 : 0 };
    if (path.endsWith('/customer-reply-notifications/reply-1/read')) { readCount++; readAt = new Date().toISOString(); json = { read: true }; }
    if (path.endsWith('/settings/branding')) json = { company: { name: 'AX Oficina' } };
    await route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/clientes');
  await expect(page.getByRole('heading', { name: 'Clientes', exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('open-alert-indicator')).toHaveCount(0);
  // Confirm the initial empty response was consumed before the arrival.
  await page.getByRole('button', { name: 'Alertas', exact: true }).click();
  await expect(page.getByText('Nenhuma resposta de cliente recebida.')).toBeVisible();
  await page.getByRole('button', { name: 'Alertas', exact: true }).click();
  arrived = true;
  // Exercise the production polling interval without a manual refresh.
  await expect(page.getByText('Sergio Oliveira respondeu à OS #00004', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('open-alert-indicator')).toContainText('1');
  await page.getByRole('button', { name: 'Ver notificações', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Alertas', exact: true });
  await expect(panel.getByText('Resposta: Aprovar orçamento', { exact: true })).toBeVisible();
  await expect(panel.getByRole('link', { name: /Sergio Oliveira respondeu/ })).toHaveAttribute('href', '/service-orders/order-1#customer-message-history');
  await expect(panel.locator('..')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'artifacts/customer-reply-notifications-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/customer-reply-notifications-mobile.png', fullPage: true });
  await panel.getByRole('button', { name: 'Marcar resposta da OS #00004 como lida', exact: true }).click();
  await expect(panel.getByText('Lida', { exact: true })).toBeVisible();
  await expect(page.getByTestId('open-alert-indicator')).toHaveCount(0);
  expect(readCount).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Alertas', exact: true }).click();
  await expect(page.getByText('Lida', { exact: true })).toBeVisible();
  await expect(page.getByTestId('open-alert-indicator')).toHaveCount(0);
  await page.getByRole('link', { name: /Sergio Oliveira respondeu/ }).click();
  await expect(page).toHaveURL(/service-orders\/order-1#customer-message-history$/);
  expect(readCount).toBe(1);
});

test('unread replies are announced on login and a failed read stays pending', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = { items: [], total: 0 };
    let status = 200;
    if (path.endsWith('/settings/branding')) json = { company: { name: 'AX Oficina' } };
    if (path.endsWith('/customer-reply-notifications')) json = { items: [reply], unread_count: 1 };
    if (path.endsWith('/customer-reply-notifications/reply-1/read')) { status = 500; json = { error: { message: 'Não foi possível salvar a leitura.' } }; }
    await route.fulfill({ status, json, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
  });
  await page.goto('/clientes');
  await expect(page.getByText('Você tem 1 resposta de cliente não lida.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver notificações', exact: true }).click();
  await page.getByRole('button', { name: 'Marcar resposta da OS #00004 como lida', exact: true }).click();
  await expect(page.getByText('Não foi possível salvar a leitura.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('open-alert-indicator')).toContainText('1');
  await expect(page.getByText('Nova', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Atualizar respostas', exact: true }).click();
  await expect(page.getByText('Sergio Oliveira respondeu à OS #00004', { exact: true })).toHaveCount(0);
});

test('users without access to quote responses never request the notification feed', async ({ page }) => {
  let feedRequests = 0;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('customer-reply-notifications')) feedRequests++;
    const json = path.endsWith('/settings/branding') ? { company: { name: 'AX Oficina' } } : { items: [], total: 0 };
    await route.fulfill({ json, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
  });
  await page.goto('/clientes');
  await page.getByRole('button', { name: 'Alertas', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Respostas dos clientes', exact: true })).toHaveCount(0);
  expect(feedRequests).toBe(0);
});
