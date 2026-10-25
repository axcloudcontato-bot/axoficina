import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSION_KEYS } from '@oficina/contracts';
import { HeaderDock } from '../header-dock';
import { useAuthStore } from '@/stores/auth-store';

const { setTheme } = vi.hoisted(() => ({ setTheme: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/customers' }));
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme }) }));
vi.mock('@/features/auth/hooks/use-auth', () => ({ useLogout: () => ({ mutate: vi.fn() }) }));
vi.mock('@/features/notifications/hooks/use-customer-reply-notifications', () => ({ useCustomerReplyNotifications: () => ({ enabled: false, unreadCount: 0 }) }));
vi.mock('@/features/maintenance-alerts/hooks/use-maintenance-alerts', () => ({ useMaintenanceAlertsList: () => ({ data: { total: 0 } }) }));
vi.mock('@/features/service-orders/hooks/use-service-orders', () => ({ useDueServiceOrderInstallments: () => ({ data: { total: 0, items: [] } }), useServiceOrdersList: () => ({ data: { items: [] }, isFetching: false }) }));

describe('header keyboard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({ user: { id: 'u1', tenantId: 't1', name: 'Teste', email: 'test@example.invalid', role: 'ADMIN', permissions: [...PERMISSION_KEYS], status: 'active', createdAt: '2026-10-24T00:00:00Z' } });
  });
  it('keeps the search field exposed and shows the release history from the header', async () => {
    const user = userEvent.setup(); render(<HeaderDock />);
    expect(screen.getByRole('textbox', { name: 'Buscar páginas e ordens de serviço' })).toBeVisible();
    const updates = screen.getByRole('button', { name: 'Novidades do sistema' });
    await user.click(updates);
    expect(screen.getByRole('dialog', { name: 'Novidades do sistema' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Envio de fotos pelo celular' })).toBeVisible();
    expect(screen.queryByTestId('unread-updates-indicator')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(updates).toHaveFocus());
    expect(screen.getByRole('textbox', { name: 'Buscar páginas e ordens de serviço' })).toBeVisible();
  });
  it('opens exactly one search input with Ctrl+K, navigates by arrow and restores the original input on Escape', async () => {
    const user = userEvent.setup();
    render(<><input aria-label="Campo anterior" /><HeaderDock /></>);
    const original = screen.getByRole('textbox', { name: 'Campo anterior' }); original.focus();
    await user.keyboard('{Control>}k{/Control}');
    const search = screen.getByRole('textbox', { name: 'Buscar páginas e ordens de serviço' });
    expect(screen.getAllByRole('textbox', { name: 'Buscar páginas e ordens de serviço' })).toHaveLength(1);
    await waitFor(() => expect(search).toHaveFocus());
    await user.type(search, 'veiculo');
    const pages = screen.getByRole('navigation', { name: 'Páginas do sistema' });
    expect(within(pages).getAllByRole('link')).toHaveLength(1);
    await user.keyboard('{ArrowDown}'); expect(within(pages).getByRole('link', { name: 'Veículos' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(original).toHaveFocus());
  });
  it('supports arrows, Space, Escape and focus restoration for the theme menu', async () => {
    const user = userEvent.setup(); render(<HeaderDock />);
    const trigger = screen.getByRole('button', { name: 'Tema' }); trigger.focus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Claro' })).toHaveFocus());
    await user.keyboard('{ArrowRight} ');
    expect(setTheme).toHaveBeenCalledWith('dark');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
  it('does not turn plain typing into a shortcut and hides destinations without permission', async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: 'MECHANIC', permissions: ['customers.view'] } });
    const user = userEvent.setup(); render(<><input aria-label="Texto" /><HeaderDock /></>);
    await user.type(screen.getByRole('textbox', { name: 'Texto' }), 'k/');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('{Control>}k{/Control}');
    const nav = screen.getByRole('navigation', { name: 'Páginas do sistema' });
    expect(within(nav).queryByRole('link', { name: 'Financeiro' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Clientes' })).toBeInTheDocument();
  });
  it('lets Tab leave the last menu item instead of trapping focus', async () => {
    const user = userEvent.setup(); render(<><HeaderDock /><button>Próximo controle</button></>);
    const trigger = screen.getByRole('button', { name: 'Tema' }); trigger.focus();
    await user.keyboard('{ArrowUp}');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sistema' })).toHaveFocus());
    await user.tab();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Perfil' })).toHaveFocus();
  });
});
