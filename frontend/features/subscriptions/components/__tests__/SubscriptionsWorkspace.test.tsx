import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionsWorkspace } from '../SubscriptionsWorkspace';

const mocks = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn(), save: vi.fn(), close: vi.fn(), restore: vi.fn(), purge: vi.fn() }));
vi.mock('../../hooks/use-subscriptions', () => ({
  useSaasAdminAccess: () => mocks.access(),
  useSubscriptions: (...args: unknown[]) => mocks.list(...args),
  useUpdateSubscription: () => ({ mutateAsync: mocks.save, isPending: false }),
}));
vi.mock('@/features/account-closure/use-account-closure', () => ({
  useAdminClose: () => ({ mutateAsync: mocks.close, isPending: false }),
  useAdminRestore: () => ({ mutateAsync: mocks.restore, isPending: false }),
  useAdminPurge: () => ({ mutateAsync: mocks.purge, isPending: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const row = {
  id: 'tenant-a', name: 'Oficina Exemplo', document: '12345678000199', email: null,
  plan: 'profissional', extraModules: [], subscriptionStatus: 'active', subscriptionAmountCents: 15990,
  subscriptionCycle: 'monthly', subscriptionDueAt: '2026-11-10T12:00:00.000Z',
  subscriptionNotes: null, closedAt: null, purgeAfter: null, closedBy: null, closureReason: null, createdAt: '2026-10-25T12:00:00.000Z', updatedAt: null,
};

describe('Global subscription management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockReturnValue({ data: { allowed: true }, isPending: false });
    mocks.list.mockReturnValue({ data: { items: [row], total: 1, summary: { total: 4, active: 1, trial: 2, pastDue: 1, mrrCents: 14990 } }, isPending: false, isFetching: false });
    mocks.save.mockResolvedValue(row);
  });

  it('does not show global data or enable fetching to an unauthorized tenant admin', () => {
    mocks.access.mockReturnValue({ data: { allowed: false }, isPending: false });
    render(<SubscriptionsWorkspace />);
    expect(screen.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible();
    expect(screen.queryByText('Oficina Exemplo')).not.toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledWith(expect.anything(), false);
  });

  it('renders real totals, filters by status, and searches after debounce', async () => {
    const user = userEvent.setup();
    render(<SubscriptionsWorkspace />);
    expect(screen.getByText('Oficina Exemplo')).toBeVisible();
    expect(screen.getByText('10/11/2026')).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Situação'), 'past_due');
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'past_due', offset: 0 }), true);
    await user.type(screen.getByRole('textbox', { name: 'Buscar oficina, documento ou e-mail' }), 'Exemplo');
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Exemplo' }), true));
  });

  it('saves Brazilian currency in integer cents and sends the annual amount and current version', async () => {
    const user = userEvent.setup();
    render(<SubscriptionsWorkspace />);
    await user.click(screen.getByRole('button', { name: 'Gerenciar assinatura de Oficina Exemplo' }));
    const amount = screen.getByLabelText('Valor por período (R$)');
    await user.clear(amount); await user.type(amount, '1200,50');
    await user.selectOptions(screen.getByLabelText('Periodicidade'), 'yearly');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ id: row.id, input: expect.objectContaining({ subscriptionAmountCents: 120050, subscriptionCycle: 'yearly', expectedUpdatedAt: null }) }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('fills in the price of the chosen plan and sells a module on top of it', async () => {
    const user = userEvent.setup();
    render(<SubscriptionsWorkspace />);
    await user.click(screen.getByRole('button', { name: 'Gerenciar assinatura de Oficina Exemplo' }));
    await user.selectOptions(screen.getByLabelText('Plano'), 'essencial');
    expect(screen.getByLabelText('Valor por período (R$)')).toHaveValue('129,90');
    await user.click(screen.getByRole('checkbox', { name: 'WhatsApp' }));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ id: row.id, input: expect.objectContaining({ plan: 'essencial', extraModules: ['whatsapp'], subscriptionAmountCents: 12990 }) }));
  });

  it('keeps a negotiated price when the plan changes', async () => {
    const user = userEvent.setup();
    render(<SubscriptionsWorkspace />);
    await user.click(screen.getByRole('button', { name: 'Gerenciar assinatura de Oficina Exemplo' }));
    const amount = screen.getByLabelText('Valor por período (R$)');
    await user.clear(amount); await user.type(amount, '140,00');
    await user.selectOptions(screen.getByLabelText('Plano'), 'completo');
    expect(amount).toHaveValue('140,00');
  });

  it('keeps the dialog open when saving fails and rejects invalid amounts', async () => {
    const user = userEvent.setup();
    render(<SubscriptionsWorkspace />);
    await user.click(screen.getByRole('button', { name: 'Gerenciar assinatura de Oficina Exemplo' }));
    const amount = screen.getByLabelText('Valor por período (R$)');
    await user.clear(amount); await user.type(amount, '-20');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um valor');
    expect(mocks.save).not.toHaveBeenCalled();
    await user.clear(amount); await user.type(amount, '149,90');
    mocks.save.mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar'));
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  describe('closing and erasing workshops', () => {
    const closedRow = { ...row, id: 'tenant-closed', name: 'Oficina Encerrada', closedAt: '2026-10-20T12:00:00.000Z', purgeAfter: '2026-11-19T12:00:00.000Z', closedBy: 'owner', closureReason: null };

    it('asks for the workshop name and a reason before the manager closes a workshop', async () => {
      mocks.close.mockResolvedValue({ purgeAfter: '2026-12-01T12:00:00.000Z' });
      const user = userEvent.setup();
      render(<SubscriptionsWorkspace />);
      await user.click(screen.getByRole('button', { name: 'Encerrar a oficina Oficina Exemplo' }));
      const confirm = screen.getByRole('button', { name: 'Encerrar a oficina' });
      expect(confirm).toBeDisabled();
      await user.type(screen.getByLabelText('Motivo (fica no registro)'), 'Pediu para sair');
      await user.type(screen.getByLabelText(/digite o nome da oficina/i), 'oficina exemplo');
      expect(confirm).toBeEnabled();
      await user.click(confirm);
      await waitFor(() => expect(mocks.close).toHaveBeenCalledWith({ id: row.id, input: { reason: 'Pediu para sair' } }));
    });

    it('lists the closed workshops on their own tab, with the days left', async () => {
      mocks.list.mockImplementation((query: { scope?: string }) => ({ data: { items: query.scope === 'closed' ? [closedRow] : [row], total: 1, summary: { total: 4, active: 1, trial: 2, pastDue: 1, mrrCents: 14990 } }, isPending: false, isFetching: false }));
      const user = userEvent.setup();
      render(<SubscriptionsWorkspace />);
      await user.click(screen.getByRole('tab', { name: 'Encerradas' }));
      expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'closed' }), true);
      expect(screen.getByText('Oficina Encerrada')).toBeInTheDocument();
      expect(screen.getByText('O próprio cliente')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Restaurar Oficina Encerrada' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Gerenciar assinatura/ })).not.toBeInTheDocument();
    });

    it('restores after a confirmation, and erases for good only when the name is typed', async () => {
      mocks.list.mockImplementation((query: { scope?: string }) => ({ data: { items: query.scope === 'closed' ? [closedRow] : [row], total: 1, summary: { total: 4, active: 1, trial: 2, pastDue: 1, mrrCents: 14990 } }, isPending: false, isFetching: false }));
      mocks.restore.mockResolvedValue(undefined);
      mocks.purge.mockResolvedValue(undefined);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const user = userEvent.setup();
      render(<SubscriptionsWorkspace />);
      await user.click(screen.getByRole('tab', { name: 'Encerradas' }));
      await user.click(screen.getByRole('button', { name: 'Restaurar Oficina Encerrada' }));
      await waitFor(() => expect(mocks.restore).toHaveBeenCalledWith('tenant-closed'));

      await user.click(screen.getByRole('button', { name: 'Apagar Oficina Encerrada de vez' }));
      const erase = screen.getAllByRole('button', { name: 'Apagar de vez' }).at(-1)!;
      expect(erase).toBeDisabled();
      await user.type(screen.getByLabelText(/digite o nome da oficina/i), 'Oficina Errada');
      expect(erase).toBeDisabled();
      await user.clear(screen.getByLabelText(/digite o nome da oficina/i));
      await user.type(screen.getByLabelText(/digite o nome da oficina/i), 'Oficina Encerrada');
      await user.click(erase);
      await waitFor(() => expect(mocks.purge).toHaveBeenCalledWith({ id: 'tenant-closed', input: { confirmName: 'Oficina Encerrada' } }));
    });

    it('says there is nothing closed when the list is empty', async () => {
      mocks.list.mockImplementation((query: { scope?: string }) => ({ data: { items: query.scope === 'closed' ? [] : [row], total: 0, summary: { total: 4, active: 1, trial: 2, pastDue: 1, mrrCents: 14990 } }, isPending: false, isFetching: false }));
      const user = userEvent.setup();
      render(<SubscriptionsWorkspace />);
      await user.click(screen.getByRole('tab', { name: 'Encerradas' }));
      expect(screen.getByRole('heading', { name: 'Nenhuma oficina encerrada' })).toBeInTheDocument();
    });
  });
});
