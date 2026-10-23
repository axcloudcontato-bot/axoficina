import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Topbar } from '../topbar';

const useMaintenanceAlertsList = vi.fn();

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('@/features/maintenance-alerts/hooks/use-maintenance-alerts', () => ({
  useMaintenanceAlertsList: (...args: unknown[]) => useMaintenanceAlertsList(...args),
}));
vi.mock('@/features/service-orders/hooks/use-service-orders', () => ({
  useDueServiceOrderInstallments: () => ({ data: { items: [], total: 0 } }),
}));
vi.mock('@/features/auth/hooks/use-auth', () => ({ useLogout: () => ({ mutate: vi.fn() }) }));

describe('Topbar', () => {
  beforeEach(() => useMaintenanceAlertsList.mockReset());

  it('does not show the indicator when there are no open alerts', () => {
    useMaintenanceAlertsList.mockReturnValue({ data: { items: [], total: 0 } });
    render(<Topbar />);

    expect(screen.queryByTestId('open-alert-indicator')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alertas' })).toBeInTheDocument();
  });

  it('shows the indicator when open alerts exist', () => {
    useMaintenanceAlertsList.mockReturnValue({ data: { items: [], total: 3 } });
    render(<Topbar />);

    expect(screen.getByTestId('open-alert-indicator')).toBeInTheDocument();
  });
});
