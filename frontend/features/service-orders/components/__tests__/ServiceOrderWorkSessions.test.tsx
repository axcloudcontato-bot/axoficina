import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';
import { ServiceOrderWorkSessions } from '../ServiceOrderWorkSessions';

const mocks = vi.hoisted(() => ({ correct: vi.fn(), sessions: [] as unknown[] }));
vi.mock('../../hooks/use-service-orders', () => ({
  useWorkSessions: () => ({ data: { sessions: mocks.sessions }, isLoading: false, isError: false, refetch: vi.fn() }),
  useWorkSessionAction: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useCorrectWorkSession: () => ({ mutate: mocks.correct, isPending: false, isError: false }),
}));

describe('ServiceOrderWorkSessions', () => {
  beforeEach(() => {
    mocks.correct.mockReset();
    mocks.sessions = [{ id: 's1', technicianId: 'tech', technicianName: 'Ana', startedAt: '2026-10-28T12:00:00.000Z', endedAt: null, workedMinutes: 540, capped: true }];
  });

  it('flags a timer past closing time and lets a manager fix it with a reason', async () => {
    useAuthStore.setState({ user: { id: 'manager', role: 'MANAGER', tenantId: 'tenant', permissions: ['service_orders.view', 'service_orders.prices'] } as never });
    const user = userEvent.setup();
    render(<ServiceOrderWorkSessions serviceOrderId="order" status="IN_PROGRESS" />);
    expect(screen.getByText('Passou do fechamento')).toBeInTheDocument();
    expect(screen.getByText(/9 h 00 min até o fechamento/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Corrigir tempo de Ana' }));
    expect(screen.getByLabelText('Início')).toHaveValue('2026-10-28T09:00');
    await user.type(screen.getByLabelText('Fim'), '2026-10-28T12:30');
    expect(screen.getByRole('button', { name: 'Salvar correção' })).toBeDisabled();
    await user.type(screen.getByLabelText('Motivo da correção'), 'Esqueceu ligado');
    await user.click(screen.getByRole('button', { name: 'Salvar correção' }));
    await waitFor(() => expect(mocks.correct).toHaveBeenCalledWith({ sessionId: 's1', startedAt: '2026-10-28T12:00:00.000Z', endedAt: '2026-10-28T15:30:00.000Z', reason: 'Esqueceu ligado' }, expect.anything()));
  });

  it('does not offer the correction to a mechanic', () => {
    useAuthStore.setState({ user: { id: 'tech', role: 'MECHANIC', tenantId: 'tenant', permissions: ['service_orders.view'] } as never });
    render(<ServiceOrderWorkSessions serviceOrderId="order" status="IN_PROGRESS" />);
    expect(screen.queryByRole('button', { name: /Corrigir/ })).not.toBeInTheDocument();
  });
});
