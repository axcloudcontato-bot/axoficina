import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupForm } from '../SignupForm';
import { authApi } from '../../api/auth-api';

vi.mock('../../api/auth-api', () => ({
  authApi: { signup: vi.fn() },
}));

// vi.mock() é hoisted acima dos imports — variáveis fechadas pela factory
// precisam ser criadas via vi.hoisted() para não caírem em TDZ.
const { pushMock, toastMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: toastMock }));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const validUser = {
  id: '1',
  tenantId: 't1',
  email: 'admin@test.com',
  name: 'Admin',
  role: 'ADMIN' as const,
  status: 'active' as const,
  createdAt: '2026-01-01T00:00:00Z',
};

const validTenant = {
  id: 't1',
  name: 'Oficina Teste',
  document: '11444777000161',
  plan: 'free',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
};

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/nome da oficina/i), 'Oficina Teste');
  await user.type(screen.getByLabelText(/cpf ou cnpj/i), '11444777000161');
  await user.type(screen.getByLabelText(/seu nome/i), 'Admin');
  await user.type(screen.getByLabelText(/^e-mail$/i), 'admin@test.com');
  await user.type(screen.getByLabelText(/^senha$/i), 'supersecret1');
  await user.click(screen.getByRole('checkbox'));
}

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires an unchecked-by-default acceptance even when account data is valid', async () => {
    const user = userEvent.setup();
    renderWithClient(<SignupForm />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    await fillValidForm(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /criar minha oficina/i }));
    expect(await screen.findByText(/aceite os termos de uso para continuar/i)).toBeInTheDocument();
    expect(authApi.signup).not.toHaveBeenCalled();
  });

  it('shows field validation errors when submitted empty', async () => {
    const user = userEvent.setup();
    renderWithClient(<SignupForm />);

    await user.click(screen.getByRole('button', { name: /criar minha oficina/i }));

    expect(await screen.findByText(/informe o nome da oficina/i)).toBeInTheDocument();
    expect(authApi.signup).not.toHaveBeenCalled();
  });

  it('shows a loading state while submitting', async () => {
    let resolveSignup: (value: Awaited<ReturnType<typeof authApi.signup>>) => void = () => {};
    vi.mocked(authApi.signup).mockReturnValue(new Promise((resolve) => (resolveSignup = resolve)));

    const user = userEvent.setup();
    renderWithClient(<SignupForm />);
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: /criar minha oficina/i }));

    expect(await screen.findByRole('button', { name: /criando oficina/i })).toBeDisabled();

    resolveSignup({ accessToken: 'access', refreshToken: 'refresh', user: validUser, tenant: validTenant });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/usuarios'));
  });

  it('redirects and shows a success toast', async () => {
    vi.mocked(authApi.signup).mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      user: validUser,
      tenant: validTenant,
    });

    const user = userEvent.setup();
    renderWithClient(<SignupForm />);
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: /criar minha oficina/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/usuarios'));
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('shows a generic server error toast when the backend rejects without field details', async () => {
    vi.mocked(authApi.signup).mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: { message: 'Já existe uma oficina cadastrada com este documento.' } } },
    });

    const user = userEvent.setup();
    renderWithClient(<SignupForm />);
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: /criar minha oficina/i }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith('Já existe uma oficina cadastrada com este documento.'),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
