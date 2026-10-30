import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serviceOrdersApi } from '@/features/service-orders/api/service-orders-api';
import { useAuthStore } from '@/stores/auth-store';
import ProductivityPage from './page';

vi.mock('@/features/service-orders/api/service-orders-api', () => ({ serviceOrdersApi: { technicianProductivity: vi.fn(), technicianProductivityOrders: vi.fn(), setProductivityTarget: vi.fn(), copyProductivityTargets: vi.fn(), myProductivity: vi.fn() } }));

const baseReport = {
  startAt: '2026-10-01T03:00:00.000Z', endAt: '2026-11-01T03:00:00.000Z',
  totals: { completedCount: 21, laborRevenueCents: 210000, workedMinutes: 900, unassignedCount: 0, estimatedCount: 0 },
  items: [{ technicianId: 'tech', technicianName: 'Ana Mecânica', completedCount: 21, laborRevenueCents: 210000, workedMinutes: 900, activeOrders: 1, estimatedCount: 0, target: null }],
};

describe('ProductivityPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'admin', role: 'ADMIN', tenantId: 'tenant', permissions: ['service_orders.prices'] } as never });
    vi.mocked(serviceOrdersApi.technicianProductivity).mockReset().mockResolvedValue(baseReport);
    vi.mocked(serviceOrdersApi.technicianProductivityOrders).mockReset().mockImplementation(async input => ({
      items: [{ id: input.offset ? 'second' : 'first', orderNumber: input.offset ? 21 : 1, deliveredAt: '2026-10-05T12:00:00.000Z', laborCents: 10000, workedMinutes: 45, estimated: false }],
      total: 21, offset: input.offset, limit: input.limit,
    }));
    vi.mocked(serviceOrdersApi.setProductivityTarget).mockReset().mockResolvedValue({ success: true });
  });

  it('loads details only when expanded and requests the next page', async () => {
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ProductivityPage /></QueryClientProvider>);
    await user.click(await screen.findByRole('button', { name: 'Ana Mecânica' }));
    await waitFor(() => expect(serviceOrdersApi.technicianProductivityOrders).toHaveBeenCalledWith(expect.objectContaining({ technicianId: 'tech', offset: 0, limit: 20 })));
    expect(await screen.findByRole('link', { name: 'OS #1' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(serviceOrdersApi.technicianProductivityOrders).toHaveBeenCalledWith(expect.objectContaining({ technicianId: 'tech', offset: 20, limit: 20 })));
    expect(await screen.findByRole('link', { name: 'OS #21' })).toBeInTheDocument();
  });

  it('saves a monthly target in cents and minutes', async () => {
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ProductivityPage /></QueryClientProvider>);
    await user.click(await screen.findByRole('button', { name: 'Ana Mecânica' }));
    await user.clear(screen.getByLabelText('Meta de OS'));
    await user.type(screen.getByLabelText('Meta de OS'), '24');
    await user.clear(screen.getByLabelText('Meta de mão de obra em reais'));
    await user.type(screen.getByLabelText('Meta de mão de obra em reais'), '1000');
    await user.clear(screen.getByLabelText('Meta de horas'));
    await user.type(screen.getByLabelText('Meta de horas'), '8');
    await user.click(screen.getByRole('button', { name: 'Salvar meta' }));
    await waitFor(() => expect(vi.mocked(serviceOrdersApi.setProductivityTarget).mock.calls[0]?.[0]).toMatchObject({ technicianId: 'tech', completedCount: 24, laborRevenueCents: 100000, workedMinutes: 480 }));
  });

  const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ProductivityPage /></QueryClientProvider>);

  it('warns about a timer left running past closing time', async () => {
    vi.mocked(serviceOrdersApi.technicianProductivity).mockResolvedValue({ ...baseReport, openSessions: [
      { id: 's1', technicianId: 'tech', technicianName: 'Ana Mecânica', serviceOrderId: 'order-9', orderNumber: 9, startedAt: '2026-10-28T12:00:00.000Z', workedMinutes: 540, capped: true },
      { id: 's2', technicianId: 'tech2', technicianName: 'Bruno', serviceOrderId: 'order-10', orderNumber: 10, startedAt: '2026-10-29T12:00:00.000Z', workedMinutes: 30, capped: false },
    ] });
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Um cronômetro parece esquecido');
    expect(alert).toHaveTextContent('passou do fechamento');
    expect(alert).not.toHaveTextContent('Bruno');
    expect(screen.getByRole('link', { name: 'OS #9' })).toHaveAttribute('href', '/ordens-de-servico/order-9');
  });

  it('shows the team total once, counting each delivered order a single time', async () => {
    renderPage();
    expect(await screen.findByRole('columnheader', { name: 'OS em que trabalhou' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '21 OS' })).toBeInTheDocument();
  });

  it('copies last month targets for the team', async () => {
    vi.mocked(serviceOrdersApi.copyProductivityTargets).mockResolvedValue({ copied: 2 });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Copiar metas do mês anterior' }));
    await waitFor(() => expect(vi.mocked(serviceOrdersApi.copyProductivityTargets).mock.calls[0]?.[0]).toMatchObject({ fromMonth: expect.stringMatching(/^\d{4}-\d{2}$/), toMonth: expect.stringMatching(/^\d{4}-\d{2}$/) }));
    expect(await screen.findByText('Metas de 2 técnico(s) copiadas do mês anterior.')).toBeInTheDocument();
  });

  it('shows a mechanic their own month without money', async () => {
    useAuthStore.setState({ user: { id: 'tech', role: 'MECHANIC', tenantId: 'tenant', permissions: ['service_orders.view'] } as never });
    vi.mocked(serviceOrdersApi.myProductivity).mockResolvedValue({ completedCount: 7, workedMinutes: 600, activeOrders: 2, estimatedCount: 0, target: { completedCount: 14, workedMinutes: 1200 } });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Minha produtividade' })).toBeInTheDocument();
    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(screen.getAllByText('50% da meta')).toHaveLength(2);
    expect(screen.queryByText(/Mão de obra/)).not.toBeInTheDocument();
    expect(serviceOrdersApi.technicianProductivity).not.toHaveBeenCalled();
  });
});
