import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ServiceOrderListItemResponse } from '@oficina/contracts';
import { ServiceOrdersTable } from '../ServiceOrdersTable';

const serviceOrder: ServiceOrderListItemResponse = {
  id: 'so1',
  tenantId: 't1',
  orderNumber: 1,
  customerId: 'c1',
  customerName: 'João da Silva',
  customerPhone: '11999999999',
  vehicleId: 'v1',
  vehicleBrand: 'Fiat',
  vehicleModel: 'Uno',
  vehiclePlate: 'ABC1D23',
  status: 'OPEN',
  technicianId: undefined,
  technicianName: undefined,
  openedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  totalAmountCents: 15000, discountCents: 0,
  receivedAmountCents: 0,
  outstandingAmountCents: 15000,
  paymentStatus: 'AWAITING_PAYMENT',
};

function noop() {}

describe('ServiceOrdersTable', () => {
  it('shows a loading state', () => {
    render(<ServiceOrdersTable items={[]} isLoading isError={false} onRetry={noop} />);
    expect(screen.getByRole('status', { name: /carregando ordens de serviço/i })).toBeInTheDocument();
  });

  it('shows an error state with a retry button', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ServiceOrdersTable items={[]} isLoading={false} isError onRetry={onRetry} />);

    expect(screen.getByText(/não foi possível carregar as ordens de serviço/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows an empty state', () => {
    render(<ServiceOrdersTable items={[]} isLoading={false} isError={false} onRetry={noop} />);
    expect(screen.getByText(/nenhuma ordem de serviço ainda/i)).toBeInTheDocument();
  });

  it('renders service order rows with vehicle, customer, technician fallback and status', () => {
    render(<ServiceOrdersTable items={[serviceOrder]} isLoading={false} isError={false} onRetry={noop} />);

    expect(screen.getByRole('link', { name: /Fiat Uno ABC1D23/ })).toBeInTheDocument();
    expect(screen.getByText('João da Silva')).toBeInTheDocument();
    expect(screen.getByText('Sem técnico')).toBeInTheDocument();
    expect(screen.getByText('Aberta')).toBeInTheDocument();
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument();
  });

  it('links each row to its detail page', () => {
    render(<ServiceOrdersTable items={[serviceOrder]} isLoading={false} isError={false} onRetry={noop} />);

    expect(screen.getByRole('link', { name: /Fiat Uno ABC1D23/ })).toHaveAttribute('href', '/ordens-de-servico/so1');
  });
});
