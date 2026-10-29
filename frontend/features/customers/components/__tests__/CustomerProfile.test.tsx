import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerOverviewResponse, CustomerResponse } from '@oficina/contracts';
import { useAuthStore } from '@/stores/auth-store';
import { CustomerProfile } from '../CustomerProfile';
import { customersApi } from '../../api/customers-api';

vi.mock('../../api/customers-api', () => ({ customersApi: { overview: vi.fn(), update: vi.fn() } }));
vi.mock('@/features/service-orders/hooks/use-service-orders', () => ({ useServiceOrdersList: () => ({ data: { items: [], total: 0, hasMore: false }, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const customer: CustomerResponse = { id: 'c1', tenantId: 't1', type: 'PF', document: '11144477735', name: 'João da Silva', phone: '11999998888', email: 'joao@example.com', careMessagesEnabled: true, careConsentAt: '2026-08-01T12:00:00Z', careConsentSource: 'COUNTER', createdAt: '2026-01-01T00:00:00Z' };
const overview: CustomerOverviewResponse = {
  vehicles: [{ id: 'v1', brand: 'Fiat', model: 'Uno', plate: 'ABC1D23', year: 2012, mileage: 98000 }],
  orderCount: 5, deliveredCount: 4, lastVisitAt: '2026-09-10T12:00:00Z',
  openServiceOrders: [{ id: 'so-9', orderNumber: 41, status: 'IN_PROGRESS', vehicleLabel: 'Fiat Uno · ABC1D23' }],
  upcomingAppointments: [{ id: 'ap-1', startsAt: '2026-11-03T13:00:00Z', status: 'CONFIRMED', serviceDescription: 'Revisão dos 100 mil' }],
  money: { totalSpentCents: 180000, averageTicketCents: 45000, pendingCents: 7500 },
};

function renderProfile() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CustomerProfile customer={customer} /></QueryClientProvider>);
}

describe('CustomerProfile', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', name: 'Ana', role: 'ADMIN', tenantId: 't1', permissions: ['customers.view', 'customers.manage'] } as never });
    vi.mocked(customersApi.overview).mockResolvedValue(overview);
  });

  it('shows who the customer is, with a WhatsApp link, a call link and the consent trail', async () => {
    renderProfile();
    expect(await screen.findByRole('heading', { name: 'João da Silva' })).toBeInTheDocument();
    expect(screen.getByText(/111\.444\.777-35 · \(11\) 99999-8888 · joao@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute('href', 'https://wa.me/5511999998888');
    expect(screen.getByRole('link', { name: /ligar/i })).toHaveAttribute('href', 'tel:11999998888');
    expect(screen.getByText(/autorizou lembretes de cuidado em .* no balcão/i)).toBeInTheDocument();
  });

  it('shows the numbers, what is pending, the vehicles and the next appointments', async () => {
    renderProfile();
    expect(await screen.findByText('5')).toBeInTheDocument();
    expect(screen.getByText('4 entregues')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s1\.800,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s450,00/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OS #41' })).toHaveAttribute('href', '/ordens-de-servico/so-9');
    expect(screen.getByText(/R\$\s75,00/)).toBeInTheDocument();
    expect(screen.getByText('Fiat Uno · 2012')).toBeInTheDocument();
    expect(screen.getByText('Revisão dos 100 mil')).toBeInTheDocument();
    const newOrder = screen.getAllByRole('link', { name: /nova os/i }).map((link) => link.getAttribute('href'));
    expect(newOrder.some((href) => href?.includes('vehicleId=v1'))).toBe(true);
  });

  it('leaves the money out when the server sent none, and hides management actions without permission', async () => {
    useAuthStore.setState({ user: { id: 'u2', email: 'm@b.c', name: 'Mec', role: 'MECHANIC', tenantId: 't1', permissions: ['customers.view'] } as never });
    vi.mocked(customersApi.overview).mockResolvedValue({ ...overview, money: undefined });
    renderProfile();
    await screen.findByText('Ordens de serviço');
    expect(screen.queryByText('Total gasto')).not.toBeInTheDocument();
    expect(screen.queryByText('Ticket médio')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nova os/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
  });
});
