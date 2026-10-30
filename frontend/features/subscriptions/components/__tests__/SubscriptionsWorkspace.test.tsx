import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionsWorkspace } from '../SubscriptionsWorkspace';

const mocks = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn(), save: vi.fn() }));
vi.mock('../../hooks/use-subscriptions', () => ({
  useSaasAdminAccess: () => mocks.access(),
  useSubscriptions: (...args: unknown[]) => mocks.list(...args),
  useUpdateSubscription: () => ({ mutateAsync: mocks.save, isPending: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const row = {
  id: 'tenant-a', name: 'Oficina Exemplo', document: '12345678000199', email: null,
  plan: 'profissional', extraModules: [], subscriptionStatus: 'active', subscriptionAmountCents: 15990,
  subscriptionCycle: 'monthly', subscriptionDueAt: '2026-11-10T12:00:00.000Z',
  subscriptionNotes: null, createdAt: '2026-10-25T12:00:00.000Z', updatedAt: null,
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
});
