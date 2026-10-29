import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { DEFAULT_CARE_SETTINGS, keysToCamel, keysToSnake, type CareDashboardResponse } from '@oficina/contracts';

const customerId = '11111111-1111-4111-8111-111111111111';
const vehicleId = '22222222-2222-4222-8222-222222222222';
test('edits campaigns, previews safely, records care and fits mobile without real sends', async ({ page }) => {
  const data: CareDashboardResponse = { settings: structuredClone(DEFAULT_CARE_SETTINGS), channels: { whatsapp: true, email: false }, stats: { optedIn: 28, birthdaysThisMonth: 3, dueThisMonth: 9, sentThisMonth: 12, pending: 2, failed: 1 }, plans: [{ id: 'p1', customerId, customerName: 'Mariana Silva', vehicleId, vehicleName: 'Honda Fit', plate: 'ABC1D23', serviceKey: 'OIL_CHANGE', serviceName: 'Óleo e filtro do motor', completedAt: '2026-04-26T12:00:00Z', mileage: 40000, dueAt: '2026-10-26T12:00:00Z', dueMileage: 50000, intervalMonths: 6, intervalKm: 10000 }], totalPlans: 1, deliveries: [{ id: 'd1', customerName: 'Mariana Silva', campaignNames: ['Aniversário'], channel: 'WHATSAPP', status: 'SENT', message: '🎂 Feliz aniversário, Mariana! Sua oficina deseja caminhos felizes. 💛', scheduledAt: '2026-10-26T12:00:00Z', sentAt: '2026-10-26T12:00:00Z' }, { id: 'd2', customerName: 'Carlos Almeida', campaignNames: ['Pastilhas, discos e freios'], channel: 'WHATSAPP', status: 'UNKNOWN', message: '🛑 Vamos conferir os freios do seu carro?', reason: 'O provedor não confirmou o resultado. Confira a conversa; não haverá repetição automática.', scheduledAt: '2026-10-26T12:00:00Z' }], totalDeliveries: 2 };
  let recorded: Record<string, unknown> | undefined; let saved = false;
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light');
    localStorage.setItem('oficina-auth', JSON.stringify({ state: { accessToken: 'care-ui-test', refreshToken: 'test', user: { id: 'u1', tenantId: 't1', name: 'Equipe', role: 'ADMIN', permissions: ['dashboard.view', 'customers.view', 'vehicles.view', 'appointments.view', 'service_orders.view', 'service_orders.prices', 'alerts.view', 'alerts.manage', 'settings.view', 'settings.manage', 'team.view'] } }, version: 0 }));
    localStorage.setItem('ax-privacy-choice', JSON.stringify({ version: '2026-10-24', necessary: true, analytics: false, marketing: false, savedAt: new Date().toISOString() }));
  });
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); let json: unknown = { items: [], total: 0, offset: 0, limit: 100, hasMore: false };
    if (url.pathname === '/api/v1/settings/branding') json = { company: { name: 'Oficina do Cuidado' } };
    else if (url.pathname === '/api/v1/customer-care') json = data;
    else if (url.pathname === '/api/v1/customer-care/plans') json = { plans: data.plans, total: data.totalPlans };
    else if (url.pathname === '/api/v1/customer-care/deliveries') json = { deliveries: data.deliveries, total: data.totalDeliveries };
    else if (url.pathname === '/api/v1/customer-care/settings') { data.settings = keysToCamel(route.request().postDataJSON()) as typeof data.settings; saved = true; json = data.settings; }
    else if (url.pathname === '/api/v1/customer-care/preview') json = { subject: 'Prévia', message: 'Olá, Mariana! 💛 Aqui é a equipe da Oficina do Cuidado.\n\n🛢️ Está chegando o cuidado com o óleo do seu Honda Fit.\n\nPreferências de contato: [link pessoal]' };
    else if (url.pathname === '/api/v1/customer-care/services') { recorded = route.request().postDataJSON(); json = { id: 'p1' }; }
    else if (url.pathname === '/api/v1/customer-care/preferences/lookup') json = { workshopName: 'Oficina do Cuidado', enabled: true };
    else if (url.pathname === '/api/v1/customer-care/preferences/pause') json = { enabled: false };
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' }, body: JSON.stringify(keysToSnake(json)) });
  });
  mkdirSync('artifacts/customer-care', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1040 });
  await page.goto('/relacionamento'); await expect(page.getByRole('heading', { name: 'O cuidado continua.' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/customer-care/desktop-overview.png', fullPage: true });
  await page.getByRole('tab', { name: 'Campanhas e mensagens' }).click();
  await page.getByRole('button', { name: /Óleo e filtro do motor/ }).click();
  await page.getByLabel('Retorno em meses').fill('8');
  await page.getByLabel('Mensagem da campanha').fill('🛢️ Olá, {cliente}! Vamos cuidar do óleo do seu {veiculo}? Conte com a equipe da {oficina}. 💛');
  await page.getByRole('button', { name: 'Ver mensagem completa' }).click(); await expect(page.getByRole('dialog')).toContainText('Olá, Mariana!');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Salvar régua de cuidado' }).click(); await expect.poll(() => saved).toBe(true);
  expect(data.settings.campaigns.find(item => item.key === 'OIL_CHANGE')?.intervalMonths).toBe(8);
  expect(data.settings.enabled).toBe(false);
  await page.screenshot({ path: 'artifacts/customer-care/desktop-campaign.png', fullPage: true });
  await page.getByRole('tab', { name: 'Planos por veículo' }).click(); await page.getByRole('button', { name: 'Registrar novo serviço' }).click();
  await page.getByLabel('Quilometragem (opcional)').fill('50000');
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar cuidado', exact: true }).click(); await expect.poll(() => recorded?.vehicle_id).toBe(vehicleId);
  expect(recorded?.service_key).toBe('OIL_CHANGE');
  await page.getByRole('tab', { name: 'Histórico dos disparos' }).click(); await expect(page.getByText('Conferir envio', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tentar após corrigir configuração' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('tab', { name: 'Visão geral' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/customer-care/mobile-overview.png', fullPage: true });
  await page.getByRole('tab', { name: 'Campanhas e mensagens' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/customer-care/mobile-campaign.png', fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.evaluate(() => { document.documentElement.classList.remove('light'); document.documentElement.classList.add('dark'); (document.activeElement as HTMLElement)?.blur(); });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/customer-care/tablet-dark-campaign.png', fullPage: true });
  await page.goto(`/preferencias-de-contato/${'a'.repeat(64)}`);
  await expect(page.getByRole('button', { name: 'Pausar meus lembretes' })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar meus lembretes' }).click();
  await expect(page.getByRole('heading', { name: 'Lembretes pausados. Tudo certo! 💛' })).toBeVisible();
});
