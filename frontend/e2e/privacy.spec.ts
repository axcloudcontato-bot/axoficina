import { expect, test } from '@playwright/test';

test.describe('Public privacy information', () => {
  test('policies are accessible without a session and disclose missing operator identity', async ({ page }) => {
    const titles: Record<string, string> = { privacidade: 'Política de privacidade', termos: 'Termos de uso', cookies: 'Política de cookies e armazenamento local', reembolso: 'Política de cancelamento e reembolso' };
    for (const [path, title] of Object.entries(titles)) {
      await page.goto(`/${path}`);
      await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Conteúdo do documento' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'LGPD', exact: true })).toHaveAttribute('href', /planalto/);
    }
    await page.goto('/privacidade');
    await page.screenshot({ path: 'artifacts/privacy-desktop.png' });
  });
  test('necessary-only notice persists and preferences can be reopened', async ({ page }) => {
    await page.goto('/cookies');
    const notice = page.getByRole('region', { name: 'Aviso de cookies e armazenamento' });
    await expect(notice).toBeVisible();
    await page.getByRole('button', { name: 'Somente necessários', exact: true }).click();
    await expect(notice).toHaveCount(0);
    await page.reload(); await expect(notice).toHaveCount(0);
    await page.getByRole('button', { name: 'Preferências de cookies', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Preferências de cookies' })).toBeVisible();
    await page.getByRole('button', { name: 'Salvar somente necessários' }).click();
    const choice = await page.evaluate(() => JSON.parse(localStorage.getItem('ax-privacy-choice')!));
    expect(choice.analytics).toBe(false); expect(choice.marketing).toBe(false);
  });
  test('signup starts without acceptance and provides policy links', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: 'Somente necessários', exact: true }).click();
    await expect(page.getByRole('checkbox')).not.toBeChecked();
    await expect(page.getByRole('link', { name: 'Termos de uso', exact: true }).first()).toHaveAttribute('href', '/termos');
    await expect(page.getByRole('link', { name: 'Política de privacidade', exact: true })).toHaveAttribute('href', '/privacidade');
  });
  test('mobile policies and consent controls fit the screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/privacidade');
    await expect(page.getByRole('button', { name: 'Somente necessários', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'artifacts/privacy-mobile.png' });
  });
  test('a user can register an own deletion request, review the warning and end the session after erasure', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('oficina-auth', JSON.stringify({ state: { accessToken: 'test-token', refreshToken: 'test-refresh', user: { id: 'test-user', tenantId: 'test-tenant', email: 'test@example.invalid', name: 'Pessoa de teste', role: 'MECHANIC', permissions: ['customers.view'], status: 'active', createdAt: '2026-10-24T00:00:00Z' } }, version: 0 }));
    });
    const protocols: Array<Record<string, unknown>> = [];
    let eraseBody: Record<string, unknown> | undefined;
    await page.route('**/api/v1/**', async (route) => {
      const url = route.request().url();
      let json: unknown = {};
      if (url.endsWith('/privacy/requests') && route.request().method() === 'POST') {
        const item = { id: 'test-protocol', type: 'DELETION', status: 'OPEN', created_at: new Date().toISOString(), due_at: new Date(Date.now() + 86400000).toISOString() };
        protocols.push(item); json = { request: item };
      } else if (url.endsWith('/privacy/requests')) json = { items: protocols };
      else if (url.endsWith('/privacy/account/erase')) { eraseBody = route.request().postDataJSON(); json = { success: true }; }
      else if (url.endsWith('/settings/branding')) json = { company: { name: 'Oficina de teste' } };
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' }, body: JSON.stringify(json) });
    });
    await page.goto('/settings/privacy');
    await page.getByRole('button', { name: 'Somente necessários', exact: true }).click();
    await page.getByLabel('Tipo de solicitação').selectOption('DELETION');
    await page.getByRole('button', { name: 'Registrar solicitação', exact: true }).click();
    await expect(page.getByText('Protocolo: test-protocol', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'artifacts/privacy-center.png' });
    await page.getByRole('button', { name: 'Apagar minha conta e encerrar sessões' }).click();
    await expect(page.getByRole('dialog', { name: 'Apagar minha conta' })).toBeVisible();
    await expect(page.getByText(/O acervo da oficina e os identificadores técnicos/)).toBeVisible();
    await page.getByLabel('Sua senha atual').fill('test-password');
    await page.getByLabel('Digite EXCLUIR').fill('EXCLUIR');
    await page.getByRole('button', { name: 'Apagar dados pessoais', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(eraseBody).toEqual({ request_id: 'test-protocol', password: 'test-password', confirmation: 'EXCLUIR' });
  });
});
