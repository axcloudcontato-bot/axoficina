import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MyProductivityCard } from '../MyProductivityCard';

vi.mock('../../hooks/use-service-orders', () => ({
  useMyProductivity: () => ({ data: { completedCount: 6, workedMinutes: 750, activeOrders: 2, estimatedCount: 0, target: { completedCount: 12, workedMinutes: 9000 }, efficiencyPercent: 110, reworkCount: 1, idleMinutes: 0, idle: null }, isLoading: false, isError: false }),
  useMyIdle: () => ({ data: { open: null, today: [] }, isLoading: false }),
  useIdleAction: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));

describe('MyProductivityCard', () => {
  it('shows the mechanic their month, target progress and efficiency', () => {
    render(<MyProductivityCard />);
    expect(screen.getByText('110%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Meta de OS do mês' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('1 OS sua voltou em garantia neste mês.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar tempo parado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver detalhes' })).toHaveAttribute('href', '/produtividade');
  });
});
