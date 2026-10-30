import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanNotice } from './PlanNotice';

const mocks = vi.hoisted(() => ({ role: 'ADMIN', data: undefined as unknown }));
vi.mock('@/stores/auth-store', () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ user: { role: mocks.role } }) }));
vi.mock('./use-entitlements', () => ({ useEntitlements: () => ({ data: mocks.data }) }));

const plan = (overrides: Record<string, unknown> = {}) => ({
  plan: 'essencial', planName: 'Essencial', modules: [], limits: { users: 3, ordersPerMonth: 150, photoStorageMb: 5120 },
  access: { state: 'active', daysLeft: null, reason: null }, usage: { users: 1, ordersThisMonth: 10, photoStorageMb: 100 }, ...overrides,
});

describe('PlanNotice', () => {
  beforeEach(() => { mocks.role = 'ADMIN'; mocks.data = plan(); });

  it('says nothing while everything is fine', () => {
    const { container } = render(<PlanNotice />);
    expect(container).toHaveTextContent('');
  });

  it('counts the days left before the system turns view-only', () => {
    mocks.data = plan({ access: { state: 'grace', daysLeft: 5, reason: 'past_due' } });
    render(<PlanNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('Em 5 dias o sistema passa a ficar só para consulta');
  });

  it('tells the whole team when the account is view-only', () => {
    mocks.role = 'MECHANIC';
    mocks.data = plan({ access: { state: 'suspended', daysLeft: null, reason: 'past_due' } });
    render(<PlanNotice />);
    expect(screen.getByRole('alert')).toHaveTextContent('só para consulta');
  });

  it('keeps the late-payment warning and the usage warnings for administrators', () => {
    mocks.role = 'MECHANIC';
    mocks.data = plan({ access: { state: 'grace', daysLeft: 3, reason: 'past_due' }, usage: { users: 3, ordersThisMonth: 10, photoStorageMb: 100 } });
    render(<PlanNotice />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('warns at 80% and again when the limit is reached', () => {
    mocks.data = plan({ usage: { users: 3, ordersThisMonth: 125, photoStorageMb: 100 } });
    render(<PlanNotice />);
    expect(screen.getByText(/Usuários: o limite do plano foi atingido \(3 de 3\)/)).toBeInTheDocument();
    expect(screen.getByText(/Ordens de serviço neste mês: você já usou 125 de 150/)).toBeInTheDocument();
  });
});
