import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerListItemResponse, VehicleOverviewResponse, VehicleResponse } from '@oficina/contracts';
import { customersApi } from '@/features/customers/api/customers-api';
import { useAuthStore } from '@/stores/auth-store';
import { vehiclesApi } from '../../api/vehicles-api';
import { TransferVehicleDialog } from '../TransferVehicleDialog';
import { VehicleProfile } from '../VehicleProfile';

vi.mock('../../api/vehicles-api', () => ({ vehiclesApi: { overview: vi.fn(), transfer: vi.fn(), update: vi.fn() } }));
vi.mock('@/features/customers/api/customers-api', () => ({ customersApi: { list: vi.fn() } }));
vi.mock('@/features/fipe/api/fipe-api', () => ({ fipeApi: { listBrands: vi.fn().mockResolvedValue({ items: [] }), listModels: vi.fn().mockResolvedValue({ items: [] }) } }));
vi.mock('@/features/service-orders/hooks/use-service-orders', () => ({ useServiceOrdersList: () => ({ data: { items: [], total: 0, hasMore: false }, isLoading: false, isError: false, refetch: vi.fn() }) }));
const { toastMock } = vi.hoisted(() => ({ toastMock: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/features/customer-care/CareServiceDialog', () => ({ CareServiceDialog: ({ open, vehicle, defaultServiceKey }: { open: boolean; vehicle?: { id: string }; defaultServiceKey?: string }) => (open ? <div data-testid="care-dialog" data-vehicle={vehicle?.id} data-service={defaultServiceKey ?? ''} /> : null) }));
vi.mock('sonner', () => ({ toast: toastMock }));

const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

const vehicle: VehicleResponse = { id: 'v1', tenantId: 't', customerId: 'c1', customerName: 'João da Silva', brand: 'Fiat', model: 'Uno', year: 2012, color: 'Prata', fuelType: 'Flex', plate: 'ABC1234', mileage: 98000, photos: [], createdAt: '2026-01-01T00:00:00Z' };
const overview: VehicleOverviewResponse = {
  orderCount: 4, deliveredCount: 3, lastVisitAt: '2026-09-20T12:00:00Z',
  openServiceOrders: [{ id: 'so-9', orderNumber: 41, status: 'IN_PROGRESS' }],
  upcomingAppointments: [{ id: 'ap-1', startsAt: '2026-11-03T13:00:00Z', status: 'CONFIRMED', serviceDescription: 'Revisão dos 100 mil' }],
  care: [
    { serviceKey: 'OIL_CHANGE', serviceName: 'Óleo e filtro do motor', completedAt: '2026-01-10T12:00:00Z', dueAt: '2026-07-10T12:00:00Z', dueMileage: 90000, overdue: true },
    { serviceKey: 'BRAKES', serviceName: 'Pastilhas, discos e freios', completedAt: '2026-09-01T12:00:00Z', dueAt: '2027-03-01T12:00:00Z', overdue: false },
  ],
  mileageHistory: [{ at: '2026-08-03T12:00:00Z', mileage: 90020, orderNumber: 10 }, { at: '2026-09-20T12:00:00Z', mileage: 95000, orderNumber: 12 }],
};

describe('VehicleProfile', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', name: 'Ana', role: 'ADMIN', tenantId: 't', permissions: ['vehicles.view', 'vehicles.manage', 'alerts.manage'] } as never });
    vi.mocked(vehiclesApi.overview).mockResolvedValue(overview);
  });

  it('shows the car, its owner as a link, and the actions', async () => {
    wrap(<VehicleProfile vehicle={vehicle} />);
    expect(await screen.findByRole('heading', { name: 'Fiat Uno' })).toBeInTheDocument();
    expect(screen.getByText('ABC-1234')).toBeInTheDocument();
    expect(screen.getByText('2012 · Prata · Flex')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'João da Silva' })).toHaveAttribute('href', '/clientes/c1');
    const newOrder = screen.getByRole('link', { name: /nova os/i }).getAttribute('href') ?? '';
    expect(newOrder).toContain('customerId=c1');
    expect(newOrder).toContain('vehicleId=v1');
    expect(screen.getByRole('button', { name: /transferir dono/i })).toBeInTheDocument();
  });

  it('shows the numbers, what is in progress, the next care with what is overdue, appointments and odometer readings', async () => {
    wrap(<VehicleProfile vehicle={vehicle} />);
    expect(await screen.findByText('98.000 km')).toBeInTheDocument();
    expect(screen.getByText('3 entregues')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OS #41' })).toHaveAttribute('href', '/ordens-de-servico/so-9');
    expect(screen.getByText('Óleo e filtro do motor')).toBeInTheDocument();
    expect(screen.getByText(/Venceu em 10\/07\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/previsto também aos 90\.000 km/)).toBeInTheDocument();
    expect(screen.getByText(/Até 01\/03\/2027/)).toBeInTheDocument();
    expect(screen.getByText('Revisão dos 100 mil')).toBeInTheDocument();
    expect(screen.getByText('95.000 km')).toBeInTheDocument();
  });

  it('registers a care already done with the car already chosen, or one of the listed ones marked as done', async () => {
    const user = userEvent.setup();
    wrap(<VehicleProfile vehicle={vehicle} />);
    await user.click(await screen.findByRole('button', { name: 'Registrar cuidado feito' }));
    expect(screen.getByTestId('care-dialog')).toHaveAttribute('data-vehicle', 'v1');
    expect(screen.getByTestId('care-dialog')).toHaveAttribute('data-service', '');
  });

  it('opens the care dialog on the service that was clicked as done', async () => {
    const user = userEvent.setup();
    wrap(<VehicleProfile vehicle={vehicle} />);
    await user.click(await screen.findByRole('button', { name: 'Registrar Pastilhas, discos e freios feito' }));
    expect(screen.getByTestId('care-dialog')).toHaveAttribute('data-service', 'BRAKES');
  });

  it('does not offer to register a care without the permission', async () => {
    useAuthStore.setState({ user: { id: 'u3', email: 'f@b.c', name: 'Fer', role: 'FRONT_DESK', tenantId: 't', permissions: ['vehicles.view', 'vehicles.manage'] } as never });
    wrap(<VehicleProfile vehicle={vehicle} />);
    await screen.findByText('Ordens de serviço');
    expect(screen.queryByRole('button', { name: 'Registrar cuidado feito' })).not.toBeInTheDocument();
  });

  it('hides management actions from someone who may only look', async () => {
    useAuthStore.setState({ user: { id: 'u2', email: 'm@b.c', name: 'Mec', role: 'MECHANIC', tenantId: 't', permissions: ['vehicles.view'] } as never });
    wrap(<VehicleProfile vehicle={vehicle} />);
    await screen.findByText('Ordens de serviço');
    expect(screen.queryByRole('button', { name: /transferir dono/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nova os/i })).not.toBeInTheDocument();
  });
});

describe('TransferVehicleDialog', () => {
  const owner: CustomerListItemResponse = { id: 'c1', tenantId: 't', type: 'PF', document: '', name: 'João da Silva', phone: '11999998888', createdAt: '2026-01-01T00:00:00Z' };
  const buyer: CustomerListItemResponse = { ...owner, id: 'c2', name: 'Maria Souza', phone: '11988887777' };

  it('searches the new owner (never the current one), explains what happens, then transfers', async () => {
    vi.mocked(customersApi.list).mockResolvedValue({ items: [owner, buyer], total: 2, offset: 0, limit: 8, hasMore: false });
    vi.mocked(vehiclesApi.transfer).mockResolvedValue({ vehicle: { ...vehicle, customerId: 'c2', customerName: 'Maria Souza' } });
    const user = userEvent.setup();
    wrap(<TransferVehicleDialog vehicle={vehicle} open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText('Buscar o novo dono'), 'maria');
    expect(await screen.findByRole('button', { name: /Maria Souza/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /João da Silva/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Maria Souza/ }));
    expect(screen.getByText(/continuam no nome de/)).toBeInTheDocument();
    expect(vehiclesApi.transfer).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Transferir veículo' }));
    await waitFor(() => expect(vehiclesApi.transfer).toHaveBeenCalledWith({ id: 'v1', customerId: 'c2' }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining('Maria Souza')));
  });

  it('shows the server reason when the transfer is refused', async () => {
    vi.mocked(customersApi.list).mockResolvedValue({ items: [buyer], total: 1, offset: 0, limit: 8, hasMore: false });
    vi.mocked(vehiclesApi.transfer).mockRejectedValue(new Error('Este veículo tem 1 ordem de serviço em andamento.'));
    const user = userEvent.setup();
    wrap(<TransferVehicleDialog vehicle={vehicle} open onOpenChange={() => {}} />);
    await user.type(screen.getByLabelText('Buscar o novo dono'), 'maria');
    await user.click(await screen.findByRole('button', { name: /Maria Souza/ }));
    await user.click(screen.getByRole('button', { name: 'Transferir veículo' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });
});
