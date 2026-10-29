import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';
import { CompanySettingsForm } from './CompanySettingsForm';

const useSettings = vi.fn();
vi.mock('../hooks/use-settings', () => ({ useSettings: () => useSettings(), useUpdateCompanySettings: () => ({ mutate: vi.fn(), isPending: false }) }));

describe('CompanySettingsForm', () => {
  beforeEach(() => {
    useSettings.mockReset();
    useAuthStore.setState({ user: { id: 'u1', tenantId: 't1', name: 'Gestor', email: 'gestor@example.invalid', role: 'MANAGER', permissions: ['settings.view'], status: 'active', createdAt: new Date().toISOString() } });
  });

  it('blocks editing when the saved configuration could not be loaded', () => {
    const refetch = vi.fn();
    useSettings.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch });
    render(<CompanySettingsForm />);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar');
    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).not.toBeInTheDocument();
  });

  it('lets a viewer read the company without offering a save action', () => {
    useSettings.mockReturnValue({ isLoading: false, isError: false, data: { company: { name: 'Oficina Boa', document: '11144477735' } } });
    render(<CompanySettingsForm />);
    expect(screen.getByDisplayValue('Oficina Boa')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).not.toBeInTheDocument();
  });
});
