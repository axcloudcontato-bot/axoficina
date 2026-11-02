import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaasAdminOverview } from './SaasAdminOverview';

const mocks = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn() }));
vi.mock('@/features/subscriptions/hooks/use-subscriptions', () => ({
  useSaasAdminAccess: () => mocks.access(),
  useSubscriptions: (...args: unknown[]) => mocks.list(...args),
}));

describe('SaaS admin overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockReturnValue({ data: { allowed: true } });
    mocks.list.mockReturnValue({ data: { summary: { total: 12, active: 7, trial: 3, pastDue: 1, mrrCents: 251900 }, items: [{ id: 'shop-1', name: 'Oficina Exemplo', plan: 'completo', ownerEmail: 'cliente@example.com', email: null, subscriptionStatus: 'active', subscriptionDueAt: null }] }, isPending: false, isError: false, isFetching: false, refetch: vi.fn() });
  });

  it('shows real platform totals and recent workshops', () => {
    render(<SaasAdminOverview />);
    expect(screen.getByText('Oficina Exemplo')).toBeVisible();
    expect(screen.getByText('R$ 2.519,00')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Indicadores da plataforma' })).toHaveTextContent('12');
    expect(mocks.list).toHaveBeenCalledWith({ offset: 0, limit: 6, scope: 'active' }, true);
  });

  it('does not request global data without SaaS admin access', () => {
    mocks.access.mockReturnValue({ data: { allowed: false } });
    render(<SaasAdminOverview />);
    expect(mocks.list).toHaveBeenCalledWith({ offset: 0, limit: 6, scope: 'active' }, false);
  });
});
