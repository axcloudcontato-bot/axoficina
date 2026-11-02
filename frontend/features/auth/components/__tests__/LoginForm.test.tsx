import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from '../LoginForm';
import { authApi } from '../../api/auth-api';

vi.mock('../../api/auth-api', () => ({
  authApi: { login: vi.fn(), googleLogin: vi.fn(), googleSignup: vi.fn() },
}));

vi.mock('../GoogleButton', () => ({
  GoogleButton: ({ onCredential }: { onCredential: (value: string) => void }) => <button type="button" onClick={() => onCredential('google-id-token')}>Continuar com Google</button>,
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

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new Google account after legal acceptance and opens workshop setup', async () => {
    vi.mocked(authApi.googleLogin).mockRejectedValue({ isAxiosError: true, response: { data: { error: { code: 'USER_NOT_FOUND' } } } });
    vi.mocked(authApi.googleSignup).mockResolvedValue(validLoginResponse as never);
    const user = userEvent.setup();
    renderWithClient(<LoginForm />);
    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));
    expect(await screen.findByRole('dialog', { name: 'Criar conta com Google' })).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalledWith('/cadastro');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(authApi.googleSignup).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(authApi.googleSignup).toHaveBeenCalledWith({ credential: 'google-id-token', acceptedTerms: true, legalVersion: expect.any(String) }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/primeiros-passos'));
  });

  it('shows validation errors when submitted empty', async () => {
    const user = userEvent.setup();
    renderWithClient(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByText(/informe um e-mail válido/i)).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  const validLoginResponse = {
    accessToken: 'access',
    refreshToken: 'refresh',
    user: {
      id: '1',
      tenantId: 't1',
      email: 'admin@test.com',
      name: 'Admin',
      role: 'ADMIN' as const,
      status: 'active' as const,
      createdAt: '2026-01-01T00:00:00Z',
    },
  };

  it('shows a loading state while submitting', async () => {
    let resolveLogin: (value: Awaited<ReturnType<typeof authApi.login>>) => void = () => {};
    vi.mocked(authApi.login).mockReturnValue(new Promise((resolve) => (resolveLogin = resolve)));

    const user = userEvent.setup();
    renderWithClient(<LoginForm />);

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@test.com');
    await user.type(screen.getByLabelText(/senha/i), 'supersecret1');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByRole('button', { name: /entrando/i })).toBeDisabled();

    resolveLogin(validLoginResponse);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/painel'));
  });

  it('redirects on success', async () => {
    vi.mocked(authApi.login).mockResolvedValue(validLoginResponse);

    const user = userEvent.setup();
    renderWithClient(<LoginForm />);

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@test.com');
    await user.type(screen.getByLabelText(/senha/i), 'supersecret1');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/painel'));
  });

  it('shows a generic error toast for invalid credentials', async () => {
    vi.mocked(authApi.login).mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: { message: 'E-mail ou senha inválidos.' } } },
    });

    const user = userEvent.setup();
    renderWithClient(<LoginForm />);

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@test.com');
    await user.type(screen.getByLabelText(/senha/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('E-mail ou senha inválidos.'));
    expect(pushMock).not.toHaveBeenCalled();
  });
});
