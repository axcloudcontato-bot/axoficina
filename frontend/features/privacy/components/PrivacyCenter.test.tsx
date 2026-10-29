import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';
import { PrivacyCenter } from './PrivacyCenter';

const get = vi.fn().mockResolvedValue({ data: { items: [] } });
vi.mock('@/lib/api/client', () => ({ apiClient: { get: (...args: unknown[]) => get(...args), post: vi.fn() }, extractErrorMessage: () => 'Falha' }));
vi.mock('@/features/customers/components/CustomerSearchCombobox', () => ({ CustomerSearchCombobox: () => <input aria-label="Cliente" /> }));

const renderCenter = (mode: 'self' | 'admin') => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PrivacyCenter mode={mode} /></QueryClientProvider>);

describe('PrivacyCenter sections', () => {
  beforeEach(() => {
    get.mockClear();
    useAuthStore.setState({ user: { id: 'u1', tenantId: 't1', name: 'Admin', email: 'admin@example.invalid', role: 'ADMIN', permissions: ['settings.manage', 'customers.manage'], status: 'active', createdAt: new Date().toISOString() } });
  });

  it('keeps personal requests separate from the workshop queue', async () => {
    renderCenter('self');
    expect(screen.getByText('Seus dados, suas escolhas')).toBeInTheDocument();
    expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/v1/privacy/requests'));
  });

  it('loads the workshop queue and customer request controls for an administrator', async () => {
    renderCenter('admin');
    expect(screen.queryByText('Seus dados, suas escolhas')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cliente')).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/v1/privacy/requests/manage'));
  });
});
