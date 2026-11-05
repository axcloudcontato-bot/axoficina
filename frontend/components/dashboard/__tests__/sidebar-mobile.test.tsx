import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../sidebar';

const mocks = vi.hoisted(() => ({
  pathname: '/painel',
  permissions: [
    'dashboard.view', 'service_orders.view', 'appointments.view', 'customers.view',
    'vehicles.view', 'alerts.view', 'service_orders.prices', 'finance.view',
    'team.view', 'settings.view',
  ],
  admin: false,
}));

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/stores/auth-store', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { id: 'u1', name: 'Ana Silva', role: 'ADMIN', permissions: mocks.permissions } }) }));
vi.mock('@/features/auth/hooks/use-auth', () => ({ useLogout: () => ({ mutate: vi.fn() }) }));
vi.mock('@/features/settings/hooks/use-settings', () => ({ useBranding: () => ({ data: { company: { name: 'Oficina Exemplo', logoDataUrl: null } } }) }));
vi.mock('@/features/plan/use-entitlements', () => ({ useEntitlements: () => ({ hasModule: () => true }) }));
vi.mock('@/features/subscriptions/hooks/use-subscriptions', () => ({ useSaasAdminAccess: () => ({ data: { allowed: mocks.admin } }) }));

describe('mobile navigation', () => {
  beforeEach(() => {
    mocks.pathname = '/painel';
    mocks.admin = false;
    mocks.permissions = [
      'dashboard.view', 'service_orders.view', 'appointments.view', 'customers.view',
      'vehicles.view', 'alerts.view', 'service_orders.prices', 'finance.view',
      'team.view', 'settings.view',
    ];
  });

  it('offers every remaining module, support and personal pages under More', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    const mobile = screen.getByRole('navigation', { name: 'Navegação móvel' });
    expect(within(mobile).getAllByRole('link')).toHaveLength(4);
    await user.click(within(mobile).getByRole('button', { name: 'Mais áreas' }));
    const menu = screen.getByRole('dialog', { name: 'Áreas do Ofix' });
    for (const [name, href] of [
      ['Veículos', '/veiculos'], ['Alertas de manutenção', '/alertas-de-manutencao'],
      ['Catálogo', '/catalogo'], ['Financeiro', '/financeiro'],
      ['Configurações', '/configuracoes'], ['Suporte', '/suporte'],
      ['Minha conta', '/configuracoes/conta'],
    ]) expect(within(menu).getByRole('link', { name })).toHaveAttribute('href', href);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Áreas do Ofix' })).not.toBeInTheDocument();
  });

  it('keeps modules without permission out of More and includes SaaS administration only for authorized accounts', async () => {
    mocks.permissions = ['dashboard.view', 'service_orders.view'];
    mocks.admin = true;
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(within(screen.getByRole('navigation', { name: 'Navegação móvel' })).getByRole('button', { name: 'Mais áreas' }));
    const menu = screen.getByRole('dialog', { name: 'Áreas do Ofix' });
    expect(within(menu).queryByRole('link', { name: 'Financeiro' })).not.toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Administração do SaaS' })).toHaveAttribute('href', '/admin');
  });
});
