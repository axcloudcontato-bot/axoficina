import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceList } from './InvoiceList';
import { PlanSwitcher } from './PlanSwitcher';

const mocks = vi.hoisted(() => ({
  billing: {} as Record<string, unknown>,
  subscription: {} as Record<string, unknown>,
  invoices: [] as unknown[],
  checkout: vi.fn(),
  cancel: vi.fn(),
  portal: vi.fn(),
}));
vi.mock('./use-billing', () => ({
  useBillingStatus: () => ({ data: mocks.billing, isLoading: false, isError: false }),
  useBillingInvoices: () => ({ data: { items: mocks.invoices }, isLoading: false, isError: false }),
  useCheckout: () => ({ mutateAsync: mocks.checkout, isPending: false }),
  useCancelSubscription: () => ({ mutateAsync: mocks.cancel, isPending: false }),
  usePaymentPortal: () => ({ mutateAsync: mocks.portal, isPending: false }),
}));
vi.mock('@/features/settings/hooks/use-settings', () => ({ useWorkshopSubscription: () => ({ data: mocks.subscription, isLoading: false }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('PlanSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.billing = { enabled: true, hasSubscription: false, hasCustomer: false, pendingPlan: null };
    mocks.subscription = { plan: 'completo', status: 'trial', cycle: 'monthly' };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('shows the three plans with their prices and the year as ten months', async () => {
    const user = userEvent.setup();
    render(<PlanSwitcher />);
    expect(screen.getByText(/129,90/)).toBeInTheDocument();
    expect(screen.getByText(/159,90/)).toBeInTheDocument();
    expect(screen.getByText(/199,90/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Anual/ }));
    expect(screen.getByText(/1\.299,00/)).toBeInTheDocument();
  });

  it('sends the chosen plan and period, then goes to the payment page', async () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...window.location, assign }, writable: true });
    mocks.checkout.mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/c/pay/abc', appliedNow: false });
    const user = userEvent.setup();
    render(<PlanSwitcher />);
    await user.click(screen.getByRole('button', { name: 'Contratar Profissional' }));
    await waitFor(() => expect(mocks.checkout).toHaveBeenCalledWith({ plan: 'profissional', cycle: 'monthly' }));
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/abc');
  });

  it('never follows a payment link that is not an Stripe page', async () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...window.location, assign }, writable: true });
    mocks.checkout.mockResolvedValue({ checkoutUrl: 'https://evil.example/pay', appliedNow: false });
    const user = userEvent.setup();
    render(<PlanSwitcher />);
    await user.click(screen.getByRole('button', { name: 'Contratar Essencial' }));
    await waitFor(() => expect(mocks.checkout).toHaveBeenCalled());
    expect(assign).not.toHaveBeenCalled();
  });

  it('asks before changing a paid subscription and marks the current plan', async () => {
    mocks.billing = { enabled: true, hasSubscription: true, hasCustomer: true, pendingPlan: null };
    mocks.subscription = { plan: 'profissional', status: 'active', cycle: 'monthly' };
    mocks.checkout.mockResolvedValue({ checkoutUrl: null, appliedNow: true });
    const user = userEvent.setup();
    render(<PlanSwitcher />);
    expect(screen.getByRole('button', { name: 'Plano atual' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Mudar para Completo' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('vale agora'));
    await waitFor(() => expect(mocks.checkout).toHaveBeenCalledWith({ plan: 'completo', cycle: 'monthly' }));
  });

  it('does not change anything when the confirmation is declined', async () => {
    mocks.billing = { enabled: true, hasSubscription: true, hasCustomer: true, pendingPlan: null };
    mocks.subscription = { plan: 'completo', status: 'active', cycle: 'monthly' };
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<PlanSwitcher />);
    await user.click(screen.getByRole('button', { name: 'Mudar para Essencial' }));
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it('announces a downgrade waiting for the next payment and cancels on confirmation', async () => {
    mocks.billing = { enabled: true, hasSubscription: true, hasCustomer: true, pendingPlan: 'essencial' };
    mocks.subscription = { plan: 'completo', status: 'active', cycle: 'monthly' };
    mocks.cancel.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<PlanSwitcher />);
    expect(screen.getByRole('status')).toHaveTextContent('Essencial agendada');
    await user.click(screen.getByRole('button', { name: 'Cancelar assinatura' }));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalled());
  });

  it('opens the Stripe page to update the card and see receipts', async () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...window.location, assign }, writable: true });
    mocks.billing = { enabled: true, hasSubscription: true, hasCustomer: true, pendingPlan: null };
    mocks.portal.mockResolvedValue({ url: 'https://billing.stripe.com/p/session/abc' });
    const user = userEvent.setup();
    render(<PlanSwitcher />);
    await user.click(screen.getByRole('button', { name: 'Forma de pagamento e recibos' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://billing.stripe.com/p/session/abc'));
  });

  it('sends the workshop to support while automatic billing is off', () => {
    mocks.billing = { enabled: false, hasSubscription: false, hasCustomer: false, pendingPlan: null };
    render(<PlanSwitcher />);
    expect(screen.queryByRole('button', { name: /Contratar/ })).not.toBeInTheDocument();
    expect(screen.getByText(/fale com o suporte do Ofix/)).toBeInTheDocument();
  });
});

describe('InvoiceList', () => {
  beforeEach(() => { mocks.billing = { enabled: true, hasSubscription: true, hasCustomer: true, pendingPlan: null }; });

  it('lists charges with their situation and a link to pay or see the receipt', () => {
    mocks.invoices = [
      { id: 'a', amountCents: 15990, dueDate: '2026-11-30', status: 'pending', paidAt: null, invoiceUrl: 'https://invoice.stripe.com/i/a' },
      { id: 'b', amountCents: 15990, dueDate: '2026-10-30', status: 'paid', paidAt: '2026-10-30T12:00:00.000Z', invoiceUrl: 'https://invoice.stripe.com/i/b' },
    ];
    render(<InvoiceList />);
    expect(screen.getByText('Aguardando pagamento')).toBeInTheDocument();
    expect(screen.getByText('Paga')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pagar/ })).toHaveAttribute('href', 'https://invoice.stripe.com/i/a');
    expect(screen.getByRole('link', { name: /Ver recibo/ })).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('says there is nothing yet, and stays out of the way when billing is off', () => {
    mocks.invoices = [];
    const { container, rerender } = render(<InvoiceList />);
    expect(screen.getByText(/Nenhuma fatura ainda/)).toBeInTheDocument();
    mocks.billing = { enabled: false, hasSubscription: false, hasCustomer: false, pendingPlan: null };
    rerender(<InvoiceList />);
    expect(container).toBeEmptyDOMElement();
  });
});
