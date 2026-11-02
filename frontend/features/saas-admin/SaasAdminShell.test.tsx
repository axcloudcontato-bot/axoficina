import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaasAdminShell } from './SaasAdminShell';

const mocks = vi.hoisted(() => ({ access: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/admin' }));
vi.mock('@/features/subscriptions/hooks/use-subscriptions', () => ({ useSaasAdminAccess: () => mocks.access() }));
vi.mock('@/features/auth/hooks/use-auth', () => ({ useLogout: () => ({ mutate: vi.fn() }) }));
vi.mock('@/stores/auth-store', () => ({ useAuthStore: (selector: (state: { user: { name: string } }) => unknown) => selector({ user: { name: 'Sergio' } }) }));

describe('SaaS admin shell', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('keeps platform content hidden from unauthorized accounts', () => {
    mocks.access.mockReturnValue({ data: { allowed: false }, isPending: false, isError: false });
    render(<SaasAdminShell><p>Dados globais</p></SaasAdminShell>);
    expect(screen.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible();
    expect(screen.queryByText('Dados globais')).not.toBeInTheDocument();
  });

  it('offers the overview and subscription pages to an authorized admin', () => {
    mocks.access.mockReturnValue({ data: { allowed: true }, isPending: false, isError: false });
    render(<SaasAdminShell><p>Dados globais</p></SaasAdminShell>);
    expect(screen.getByText('Dados globais')).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Administração do SaaS' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Oficinas e assinaturas' })).toHaveAttribute('href', '/admin/assinaturas');
  });
});
