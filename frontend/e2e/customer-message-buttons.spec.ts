import { expect, test } from '@playwright/test';
import { LEGAL_VERSION } from '@oficina/contracts';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem('ax-privacy-choice', JSON.stringify({ version, necessary: true, analytics: false, marketing: false, savedAt: new Date().toISOString() }));
  }, LEGAL_VERSION);
});

test('customer sees reply buttons on mobile and confirms once without logging in', async ({ page }) => {
  const reply = { company_name: 'AX Oficina', question: 'Você aprova este orçamento para realizarmos o serviço?', options: ['Aprovar orçamento', 'Não aprovar', 'Falar com a oficina'], message: 'Olá, Maria!\n\nOrçamento da OS #00012.\nVeículo: Honda Fit · ABC1D23\n\n• Peça: Pastilha de freio — R$ 350,00\n\nTotal: R$ 350,00', expires_at: new Date(Date.now() + 86400000).toISOString() };
  let answerCount = 0;
  await page.route('**/api/v1/public/customer-message**', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    let json = reply;
    if (route.request().method() === 'POST') {
      answerCount++;
      expect(route.request().postDataJSON()).toEqual({ token: 'a'.repeat(64), selected_option: 0 });
      json = { ...reply, selected_option: 0, answered_at: new Date().toISOString() } as typeof reply;
    }
    await route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto(`/responder/${'a'.repeat(64)}?option=0`);
  await expect(page.getByRole('button', { name: 'Aprovar orçamento', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(answerCount).toBe(0);
  await page.screenshot({ path: 'artifacts/customer-reply-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/customer-reply-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Confirmar resposta', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Resposta registrada: Aprovar orçamento');
  expect(answerCount).toBe(1);
  await expect(page.getByRole('button', { name: 'Confirmar resposta', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/customer-reply-confirmed.png', fullPage: true });
});

for (const integrated of [false, true]) test(`workshop customizes a question and sends buttons via ${integrated ? 'WA-AKG' : 'email'}`, async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oficina-auth', JSON.stringify({ state: { accessToken: 'buttons-test', refreshToken: 'test-refresh', user: { id: 'u1', tenantId: 't1', name: 'Teste', email: 'test@example.invalid', role: 'ADMIN', permissions: ['service_orders.view', 'service_orders.manage', 'service_orders.prices', 'customers.view', 'settings.view'], status: 'active', createdAt: '2026-10-24T00:00:00Z' } }, version: 0 })));
  const order = { id: 'order-1', tenant_id: 't1', order_number: 12, customer_id: 'c1', customer_name: 'Maria', customer_phone: '11999998888', vehicle_id: 'v1', vehicle_brand: 'Honda', vehicle_model: 'Fit', vehicle_plate: 'ABC1D23', status: 'OPEN', opened_at: '2026-10-24T12:00:00Z', created_at: '2026-10-24T12:00:00Z', total_amount_cents: 35000, received_amount_cents: 0, outstanding_amount_cents: 35000, payment_status: 'AWAITING_PAYMENT', status_history: [], items: [{ id: 'item-1', service_order_id: 'order-1', type: 'PART', description: 'Pastilha de freio', quantity: 1, unit_price_cents: 35000, line_total_cents: 35000, created_at: '2026-10-24T12:00:00Z' }] };
  let sent: Record<string, unknown> | undefined;
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    let json: unknown = { items: [], total: 0, offset: 0, limit: 100, has_more: false };
    if (url.pathname.endsWith('/service-order')) json = { service_order: order };
    else if (url.pathname.endsWith('/customer')) json = { customer: { id: 'c1', name: 'Maria', email: 'client@example.invalid', phone: '11999998888', type: 'PF', document: '' } };
    else if (url.pathname.endsWith('/settings/branding')) json = { company: { name: 'AX Oficina' }, whatsapp_enabled: integrated };
    else if (url.pathname.endsWith('/service-orders/photos')) json = { photos: [] };
    else if (url.pathname.endsWith('/service-orders/customer-messages')) {
      if (route.request().method() === 'POST') { sent = route.request().postDataJSON(); json = { response_url: 'https://example.invalid/responder/test', sent: true }; }
      else { expect(url.searchParams.get('serviceOrderId')).toBe('order-1'); json = { messages: [] }; }
    }
    await route.fulfill({ json, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
  });
  await page.goto('/service-orders/order-1');
  const section = page.getByRole('region', { name: 'Orçamento', exact: true });
  await expect(section.getByLabel('Solicitar resposta por botões')).toBeChecked();
  await section.getByLabel('Tipo de pergunta').selectOption('PICKUP');
  await expect(section.getByLabel('Botão 1')).toHaveValue('Confirmar retirada');
  await section.getByLabel('Pergunta para o cliente').fill('Pode retirar seu veículo amanhã às 10h?');
  await section.scrollIntoViewIfNeeded();
  await section.screenshot({ path: integrated ? 'artifacts/customer-message-wa-akg.png' : 'artifacts/customer-message-composer.png' });
  if (integrated) await expect(section.getByText(/WA-AKG envia a mensagem/)).toBeVisible();
  let popupOpened = false;
  page.on('popup', () => { popupOpened = true; });
  await section.getByRole('button', { name: integrated ? 'WhatsApp' : 'Enviar por e-mail', exact: true }).click();
  await expect(page.getByText(integrated ? 'Mensagem com botões enviada pelo WA-AKG.' : 'E-mail com botões enviado ao cliente.', { exact: true })).toBeVisible();
  expect(sent).toEqual({ service_order_id: 'order-1', channel: integrated ? 'WHATSAPP' : 'EMAIL', question: 'Pode retirar seu veículo amanhã às 10h?', options: ['Confirmar retirada', 'Combinar outro horário'], include_quote: false });
  expect(popupOpened).toBe(false);
});

test('workshop configures WA-AKG without exposing saved secrets and verifies the connection', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oficina-auth', JSON.stringify({ state: { accessToken: 'settings-test', refreshToken: 'test-refresh', user: { id: 'u1', tenantId: 't1', name: 'Teste', email: 'test@example.invalid', role: 'ADMIN', permissions: ['settings.view', 'settings.manage'], status: 'active', createdAt: '2026-10-24T00:00:00Z' } }, version: 0 })));
  const settings = { base_url: 'https://chat.axcloud.com.br/api', session_id: 'oficina', api_key_configured: false, webhook_secret_configured: false, enabled: false, webhook_url: 'https://api.oficina.example/api/v1/webhooks/wa-akg/tenant-id' };
  let saved: Record<string, unknown> | undefined;
  let checked = false;
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    let json: unknown = {};
    if (url.pathname.endsWith('/settings/branding')) json = { company: { name: 'AX Oficina' } };
    if (url.pathname.endsWith('/settings/whatsapp')) {
      if (route.request().method() === 'POST') { saved = route.request().postDataJSON(); Object.assign(settings, { api_key_configured: true, webhook_secret_configured: true, enabled: true }); }
      json = settings;
    }
    if (url.pathname.endsWith('/settings/whatsapp/test')) { checked = true; json = { connected: true, status: 'Connected' }; }
    await route.fulfill({ json, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
  });
  await page.goto('/settings/whatsapp');
  await page.getByLabel('Chave de API', { exact: true }).fill('private-test-key');
  await page.getByLabel('Segredo do webhook', { exact: true }).fill('private-webhook-secret-'.repeat(3));
  await page.getByLabel('Ativar envio de botões pelo WA-AKG').check();
  await expect(page.getByRole('button', { name: 'Testar conexão', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Salvar configuração', exact: true }).click();
  await expect(page.getByText('Configuração do WhatsApp atualizada.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Chave de API', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Segredo do webhook', { exact: true })).toHaveValue('');
  expect(saved).toMatchObject({ base_url: 'https://chat.axcloud.com.br/api', session_id: 'oficina', api_key: 'private-test-key', enabled: true });
  await page.getByRole('button', { name: 'Testar conexão', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Conexão validada');
  expect(checked).toBe(true);
  await page.screenshot({ path: 'artifacts/wa-akg-settings.png', fullPage: true });
});
