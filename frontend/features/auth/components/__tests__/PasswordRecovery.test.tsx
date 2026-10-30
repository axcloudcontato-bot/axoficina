import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';
import { ForgotPasswordForm } from '../ForgotPasswordForm';
import { ResetPasswordForm } from '../ResetPasswordForm';
import { MyAccount } from '../MyAccount';

const mocks = vi.hoisted(() => ({ sessions: [] as unknown[], revoke: vi.fn(), revokeOthers: vi.fn(), forgot: vi.fn(), reset: vi.fn(), change: vi.fn(), resetState: { isSuccess: false, isError: false, error: null as unknown } }));
vi.mock('../../hooks/use-auth', () => ({
  useForgotPassword: () => ({ mutate: mocks.forgot, isPending: false, isError: false }),
  useResetPassword: () => ({ mutate: mocks.reset, isPending: false, ...mocks.resetState }),
  useChangePassword: () => ({ mutate: mocks.change, isPending: false }),
  useSessions: () => ({ data: { items: mocks.sessions }, isLoading: false, isError: false, refetch: vi.fn() }),
  useRevokeSession: () => ({ mutate: mocks.revoke, isPending: false }),
  useRevokeOtherSessions: () => ({ mutate: mocks.revokeOthers, isPending: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('password recovery', () => {
  beforeEach(() => { mocks.sessions = []; mocks.revoke.mockReset(); mocks.revokeOthers.mockReset(); mocks.forgot.mockReset(); mocks.reset.mockReset(); mocks.change.mockReset(); mocks.resetState = { isSuccess: false, isError: false, error: null }; });

  it('asks for the e-mail and answers the same whether the account exists or not', async () => {
    mocks.forgot.mockImplementation((_request, options) => options.onSuccess());
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText('E-mail da sua conta'), 'ana@oficina.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(mocks.forgot).toHaveBeenCalledWith({ email: 'ana@oficina.com' }, expect.anything());
    expect(screen.getByRole('status')).toHaveTextContent('Se ana@oficina.com tiver uma conta ativa');
    expect(screen.getByRole('status')).toHaveTextContent('gera um link de nova senha');
  });

  it('only sends a new password that is long enough and typed twice the same', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token="abc" />);
    await user.type(screen.getByLabelText('Nova senha'), 'curta');
    await user.click(screen.getByRole('button', { name: 'Criar nova senha' }));
    expect(screen.getByRole('alert')).toHaveTextContent('pelo menos');
    await user.clear(screen.getByLabelText('Nova senha'));
    await user.type(screen.getByLabelText('Nova senha'), 'uma senha comprida');
    await user.type(screen.getByLabelText('Repita a nova senha'), 'outra senha comprida');
    await user.click(screen.getByRole('button', { name: 'Criar nova senha' }));
    expect(screen.getByRole('alert')).toHaveTextContent('não são iguais');
    await user.clear(screen.getByLabelText('Repita a nova senha'));
    await user.type(screen.getByLabelText('Repita a nova senha'), 'uma senha comprida');
    await user.click(screen.getByRole('button', { name: 'Criar nova senha' }));
    expect(mocks.reset).toHaveBeenCalledWith({ token: 'abc', password: 'uma senha comprida' });
  });

  it('offers a new link when the one used expired', () => {
    mocks.resetState = { isSuccess: false, isError: true, error: new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, { data: { error: { message: 'Este link para criar uma nova senha é inválido ou expirou. Peça um novo.' } }, status: 400, statusText: 'Bad Request', headers: {}, config: {} } as never) };
    render(<ResetPasswordForm token="old" />);
    expect(screen.getByRole('alert')).toHaveTextContent('expirou');
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toHaveAttribute('href', '/esqueci-a-senha');
  });

  it('lets anyone change their own password with the current one', async () => {
    useAuthStore.setState({ user: { id: 'u1', tenantId: 't1', name: 'Ana', email: 'ana@oficina.com', role: 'MECHANIC', permissions: [], status: 'active', createdAt: '2026-10-01T00:00:00Z' } as never });
    const user = userEvent.setup();
    render(<MyAccount />);
    expect(screen.getByText('ana@oficina.com')).toBeInTheDocument();
    expect(screen.getByText('Mecânico')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Senha atual'), 'senha antiga');
    await user.type(screen.getByLabelText('Nova senha'), 'senha nova comprida');
    await user.type(screen.getByLabelText('Repita a nova senha'), 'senha nova comprida');
    await user.click(screen.getByRole('button', { name: 'Trocar senha' }));
    expect(mocks.change).toHaveBeenCalledWith({ currentPassword: 'senha antiga', newPassword: 'senha nova comprida' }, expect.anything());
  });

  it('lists the devices signed in, marks this one and lets the others be closed', async () => {
    useAuthStore.setState({ user: { id: 'u1', tenantId: 't1', name: 'Ana', email: 'ana@oficina.com', role: 'ADMIN', permissions: [], status: 'active', createdAt: '2026-10-01T00:00:00Z' } as never });
    mocks.sessions = [
      { id: 's1', device: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36', lastActiveAt: '2026-10-30T12:00:00Z', expiresAt: '2026-11-06T12:00:00Z', current: true },
      { id: 's2', device: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604.1', lastActiveAt: '2026-10-29T12:00:00Z', expiresAt: '2026-11-05T12:00:00Z', current: false },
    ];
    const user = userEvent.setup();
    render(<MyAccount />);
    expect(screen.getByText('Chrome em Windows')).toBeInTheDocument();
    expect(screen.getByText('Este aparelho')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desconectar Chrome em Windows' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Desconectar Safari em iPhone' }));
    expect(mocks.revoke).toHaveBeenCalledWith('s2', expect.anything());
    await user.click(screen.getByRole('button', { name: 'Sair dos outros aparelhos' }));
    expect(mocks.revokeOthers).toHaveBeenCalled();
  });
});
