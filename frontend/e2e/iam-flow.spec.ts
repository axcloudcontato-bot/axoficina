import { expect, test } from '@playwright/test';

// E2E real de ponta a ponta — precisa do backend rodando com Postgres/Redis
// migrados e semeados (docker compose up + migrate:deploy + seed). Não
// verificado nesta sessão (sem Docker disponível); ver README.
test.describe('IAM flow', () => {
  test('signup -> invite -> accept -> login', async ({ page, context }) => {
    const suffix = Date.now();
    const adminEmail = `admin-${suffix}@e2e-test.com`;
    const mechanicEmail = `mechanic-${suffix}@e2e-test.com`;

    await page.goto('/cadastro');
    await page.getByLabel('Nome da oficina').fill(`Oficina E2E ${suffix}`);
    await page.getByLabel('CPF ou CNPJ').fill('11444777000161');
    await page.getByLabel('Seu nome').fill('Admin E2E');
    await page.getByLabel('E-mail').fill(adminEmail);
    await page.getByLabel('Senha').fill('supersecret1');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Criar minha oficina' }).click();

    await expect(page).toHaveURL(/\/users$/);
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible();

    await page.getByRole('button', { name: 'Convidar usuário' }).click();
    await page.getByLabel('Nome').fill('Mecânico E2E');
    await page.getByLabel('E-mail').fill(mechanicEmail);
    await page.getByRole('button', { name: 'Enviar convite' }).click();

    const toastLocator = page.getByText(/\/invite\//);
    await expect(toastLocator).toBeVisible({ timeout: 10_000 });
    const toastText = await toastLocator.textContent();
    const inviteUrl = toastText?.match(/https?:\/\/\S+\/invite\/\S+/)?.[0];
    expect(inviteUrl).toBeTruthy();
    const inviteToken = inviteUrl!.split('/invite/')[1];

    await page.goto(`/convite/${inviteToken}`);
    await page.getByLabel('Crie sua senha').fill('supersecret1');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Ativar minha conta' }).click();
    await expect(page).toHaveURL(/\/users$/);

    // "Desloga" limpando o storage e loga como o mecânico convidado.
    await context.clearCookies();
    await page.evaluate(() => window.localStorage.clear());
    await page.goto('/entrar');
    await page.getByLabel('E-mail').fill(mechanicEmail);
    await page.getByLabel('Senha').fill('supersecret1');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Mecânico não é ADMIN/MANAGER — RBAC bloqueia o acesso a /users.
    await expect(page.getByText('Você não tem permissão para acessar esta página.')).toBeVisible();
  });
});
