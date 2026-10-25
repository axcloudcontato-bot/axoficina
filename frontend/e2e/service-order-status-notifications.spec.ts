import { expect, test, type Page } from '@playwright/test';
import { LEGAL_VERSION } from '@oficina/contracts';

async function preferencesInCreate(page: Page) {
  const form = page.getByRole('dialog', { name: 'Novo cliente', exact: true });
  for (const name of ['Endereço', 'Contato', 'Preferências']) {
    await form.getByRole('button', { name: 'Próximo', exact: true }).click();
    await expect(form.locator('[aria-current="step"]')).toContainText(name);
  }
}
async function finishCreate(page: Page) {
  const form = page.getByRole('dialog', { name: 'Novo cliente', exact: true });
  await form.getByRole('button', { name: 'Próximo', exact: true }).click();
  await expect(form.locator('[aria-current="step"]')).toContainText('Observações');
  await form.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
}

async function setup(page: Page) {
  await page.clock.install({ time: new Date('2026-10-25T15:00:00Z') });
  await page.addInitScript(version => {
    localStorage.setItem('ax-privacy-choice', JSON.stringify({ version, necessary: true, analytics: false, marketing: false, savedAt: new Date().toISOString() }));
    localStorage.setItem('oficina-auth', JSON.stringify({ state: { accessToken: 'status-test', refreshToken: 'test', user: { id: 'u1', tenantId: 't1', name: 'Recepção', role: 'ADMIN', status: 'active' } }, version: 0 }));
  }, LEGAL_VERSION);
  let customer: Record<string, unknown> | undefined;
  const writes: Record<string, unknown>[] = [];
  const retries: Record<string, unknown>[] = [];
  const notice = { id: 'notice-1', to_status: 'OPEN', status: 'FAILED', message: '*ORDEM DE SERVIÇO ABERTA*\n\n*OS:* #00004\n*Placa:* ABC1D23', recipient: '5511999998888', attempts: 1, occurred_at: '2026-10-25T12:00:00Z', failure_reason: 'O WhatsApp não confirmou o envio. Confira a conversa antes de reenviar.' };
  const order = { id: 'order-1', tenant_id: 't1', order_number: 4, customer_id: 'c1', customer_name: 'Sergio Oliveira', customer_phone: '11999998888', vehicle_id: 'v1', vehicle_brand: 'Honda', vehicle_model: 'HR-V', vehicle_plate: 'ABC1D23', status: 'OPEN', opened_at: '2026-10-25T12:00:00Z', created_at: '2026-10-25T12:00:00Z', items: [], total_amount_cents: 0, received_amount_cents: 0, outstanding_amount_cents: 0, payment_status: 'AWAITING_PAYMENT' };
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    const path = new URL(route.request().url()).pathname;
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
    let json: unknown = { items: [], total: 0, has_more: false };
    if (path.endsWith('/settings/branding')) json = { company: { name: 'AX Oficina' } };
    if (path.endsWith('/customer-reply-notifications')) json = { items: [], unread_count: 0 };
    if (path.endsWith('/customers/list')) json = { items: customer ? [customer] : [], total: customer ? 1 : 0, has_more: false };
    if (path.endsWith('/customers') || path.endsWith('/customers/update')) { writes.push(body); customer = { id: 'c1', tenant_id: 't1', type: 'PF', document: '', created_at: '2026-10-25T12:00:00Z', ...customer, ...body }; json = { customer }; }
    if (path.endsWith('/service-order')) json = { service_order: order };
    if (path.endsWith('/fipe/brands')) json = { brands: [] };
    if (path.endsWith('/service-orders/photos')) json = { photos: [] };
    if (path.endsWith('/service-orders/customer-messages')) json = { messages: [] };
    if (path.endsWith('/status-notifications/list')) json = { items: [notice], total: 1, offset: 0, limit: 20, has_more: false };
    if (path.endsWith('/status-notifications/retry')) { retries.push(body); notice.status = 'PENDING'; notice.failure_reason = ''; json = { queued: true }; }
    await route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  return { writes, retries, notice };
}

test('the customer opt-in defaults off, saves true and false and survives reopening on mobile', async ({ page }) => {
  const state = await setup(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/customers');
  await page.getByRole('button', { name: 'Novo cliente', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Novo cliente', exact: true });
  await form.getByLabel('Nome', { exact: true }).fill('Sergio Oliveira');
  await form.getByLabel('Telefone', { exact: true }).fill('11999998888');
  await preferencesInCreate(page);
  const preference = form.getByRole('checkbox', { name: 'Me avise sobre toda movimentação da Ordem de Serviço.', exact: true });
  await expect(preference).not.toBeChecked(); await preference.check();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/customer-whatsapp-status-preference.png', fullPage: true });
  await finishCreate(page);
  await expect(form).toHaveCount(0); expect(state.writes[0].notify_service_order_updates).toBe(true);
  await page.goto('/customers');
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Editar cliente', exact: true });
  await edit.getByRole('tab', { name: 'Preferências', exact: true }).click();
  const saved = edit.getByRole('checkbox', { name: 'Me avise sobre toda movimentação da Ordem de Serviço.', exact: true });
  await expect(saved).toBeChecked(); await saved.uncheck();
  await edit.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(edit).toHaveCount(0); expect(state.writes[1].notify_service_order_updates).toBe(false);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByRole('dialog').getByRole('tab', { name: 'Preferências', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Me avise sobre toda movimentação da Ordem de Serviço.', exact: true })).not.toBeChecked();
});

test('opt-in requires a complete phone and brings the employee back to the field that needs correction', async ({ page }) => {
  const state = await setup(page); await page.goto('/customers'); await page.getByRole('button', { name: 'Novo cliente', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Novo cliente', exact: true });
  await form.getByLabel('Nome', { exact: true }).fill('Cliente'); await form.getByLabel('Telefone', { exact: true }).fill('123');
  await preferencesInCreate(page);
  await form.getByRole('checkbox', { name: 'Me avise sobre toda movimentação da Ordem de Serviço.', exact: true }).check();
  await finishCreate(page);
  await expect(form.getByText('Informe um telefone com DDD válido para ativar os avisos pelo WhatsApp.', { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

test('the OS shows failures, a WhatsApp bold preview and an explicit retry that can later become sent', async ({ page }) => {
  const state = await setup(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/service-orders/order-1');
  const section = page.getByRole('region', { name: 'Avisos automáticos ao cliente' });
  await expect(section.getByRole('status')).toContainText('Há avisos com envio não confirmado');
  await section.getByRole('button', { name: /Ver avisos/ }).click();
  await expect(section.getByText('Envio não confirmado', { exact: true })).toBeVisible();
  await section.getByText('Ver mensagem', { exact: true }).click();
  await expect(section.locator('strong').filter({ hasText: 'ORDEM DE SERVIÇO ABERTA' })).toBeVisible();
  await section.getByRole('button', { name: 'Reenviar aviso', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reenviar aviso de movimentação' });
  await expect(dialog.getByRole('button', { name: 'Confirmar reenvio', exact: true })).toBeDisabled(); expect(state.retries).toHaveLength(0);
  await dialog.getByRole('checkbox', { name: 'Conferi a conversa e quero reenviar este aviso.' }).check();
  await dialog.getByRole('button', { name: 'Confirmar reenvio', exact: true }).click();
  await expect(dialog).toHaveCount(0); expect(state.retries).toEqual([{ id: 'notice-1', confirm_resend: true }]);
  await expect(section.getByText('Aguardando envio', { exact: true })).toBeVisible();
  state.notice.status = 'SENT'; await page.clock.fastForward(10_100);
  await expect(section.getByText('Enviado', { exact: true })).toBeVisible();
  await expect(section.getByRole('button', { name: 'Reenviar aviso', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/service-order-status-notifications-mobile.png', fullPage: true });
});
