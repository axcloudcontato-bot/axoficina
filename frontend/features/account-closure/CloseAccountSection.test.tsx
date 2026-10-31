import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloseAccountSection } from './CloseAccountSection';

const mocks = vi.hoisted(() => ({
  settings: { data: { company: { name: 'Oficina Boa' } } } as { data?: { company: { name: string } } },
  close: vi.fn(),
  replace: vi.fn(),
  logout: vi.fn(),
  clear: vi.fn(),
}));
vi.mock('@/features/settings/hooks/use-settings', () => ({ useSettings: () => mocks.settings }));
vi.mock('./use-account-closure', () => ({ useCloseOwnAccount: () => ({ mutateAsync: mocks.close, isPending: false }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ clear: mocks.clear }) }));
vi.mock('@/stores/auth-store', () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ logout: mocks.logout }) }));

describe('CloseAccountSection', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.settings = { data: { company: { name: 'Oficina Boa' } } }; });
  afterEach(() => { vi.useRealTimers(); });

  it('stays out of the way until the workshop name is known', () => {
    mocks.settings = {};
    const { container } = render(<CloseAccountSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('explains the 30 days and asks for the name and the password before it lets the account be closed', async () => {
    const user = userEvent.setup();
    render(<CloseAccountSection />);
    expect(screen.getByText(/ficam guardados por 30 dias/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Encerrar a conta' }));
    expect(screen.getAllByRole('button', { name: 'Encerrar a conta' }).at(-1)).toBeDisabled();
    await user.type(screen.getByLabelText(/digite o nome da oficina/i), 'oficina boa');
    expect(screen.getAllByRole('button', { name: 'Encerrar a conta' }).at(-1)).toBeDisabled();
    await user.type(screen.getByLabelText('Sua senha atual'), 'minha-senha');
    expect(screen.getAllByRole('button', { name: 'Encerrar a conta' }).at(-1)).toBeEnabled();
  });

  it('closes, says what happened and signs out a few seconds later', async () => {
    mocks.close.mockResolvedValue({ purgeAfter: '2026-12-01T12:00:00.000Z' });
    const user = userEvent.setup();
    render(<CloseAccountSection />);
    await user.click(screen.getByRole('button', { name: 'Encerrar a conta' }));
    await user.type(screen.getByLabelText(/digite o nome da oficina/i), 'Oficina Boa');
    await user.type(screen.getByLabelText('Sua senha atual'), 'minha-senha');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await user.click(screen.getAllByRole('button', { name: 'Encerrar a conta' }).at(-1)!);
    await waitFor(() => expect(mocks.close).toHaveBeenCalledWith({ password: 'minha-senha', confirmName: 'Oficina Boa' }));
    expect(await screen.findByText(/Os dados ficam guardados até 01\/12\/2026/)).toBeInTheDocument();
    expect(mocks.logout).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(mocks.logout).toHaveBeenCalled();
    expect(mocks.clear).toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith('/');
  });

  it('keeps the dialog open and shows why when the account cannot be closed', async () => {
    mocks.close.mockRejectedValue(new Error('x'));
    const user = userEvent.setup();
    render(<CloseAccountSection />);
    await user.click(screen.getByRole('button', { name: 'Encerrar a conta' }));
    await user.type(screen.getByLabelText(/digite o nome da oficina/i), 'Oficina Boa');
    await user.type(screen.getByLabelText('Sua senha atual'), 'senha-errada');
    await user.click(screen.getAllByRole('button', { name: 'Encerrar a conta' }).at(-1)!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível encerrar a conta agora.');
    expect(mocks.logout).not.toHaveBeenCalled();
  });
});
