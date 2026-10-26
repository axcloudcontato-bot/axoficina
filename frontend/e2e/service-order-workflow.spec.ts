import { expect, test, type Page } from '@playwright/test';
import { LEGAL_VERSION } from '@oficina/contracts';

const created = '2026-10-24T12:00:00Z';
const item = { id: 'item-1', service_order_id: 'order-1', type: 'LABOR', description: 'Revisão de freios', quantity: 1, unit_price_cents: 15000, line_total_cents: 15000, created_at: created };
type Message = { id: string; purpose: string; channel: string; delivery_mode: string; sent_at?: string; question: string; options: string[]; message: string; created_at: string; expires_at: string; quote?: object; quote_is_current?: boolean; answered_at?: string; selected_option?: number };

async function workshop(page: Page, { emptyPhotos = false, status = 'OPEN', integrated = true } = {}) {
  await page.clock.install({ time: new Date('2026-10-24T15:00:00Z') });
  await page.addInitScript(version => {
    localStorage.setItem('ax-privacy-choice', JSON.stringify({ version, necessary: true, analytics: false, marketing: false, savedAt: new Date().toISOString() }));
    localStorage.setItem('oficina-auth', JSON.stringify({ state: { accessToken: 'workflow-test', refreshToken: 'test', user: { id: 'u1', tenantId: 't1', name: 'Recepção', email: 'test@example.invalid', role: 'ADMIN', status: 'active' } }, version: 0 }));
  }, LEGAL_VERSION);
  const order = { id: 'order-1', tenant_id: 't1', order_number: 4, customer_id: 'c1', customer_name: 'Sergio Oliveira', customer_phone: '11999998888', vehicle_id: 'v1', vehicle_brand: 'Honda', vehicle_model: 'HR-V', vehicle_plate: 'ABC1D23', status, opened_at: created, created_at: created, diagnosis: '', customer_complaint: '', technician_name: 'Técnico A', items: [item], quote_revision: 'a'.repeat(64), total_amount_cents: 15000, received_amount_cents: 0, outstanding_amount_cents: 15000, payment_status: 'AWAITING_PAYMENT', payment_method: null as string | null, receipts: [] as object[], installments: [] as object[] };
  const messages: Message[] = [];
  const posts: { path: string; body: Record<string, unknown> }[] = [];
  const photos: object[] = [];
  const angles = ['FRONT', 'REAR', 'LEFT_SIDE', 'RIGHT_SIDE', 'SPARE_TIRE', 'DASHBOARD'];
  function addAngles(category: string) { photos.push(...angles.map(angle => ({ id: `${category}-${angle}`, service_order_id: order.id, category, angle, created_at: created, mime_type: 'image/png', original_name: 'car.png', size_bytes: 68 }))); }
  if (!emptyPhotos) addAngles('ENTRY');
  await page.route('**/api/v1/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    if (path.endsWith('/service-orders/photos/content')) return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'), headers: { 'access-control-allow-origin': '*' } });
    const body = req.method() === 'POST' ? req.postDataJSON() : {};
    if (req.method() === 'POST') posts.push({ path, body });
    let json: unknown = { items: [], total: 0, has_more: false };
    if (path.endsWith('/settings/branding')) json = { company: { name: 'AX Oficina' }, whatsapp_enabled: integrated };
    if (path.endsWith('/customer-reply-notifications')) json = { items: [], unread_count: 0 };
    if (path.endsWith('/users/list')) json = { items: [{ id: 'u1', name: 'Técnico A' }], total: 1 };
    if (path.endsWith('/customer')) json = { customer: { id: 'c1', name: 'Sergio Oliveira', phone: order.customer_phone, email: 'sergio@example.invalid' } };
    if (path.endsWith('/service-order')) json = { service_order: order };
    if (path.endsWith('/service-orders/photos')) json = { photos };
    if (path.endsWith('/service-orders/update')) { Object.assign(order, body); json = { service_order: order }; }
    if (path.endsWith('/service-orders/transition')) { order.status = body.to_status; json = { service_order: order }; }
    if (path.endsWith('/service-orders/customer-messages')) {
      if (req.method() === 'GET') json = { messages };
      else {
        const id = `message-${messages.length}`;
        messages.unshift({ id, purpose: body.purpose, channel: body.channel, delivery_mode: integrated ? 'WA_AKG' : 'LINK', sent_at: integrated ? created : undefined, question: body.question, options: body.options, message: 'Olá, Sergio!', created_at: created, expires_at: '2030-01-01T00:00:00Z', ...(body.purpose === 'QUOTE' ? { quote: { order_number: 4, vehicle: 'Honda HR-V', plate: 'ABC1D23', total_amount_cents: 15000, items: [item] }, quote_is_current: true } : {}) });
        if (integrated && body.purpose === 'QUOTE' && order.status === 'OPEN') order.status = 'AWAITING_APPROVAL';
        json = { message_id: id, sent: integrated, delivery_mode: integrated ? 'WA_AKG' : 'LINK', response_url: `http://localhost:3000/responder/${'b'.repeat(64)}`, ...(!integrated ? { whatsapp_url: 'https://wa.me/5511999998888?text=test' } : {}) };
      }
    }
    if (path.endsWith('/customer-messages/confirm-dispatch')) { messages[0].sent_at = created; if (messages[0].purpose === 'QUOTE') order.status = 'AWAITING_APPROVAL'; json = { sent: true }; }
    if (path.endsWith('/service-orders/payment/configure')) { order.payment_method = body.method; order.received_amount_cents = 15000; order.outstanding_amount_cents = 0; order.payment_status = 'PAID'; order.receipts = [{ id: 'receipt', method: 'PIX', amount_cents: 15000, received_at: created }]; json = { service_order: order }; }
    await route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  return { order, messages, photos, posts, addAngles, approve: () => { messages[0].answered_at = created; messages[0].selected_option = 0; }, completePhotos: () => { addAngles('EXIT'); photos.push(...['ISSUE', 'RESOLVED'].map(category => ({ id: category, service_order_id: order.id, service_order_item_id: item.id, category, created_at: created, mime_type: 'image/png', original_name: 'item.png' }))); } };
}
function step(page: Page, name: string) { return page.getByRole('navigation', { name: 'Etapas do atendimento' }).getByRole('button', { name, exact: true }); }

test('a complete service order keeps approval, execution, payment and delivery as explicit actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await workshop(page); await page.goto('/ordens-de-servico/order-1');
  await expect(step(page, 'Entrada')).toHaveAttribute('aria-current', 'step');
  await page.getByLabel('Solicitação do cliente', { exact: true }).fill('Ruído ao frear');
  await page.getByRole('button', { name: 'Preparar orçamento', exact: true }).click();
  await expect(step(page, 'Orçamento')).toHaveAttribute('aria-current', 'step');
  expect(state.posts.find(post => post.path.endsWith('/update'))?.body.customer_complaint).toBe('Ruído ao frear');
  await page.getByLabel('Diagnóstico técnico', { exact: true }).fill('Pastilhas desgastadas');
  await page.getByRole('button', { name: 'Conferir aprovação', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar e enviar ao cliente', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Enviar orçamento para aprovação' });
  await expect(dialog).toContainText('Revisão de freios'); await expect(dialog).toContainText('R$ 150,00');
  expect(state.messages).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Enviar orçamento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Aguardando o cliente', exact: true })).toBeVisible();
  expect(state.order.status).toBe('AWAITING_APPROVAL');
  expect(state.posts.filter(post => post.path.endsWith('/transition'))).toHaveLength(0);
  state.approve(); await page.clock.fastForward(10_100);
  await expect(page.getByText('Aprovado · aguardando início', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar serviço autorizado', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(step(page, 'Execução')).toHaveAttribute('aria-current', 'step'); expect(state.order.status).toBe('IN_PROGRESS');
  expect(state.posts.find(post => post.path.endsWith('/transition') && post.body.to_status === 'IN_PROGRESS')?.body.authorization).toBe('CUSTOMER_MESSAGE');
  await page.getByRole('button', { name: 'Conferir conclusão e entrega', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Marcar pronto para entrega', exact: true })).toBeDisabled();
  state.completePhotos(); await page.reload(); await step(page, 'Entrega').click();
  await page.getByRole('button', { name: 'Marcar pronto para entrega', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pronto para entrega', exact: true })).toBeVisible();
  await page.getByRole('combobox').filter({ hasText: 'Selecione a forma combinada' }).click();
  await page.getByRole('option', { name: 'PIX', exact: true }).click();
  await page.getByRole('checkbox', { name: /Já recebi o valor integral/ }).check();
  await page.getByRole('button', { name: 'Confirmar recebimento integral', exact: true }).click();
  await expect(page.getByText('Recebido', { exact: true })).toBeVisible(); expect(state.order.outstanding_amount_cents).toBe(0);
  await page.getByRole('button', { name: 'Enviar aviso de retirada', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar aviso', exact: true }).click();
  expect(state.messages[0].purpose).toBe('PICKUP'); expect(state.order.status).toBe('COMPLETED');
  await page.getByRole('button', { name: 'Registrar retirada e encerrar OS', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirmar entrega', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: /Confirmei a retirada/ }).check();
  await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Veículo entregue', exact: true })).toBeVisible(); expect(state.order.status).toBe('DELIVERED');
});

test('background refresh preserves unsaved fields and navigation never pretends an operational step is complete', async ({ page }) => {
  const state = await workshop(page); await page.goto('/ordens-de-servico/order-1');
  await page.getByLabel('Solicitação do cliente', { exact: true }).fill('Não perder este texto');
  state.order.technician_name = 'Técnico B'; await page.clock.fastForward(10_100);
  await expect(page.getByLabel('Solicitação do cliente', { exact: true })).toHaveValue('Não perder este texto');
  await step(page, 'Entrega').click(); expect(state.order.status).toBe('OPEN');
  await expect(page.getByRole('button', { name: 'Registrar retirada e encerrar OS', exact: true })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Alterações ainda não salvas' })).toBeVisible();
  await step(page, 'Entrada').click(); await expect(page.getByLabel('Solicitação do cliente', { exact: true })).toHaveValue('Não perder este texto');
});

test('approval requirements are visible before sending and the flow fits a mobile screen', async ({ page }) => {
  await workshop(page, { emptyPhotos: true }); await page.goto('/ordens-de-servico/order-1?step=approval');
  await expect(step(page, 'Aprovação')).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('button', { name: 'Revisar e enviar ao cliente', exact: true })).toBeDisabled();
  await expect(page.getByText('Complete as fotos de entrada antes de enviar.', { exact: false })).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('#main-content').locator('..')).toHaveCSS('padding-left', width >= 768 ? '256px' : '0px');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.locator('#main-content').locator('..')).toHaveCSS('padding-left', '0px');
  await page.getByRole('heading', { name: 'Prepare a aprovação', exact: true }).click();
  await page.screenshot({ path: 'artifacts/workflow-approval-mobile.png', fullPage: true });
});

test('the customer sees the sent quote, explicitly confirms a choice and cannot approve an outdated version', async ({ page }) => {
  const state = await workshop(page);
  const quote = { order_number: 4, vehicle: 'Honda HR-V', plate: 'ABC1D23', total_amount_cents: 15000, items: [item] };
  let answered = false; let current = true; let posted = 0;
  await page.route('**/api/v1/public/customer-message**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    if (route.request().method() === 'POST') { answered = true; posted++; }
    await route.fulfill({ json: { company_name: 'AX Oficina', purpose: 'QUOTE', quote, quote_is_current: current, can_answer: current, unavailable_reason: 'O orçamento mudou. Solicite a versão atualizada.', message: 'Olá, Sergio', question: 'Você aprova este orçamento para realizarmos o serviço?', options: ['Aprovar orçamento', 'Não aprovar', 'Falar com a oficina'], expires_at: '2030-01-01T00:00:00Z', ...(answered ? { selected_option: 0, answered_at: created } : {}) }, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/responder/${'b'.repeat(64)}?option=0`);
  await expect(page.getByRole('heading', { name: 'Aprovação do orçamento' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Orçamento enviado' })).toContainText('Revisão de freios');
  expect(posted).toBe(0);
  await page.screenshot({ path: 'artifacts/customer-approval-mobile.png', fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.screenshot({ path: 'artifacts/customer-approval-dark-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Confirmar aprovação', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Resposta registrada: Aprovar orçamento'); expect(posted).toBe(1);
  answered = false; current = false; await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'O orçamento mudou' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar aprovação' })).toHaveCount(0);
  expect(state.order.status).toBe('OPEN');
});

test('all five stages keep their content within narrow and desktop layouts in the dark theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await workshop(page, { status: 'COMPLETED' }); await page.goto('/ordens-de-servico/order-1');
  await expect(page.locator('html')).toHaveClass(/dark/);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('#main-content').locator('..')).toHaveCSS('padding-left', width >= 768 ? '256px' : '0px');
    for (const name of ['Entrada', 'Orçamento', 'Aprovação', 'Execução', 'Entrega']) {
      await step(page, name).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 390 && name === 'Aprovação') await page.screenshot({ path: 'artifacts/workflow-approval-dark-mobile.png', fullPage: true });
    }
  }
});
