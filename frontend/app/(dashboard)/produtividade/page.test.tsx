import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serviceOrdersApi } from '@/features/service-orders/api/service-orders-api';
import { useAuthStore } from '@/stores/auth-store';
import ProductivityPage from './page';

vi.mock('@/features/service-orders/api/service-orders-api', () => ({ serviceOrdersApi: { technicianProductivity: vi.fn(), technicianProductivityOrders: vi.fn(), setProductivityTarget: vi.fn() } }));

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
});
