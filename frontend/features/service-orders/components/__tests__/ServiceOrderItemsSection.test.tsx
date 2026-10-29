import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceOrderResponse } from '@oficina/contracts';
import { ServiceOrderItemsSection } from '../ServiceOrderItemsSection';
import { serviceOrderItemsApi } from '../../api/service-order-items-api';
import { serviceOrdersApi } from '../../api/service-orders-api';

vi.mock('../../api/service-orders-api', () => ({ serviceOrdersApi: { update: vi.fn() } }));
vi.mock('../../api/service-order-items-api', () => ({
  serviceOrderItemsApi: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: toastMock }));

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const baseServiceOrder: ServiceOrderResponse = {
  id: 'so-1',
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
  openedAt: '2026-07-01T00:00:00Z',
  createdAt: '2026-07-01T00:00:00Z',
  totalAmountCents: 13000, discountCents: 0,
  receivedAmountCents: 0,
  outstandingAmountCents: 13000,
  paymentStatus: 'AWAITING_PAYMENT',
  items: [
    {
      id: 'item-1',
      serviceOrderId: 'so-1',
      type: 'PART',
      description: 'Filtro de óleo',
      quantity: 2,
      unitPriceCents: 5000,
      lineTotalCents: 10000,
      createdAt: '2026-07-01T00:00:00Z',
    },
    {
      id: 'item-2',
      serviceOrderId: 'so-1',
      type: 'LABOR',
      description: 'Troca de óleo',
      quantity: 1,
      unitPriceCents: 3000,
      lineTotalCents: 3000,
      createdAt: '2026-07-01T00:00:00Z',
    },
  ],
};

describe('ServiceOrderItemsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders existing items and the total', () => {
    renderWithClient(<ServiceOrderItemsSection serviceOrder={baseServiceOrder} />);

    expect(screen.getByText('Filtro de óleo')).toBeInTheDocument();
    expect(screen.getByText('Troca de óleo')).toBeInTheDocument();
    expect(screen.getByText('R$ 130,00')).toBeInTheDocument();
  });

  it('shows an empty state when there are no items', () => {
    renderWithClient(<ServiceOrderItemsSection serviceOrder={{ ...baseServiceOrder, items: [], totalAmountCents: 0 }} />);

    expect(screen.getByText(/nenhum item lançado ainda/i)).toBeInTheDocument();
  });

  it('adds an item and clears the form on success', async () => {
    vi.mocked(serviceOrderItemsApi.create).mockResolvedValue({
      item: {
        id: 'item-3',
        serviceOrderId: 'so-1',
        type: 'PART',
        description: 'Pastilha de freio',
        quantity: 1,
        unitPriceCents: 12000,
        lineTotalCents: 12000,
        createdAt: '2026-07-01T00:00:00Z',
      },
    });
    const user = userEvent.setup();
    renderWithClient(<ServiceOrderItemsSection serviceOrder={baseServiceOrder} />);

    await user.type(screen.getByPlaceholderText('Descrição'), 'Pastilha de freio');
    await user.clear(screen.getByPlaceholderText('Qtd.'));
    await user.type(screen.getByPlaceholderText('Qtd.'), '1');
    await user.type(screen.getByPlaceholderText('Valor unit. (R$)'), '120');
    await user.click(screen.getByRole('button', { name: /adicionar item/i }));

    await waitFor(() =>
      expect(serviceOrderItemsApi.create).toHaveBeenCalledWith({
        serviceOrderId: 'so-1',
        type: 'PART',
        description: 'Pastilha de freio',
        quantity: 1,
        unitPriceCents: 12000,
      }),
    );
    await waitFor(() => expect(screen.getByPlaceholderText('Descrição')).toHaveValue(''));
  });

  it('edits an item and calls the update mutation with the recalculated values', async () => {
    vi.mocked(serviceOrderItemsApi.update).mockResolvedValue({
      item: { ...baseServiceOrder.items![0], quantity: 3, lineTotalCents: 15000 },
    });
    const user = userEvent.setup();
    renderWithClient(<ServiceOrderItemsSection serviceOrder={baseServiceOrder} />);

    const [editButton] = screen.getAllByRole('button', { name: /editar/i });
    await user.click(editButton);

    const quantityInput = screen.getAllByLabelText('Quantidade').find((input) => input.getAttribute('value') === '2')!;
    await user.clear(quantityInput);
    await user.type(quantityInput, '3');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(serviceOrderItemsApi.update).toHaveBeenCalledWith({
        id: 'item-1',
        type: 'PART',
        description: 'Filtro de óleo',
        quantity: 3,
        unitPriceCents: 5000,
      }),
    );
    await waitFor(() => expect(screen.getAllByLabelText('Quantidade')).toHaveLength(1));
  });

  it('cancelling an edit discards changes without calling the update mutation', async () => {
    const user = userEvent.setup();
    renderWithClient(<ServiceOrderItemsSection serviceOrder={baseServiceOrder} />);

    const [editButton] = screen.getAllByRole('button', { name: /editar/i });
    await user.click(editButton);
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(serviceOrderItemsApi.update).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText('Quantidade')).toHaveLength(1);
  });

  it('removing an item calls the delete mutation', async () => {
    vi.mocked(serviceOrderItemsApi.delete).mockResolvedValue({ item: baseServiceOrder.items![0] });
    const user = userEvent.setup();
    renderWithClient(<ServiceOrderItemsSection serviceOrder={baseServiceOrder} />);

    const [removeButton] = screen.getAllByRole('button', { name: /remover/i });
    await user.click(removeButton);

    await waitFor(() => expect(serviceOrderItemsApi.delete).toHaveBeenCalledWith({ id: 'item-1' }));
  });

  it('on a delivered order asks for a written reason before any change and sends it along', async () => {
    vi.mocked(serviceOrderItemsApi.delete).mockResolvedValue({ item: baseServiceOrder.items![0] });
    const user = userEvent.setup();
    renderWithClient(<ServiceOrderItemsSection serviceOrder={{ ...baseServiceOrder, status: 'DELIVERED' }} />);

    const [removeButton] = screen.getAllByRole('button', { name: /remover/i });
    await user.click(removeButton);
    expect(serviceOrderItemsApi.delete).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith('Informe o motivo da correção (mínimo 5 caracteres).');

    await user.type(screen.getByLabelText('Motivo da correção'), 'Item lançado em duplicidade');
    await user.click(removeButton);
    await waitFor(() => expect(serviceOrderItemsApi.delete).toHaveBeenCalledWith({ id: 'item-1', editReason: 'Item lançado em duplicidade' }));
  });

  it('does not show the reason field while the order is still open', () => {
    renderWithClient(<ServiceOrderItemsSection serviceOrder={baseServiceOrder} />);
    expect(screen.queryByLabelText('Motivo da correção')).not.toBeInTheDocument();
  });

  it('shows subtotal, discount and net total, and applies a typed discount', async () => {
    vi.mocked(serviceOrdersApi.update).mockResolvedValue({ serviceOrder: baseServiceOrder });
    const user = userEvent.setup();
    renderWithClient(<ServiceOrderItemsSection serviceOrder={{ ...baseServiceOrder, discountCents: 1500, totalAmountCents: 11500 }} />);

    expect(screen.getByText('Subtotal dos itens')).toBeInTheDocument();
    expect(screen.getByText('-R$ 15,00')).toBeInTheDocument();
    const input = screen.getByLabelText('Desconto');
    expect(input).toHaveValue('15.00');
    await user.clear(input);
    await user.type(input, '20,50');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(serviceOrdersApi.update).toHaveBeenCalledWith({ id: 'so-1', discountCents: 2050 }));
  });

  it('refuses a discount above the items total without calling the API', async () => {
    const user = userEvent.setup();
    renderWithClient(<ServiceOrderItemsSection serviceOrder={baseServiceOrder} />);
    await user.type(screen.getByLabelText('Desconto'), '999');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(serviceOrdersApi.update).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith('O desconto não pode ser maior que o total dos itens.');
  });
});

