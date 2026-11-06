import { expect, test, type Page } from '@playwright/test';

// Ponta a ponta de verdade: precisa do backend rodando com Postgres/Redis migrados e semeados.
// Cada execução precisa do próprio documento: o cadastro recusa um CPF/CNPJ que já tem conta.
function validCpf(seed: number) {
  const digits = String(seed).slice(-9).padStart(9, '1').split('').map(Number);
  for (const size of [9, 10]) {
    const sum = digits.slice(0, size).reduce((total, digit, index) => total + digit * (size + 1 - index), 0);
    digits.push((sum * 10) % 11 % 10);
  }
  return digits.join('');
}
async function next(page: Page) { await page.getByRole('button', { name: 'Avançar', exact: true }).click(); }

test.describe('IAM flow', () => {
  test('signup -> setup -> invite -> accept -> login', async ({ page, context }) => {
    const suffix = Date.now();
    const adminEmail = `admin-${suffix}@e2e-test.example`;
    const mechanicEmail = `mechanic-${suffix}@e2e-test.example`;

    await page.goto('/cadastro');
    await page.getByRole('button', { name: 'Somente necessários', exact: true }).click();
    await page.getByLabel('Nome da oficina').fill(`Oficina E2E ${suffix}`);
    await page.getByLabel('CPF ou CNPJ').fill(validCpf(suffix));
    await page.getByLabel('Seu nome').fill('Admin E2E');
    await page.getByLabel('E-mail').fill(adminEmail);
    await page.getByLabel('Senha').fill('supersecret1');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Criar minha oficina' }).click();

    await expect(page).toHaveURL(/\/primeiros-passos$/);
    await expect(page.getByText('Passo 1 de 6: Sua oficina')).toBeVisible();
    await next(page);
    await expect(page.getByText('Passo 2 de 6: Contato')).toBeVisible();
    await page.getByLabel('Telefone').fill('1133334444');
    await next(page);
    await page.getByLabel(/^Rua/).fill('Rua das Flores');
    await page.getByLabel(/^Cidade/).fill('São Paulo');
    await page.getByLabel(/^UF/).fill('sp');
    await next(page);
    await expect(page.getByText('Passo 4 de 6: Funcionamento')).toBeVisible();
    await next(page);
    await expect(page.getByText('Passo 5 de 6: Documentos')).toBeVisible();
    await next(page);
    await page.getByRole('button', { name: 'Entrar no sistema', exact: true }).click();
    await expect(page).not.toHaveURL(/\/primeiros-passos$/);

    await page.goto('/usuarios');
    await page.getByRole('button', { name: 'Convidar usuário' }).click();
    const invite = page.getByRole('dialog');
    await invite.getByLabel('Nome').fill('Mecânico E2E');
    await invite.getByLabel('E-mail').fill(mechanicEmail);
    await invite.getByRole('button', { name: 'Enviar convite' }).click();

    await expect(page.getByRole('heading', { name: 'Convite criado' })).toBeVisible({ timeout: 10_000 });
    const inviteUrl = await invite.getByRole('textbox').first().inputValue();
    expect(inviteUrl).toContain('/convite/');

    await page.goto(`/convite/${inviteUrl.split('/convite/')[1]}`);
    await page.getByLabel('Crie sua senha').fill('supersecret1');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Ativar minha conta' }).click();
    // Quem não administra a equipe sai de /usuarios para a tela de clientes.
    await expect(page).toHaveURL(/\/clientes$/);

    // "Desloga" limpando o storage e entra como o mecânico convidado.
    await context.clearCookies();
    await page.evaluate(() => window.localStorage.clear());
    await page.goto('/entrar');
    await page.getByLabel('E-mail').fill(mechanicEmail);
    await page.getByLabel('Senha').fill('supersecret1');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).not.toHaveURL(/\/entrar$/);

    await page.goto('/usuarios');
    await expect(page).toHaveURL(/\/clientes$/);
  });
});
