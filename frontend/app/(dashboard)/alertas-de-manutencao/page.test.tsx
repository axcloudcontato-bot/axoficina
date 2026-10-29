import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { maintenanceAlertsApi } from '@/features/maintenance-alerts/api/maintenance-alerts-api';
import { settingsApi } from '@/features/settings/api/settings-api';
import { useAuthStore } from '@/stores/auth-store';
import MaintenanceAlertsPage from './page';

vi.mock('@/features/maintenance-alerts/api/maintenance-alerts-api', () => ({ maintenanceAlertsApi: { list: vi.fn() } }));
vi.mock('@/features/settings/api/settings-api', () => ({
  settingsApi: { branding: vi.fn(), updateMaintenanceAlertMonths: vi.fn() },
}));
const { toastMock } = vi.hoisted(() => ({ toastMock: { success: vi.fn(), error: vi.fn() } }));
vi.mock('sonner', () => ({ toast: toastMock }));

const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MaintenanceAlertsPage /></QueryClientProvider>);
const emptyPage = { items: [], total: 0, offset: 0, limit: 20, hasMore: false };
const lastRequest = () => vi.mocked(maintenanceAlertsApi.list).mock.calls.at(-1)?.[0];

describe('MaintenanceAlertsPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', name: 'Ana', role: 'ADMIN', tenantId: 't', permissions: ['alerts.view', 'alerts.manage', 'settings.manage'] } as never });
    vi.mocked(maintenanceAlertsApi.list).mockReset();
    vi.mocked(maintenanceAlertsApi.list).mockResolvedValue(emptyPage);
    vi.mocked(settingsApi.branding).mockResolvedValue({ company: { name: 'Oficina', document: '1' }, maintenanceAlertMonths: 6 } as never);
    vi.mocked(settingsApi.updateMaintenanceAlertMonths).mockReset();
    toastMock.success.mockClear();
    toastMock.error.mockClear();
  });

  it('narrows the list by time since the last visit and by whether anyone already tried to reach the customer', async () => {
    const user = userEvent.setup();
    wrap();
    await waitFor(() => expect(lastRequest()).toMatchObject({ status: 'OPEN' }));
    expect(lastRequest()).not.toHaveProperty('minMonths');

    await user.selectOptions(screen.getByLabelText('Tempo sem visita'), '9-12');
    await waitFor(() => expect(lastRequest()).toMatchObject({ minMonths: 9, maxMonths: 12 }));
    await user.selectOptions(screen.getByLabelText('Situação do contato'), 'NEVER');
    await waitFor(() => expect(lastRequest()).toMatchObject({ minMonths: 9, maxMonths: 12, contact: 'NEVER' }));
    await user.selectOptions(screen.getByLabelText('Tempo sem visita'), '12+');
    await waitFor(() => expect(lastRequest()).toMatchObject({ minMonths: 12, contact: 'NEVER' }));
    expect(lastRequest()).not.toHaveProperty('maxMonths');
  });

  it('keeps those filters out of the history tabs', async () => {
    const user = userEvent.setup();
    wrap();
    await user.selectOptions(await screen.findByLabelText('Situação do contato'), 'CONTACTED');
    await user.click(screen.getByRole('tab', { name: 'Resolvidos' }));
    await waitFor(() => expect(lastRequest()).toMatchObject({ status: 'RESOLVED' }));
    expect(lastRequest()).not.toHaveProperty('contact');
    expect(screen.queryByLabelText('Situação do contato')).not.toBeInTheDocument();
  });

  it('lets someone who manages the workshop change the months without a visit, and refuses a number outside 1 to 36', async () => {
    vi.mocked(settingsApi.updateMaintenanceAlertMonths).mockResolvedValue({ maintenanceAlertMonths: 3 });
    const user = userEvent.setup();
    wrap();
    await user.click(await screen.findByRole('button', { name: 'Alterar meses sem revisão' }));
    const input = screen.getByLabelText('Meses sem revisão');
    expect(input).toHaveValue('6');
    await user.clear(input);
    await user.type(input, '99{Enter}');
    expect(toastMock.error).toHaveBeenCalledWith('Informe um número de meses entre 1 e 36.');
    expect(settingsApi.updateMaintenanceAlertMonths).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Alterar meses sem revisão' }));
    await user.clear(screen.getByLabelText('Meses sem revisão'));
    await user.type(screen.getByLabelText('Meses sem revisão'), '3{Enter}');
    await waitFor(() => expect(vi.mocked(settingsApi.updateMaintenanceAlertMonths).mock.calls[0]?.[0]).toEqual({ months: 3 }));
  });

  it('does not show the months setting to someone who cannot manage settings', async () => {
    useAuthStore.setState({ user: { id: 'u2', email: 'f@b.c', name: 'Fer', role: 'FRONT_DESK', tenantId: 't', permissions: ['alerts.view', 'alerts.manage'] } as never });
    wrap();
    await screen.findByLabelText('Tempo sem visita');
    expect(screen.queryByRole('button', { name: 'Alterar meses sem revisão' })).not.toBeInTheDocument();
  });
});
