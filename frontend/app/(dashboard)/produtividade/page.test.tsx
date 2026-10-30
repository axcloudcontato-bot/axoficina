import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serviceOrdersApi } from '@/features/service-orders/api/service-orders-api';
import { useAuthStore } from '@/stores/auth-store';
import ProductivityPage from './page';

vi.mock('@/features/service-orders/api/service-orders-api', () => ({ serviceOrdersApi: { technicianProductivity: vi.fn(), technicianProductivityOrders: vi.fn(), setProductivityTarget: vi.fn(), copyProductivityTargets: vi.fn(), myProductivity: vi.fn(), productivityTrend: vi.fn(), commissions: vi.fn(), setCommissionRule: vi.fn(), myIdle: vi.fn(), startIdle: vi.fn(), stopIdle: vi.fn() } }));

const baseReport = {
  startAt: '2026-10-01T03:00:00.000Z', endAt: '2026-11-01T03:00:00.000Z',
  totals: { completedCount: 21, laborRevenueCents: 210000, workedMinutes: 900, unassignedCount: 0, estimatedCount: 0, soldMinutes: 1080, efficiencyBaseMinutes: 900, efficiencyPercent: 120, valuePerHourCents: 14000, sessionMinutes: 960 },
  items: [{ technicianId: 'tech', technicianName: 'Ana Mecânica', completedCount: 21, laborRevenueCents: 210000, workedMinutes: 900, activeOrders: 1, estimatedCount: 0, target: null, soldMinutes: 1080, efficiencyBaseMinutes: 900, efficiencyPercent: 120, valuePerHourCents: 14000, sessionMinutes: 960, occupancyPercent: 59, reworkCount: 1, idleMinutes: 90 }],
  availableMinutes: 1620, laborRateCents: 12000,
};

describe('ProductivityPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'admin', role: 'ADMIN', tenantId: 'tenant', permissions: ['service_orders.prices'] } as never });
    vi.mocked(serviceOrdersApi.technicianProductivity).mockReset().mockResolvedValue(baseReport);
    vi.mocked(serviceOrdersApi.technicianProductivityOrders).mockReset().mockImplementation(async input => ({
      items: [{ id: input.offset ? 'second' : 'first', orderNumber: input.offset ? 21 : 1, deliveredAt: '2026-10-05T12:00:00.000Z', laborCents: 10000, workedMinutes: 45, estimated: false, standardMinutes: input.offset ? null : 60, orderWorkedMinutes: 90 }],
      total: 21, offset: input.offset, limit: input.limit,
    }));
    vi.mocked(serviceOrdersApi.setProductivityTarget).mockReset().mockResolvedValue({ success: true });
    vi.mocked(serviceOrdersApi.commissions).mockReset().mockResolvedValue({ month: '2026-10', totalCents: 21000, items: [{ technicianId: 'tech', technicianName: 'Ana Mecânica', laborRevenueCents: 210000, laborPercentBp: 1000, bonusPercentBp: 0, targetReached: false, commissionCents: 21000, reworkCount: 1 }] });
    vi.mocked(serviceOrdersApi.setCommissionRule).mockReset().mockResolvedValue({ success: true });
    vi.mocked(serviceOrdersApi.myIdle).mockReset().mockResolvedValue({ open: null, today: [] });
    vi.mocked(serviceOrdersApi.startIdle).mockReset().mockResolvedValue({ open: { id: 'i1', reason: 'CLEANING', note: null, startedAt: '2026-10-29T15:00:00.000Z', endedAt: null, minutes: 0 }, today: [] });
    vi.mocked(serviceOrdersApi.productivityTrend).mockReset().mockResolvedValue({ months: ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map((month, index) => ({ month, completedCount: index * 2, laborRevenueCents: index * 50000, workedMinutes: index * 300 })) });
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

  it('shows efficiency, value per hour and occupancy, and compares the team by the chosen measure', async () => {
    vi.mocked(serviceOrdersApi.technicianProductivity).mockResolvedValue({ ...baseReport, items: [...baseReport.items, { ...baseReport.items[0], technicianId: 'tech2', technicianName: 'Bruno', laborRevenueCents: 90000, efficiencyPercent: 70, valuePerHourCents: 9000, occupancyPercent: 30 }] });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('columnheader', { name: 'Eficiência' })).toBeInTheDocument();
    expect(screen.getAllByText('120%').length).toBeGreaterThan(0);
    expect(screen.getByText('Hora da oficina: R$ 120,00', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '59%' })).toBeInTheDocument();
    const team = screen.getByRole('region', { name: 'Comparativo da equipe' });
    await user.click(screen.getByRole('button', { name: 'Eficiência', pressed: false }));
    expect(team).toHaveTextContent('70%');
    expect(await screen.findByRole('region', { name: 'Evolução dos últimos 6 meses' })).toBeInTheDocument();
    expect(serviceOrdersApi.productivityTrend).toHaveBeenCalledWith({ month: expect.stringMatching(/^\d{4}-\d{2}$/) });
  });

  it('shows the standard time against the real time of each order', async () => {
    vi.mocked(serviceOrdersApi.technicianProductivityOrders).mockResolvedValue({ items: [{ id: 'slow', orderNumber: 5, deliveredAt: '2026-10-05T12:00:00.000Z', laborCents: 10000, workedMinutes: 45, estimated: false, standardMinutes: 60, orderWorkedMinutes: 120 }], total: 1, offset: 0, limit: 20 });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Ana Mecânica' }));
    expect(await screen.findByText(/previsto 1 h 00, real 2 h 00 \(demorou mais\)/)).toBeInTheDocument();
  });

  it('shows rework and idle time and lets a manager set a commission', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('columnheader', { name: 'Retornos' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Parado' })).toBeInTheDocument();
    const commissions = await screen.findByRole('region', { name: 'Comissões do mês' });
    expect(commissions).toHaveTextContent('R$ 210,00');
    const rate = screen.getByLabelText('Comissão de Ana Mecânica');
    await user.clear(rate);
    await user.type(rate, '12,5');
    await user.type(screen.getByLabelText('Bônus de Ana Mecânica'), '2');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(vi.mocked(serviceOrdersApi.setCommissionRule).mock.calls[0]?.[0]).toEqual({ technicianId: 'tech', laborPercentBp: 1250, bonusPercentBp: 200 }));
  });

  it('hides commissions from the front desk', async () => {
    useAuthStore.setState({ user: { id: 'desk', role: 'FRONT_DESK', tenantId: 'tenant', permissions: ['service_orders.prices', 'service_orders.view'] } as never });
    renderPage();
    expect(await screen.findByRole('button', { name: 'Ana Mecânica' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Comissões do mês' })).not.toBeInTheDocument();
    expect(serviceOrdersApi.commissions).not.toHaveBeenCalled();
  });

  it('lets a mechanic log time not on an order', async () => {
    useAuthStore.setState({ user: { id: 'tech', role: 'MECHANIC', tenantId: 'tenant', permissions: ['service_orders.view'] } as never });
    vi.mocked(serviceOrdersApi.myProductivity).mockResolvedValue({ completedCount: 7, workedMinutes: 600, activeOrders: 2, estimatedCount: 0, target: null, efficiencyPercent: 95, reworkCount: 1, idleMinutes: 30, idle: null });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('95%')).toBeInTheDocument();
    expect(screen.getByText('Retornos em garantia')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Motivo'), 'CLEANING');
    await user.click(screen.getByRole('button', { name: 'Iniciar tempo parado' }));
    await waitFor(() => expect(vi.mocked(serviceOrdersApi.startIdle).mock.calls[0]?.[0]).toEqual({ reason: 'CLEANING' }));
    expect(await screen.findByRole('button', { name: 'Encerrar tempo parado' })).toBeInTheDocument();
  });
});
