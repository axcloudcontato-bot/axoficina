import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceOrderFormModal } from '../ServiceOrderFormModal';
import { serviceOrdersApi } from '../../api/service-orders-api';
import { vehiclesApi } from '@/features/vehicles/api/vehicles-api';
import { usersApi } from '@/features/users/api/users-api';
import { customersApi } from '@/features/customers/api/customers-api';

vi.mock('../../api/service-orders-api', () => ({
  serviceOrdersApi: { create: vi.fn() },
}));

vi.mock('@/features/vehicles/api/vehicles-api', () => ({
  vehiclesApi: { list: vi.fn() },
}));

vi.mock('@/features/users/api/users-api', () => ({
  usersApi: { list: vi.fn() },
}));

vi.mock('@/features/customers/api/customers-api', () => ({
  customersApi: { list: vi.fn() },
}));

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: toastMock }));

// jsdom não implementa a Pointer Events API que o Radix Select usa —
// polyfill mínimo só pra permitir simular a interação de seleção nos
// testes (mesmo problema conhecido em qualquer projeto Radix + jsdom).
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const vehicle = {
  id: 'v1',
  tenantId: 't1',
  customerId: 'c1',
  customerName: 'João da Silva',
  brand: 'Fiat',
  model: 'Uno',
  plate: 'ABC1D23',
  photos: [],
  createdAt: '2026-01-01T00:00:00Z',
};

const technician = {
  id: 'u1',
  tenantId: 't1',
  email: 'tech@oficina.com',
  name: 'Carlos Mecânico',
  role: 'MECHANIC' as const,
  status: 'active' as const,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('ServiceOrderFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vehiclesApi.list).mockResolvedValue({ items: [vehicle], total: 1, offset: 0, limit: 100, hasMore: false });
    vi.mocked(usersApi.list).mockResolvedValue({ items: [technician], total: 1, offset: 0, limit: 100, hasMore: false });
    vi.mocked(customersApi.list).mockResolvedValue({ items: [{ id: 'c1', tenantId: 't1', type: 'PF', document: '11144477735', name: 'JoÃ£o da Silva', phone: '11999998888', createdAt: '2026-01-01T00:00:00Z' }], total: 1, offset: 0, limit: 20, hasMore: false });
  });

  it('shows the vehicle search field and the technician picker', async () => {
    renderWithClient(<ServiceOrderFormModal open onOpenChange={() => {}} />);

    expect(screen.getAllByRole('combobox')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /abrir os/i })).toBeInTheDocument();
  });

  it('shows a validation error when submitted without a vehicle', async () => {
    const user = userEvent.setup();
    renderWithClient(<ServiceOrderFormModal open onOpenChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: /abrir os/i }));

    expect(await screen.findByText(/selecione um veículo/i)).toBeInTheDocument();
    expect(serviceOrdersApi.create).not.toHaveBeenCalled();
  });

  it('creates a service order with only the required vehicle_id, technician optional', async () => {
    vi.mocked(serviceOrdersApi.create).mockResolvedValue({ serviceOrder: { id: 'so1' } as never });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<ServiceOrderFormModal open onOpenChange={onOpenChange} />);

    const [customerSearchInput, vehicleSearchInput] = screen.getAllByRole('combobox');
    await user.type(customerSearchInput, 'JoÃ£o');
    await user.click(await screen.findByRole('option', { name: /JoÃ£o da Silva/ }));
    await user.type(vehicleSearchInput, 'Uno');
    await user.click(await screen.findByRole('option', { name: /Fiat Uno · ABC1D23/ }));
    await user.type(screen.getByRole('textbox', { name: 'Solicitação do cliente (opcional)' }), 'Ruído ao frear');

    await user.click(screen.getByRole('button', { name: /abrir os/i }));

    await waitFor(() =>
      expect(serviceOrdersApi.create).toHaveBeenCalledWith(expect.objectContaining({ vehicleId: 'v1', technicianId: undefined, customerComplaint: 'Ruído ao frear' })),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
