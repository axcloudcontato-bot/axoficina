import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';
import { CompanySettingsForm } from './CompanySettingsForm';

const useSettings = vi.fn();
vi.mock('../hooks/use-settings', () => ({ useSettings: () => useSettings(), useUpdateCompanySettings: () => ({ mutate: vi.fn(), isPending: false }), useOrderDefaults: () => ({ defaultWarrantyDays: null, quoteValidityDays: null, documentTerms: null, acceptedPaymentMethods: [] }) }));

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

  it('catches a mistyped CNPJ before saving', async () => {
    const mutate = vi.fn();
    useAuthStore.setState({ user: { id: 'u1', tenantId: 't1', name: 'Dono', email: 'dono@example.invalid', role: 'ADMIN', permissions: ['settings.view', 'settings.manage'], status: 'active', createdAt: new Date().toISOString() } });
    useSettings.mockReturnValue({ isLoading: false, isError: false, data: { company: { name: 'Oficina Boa', document: '11444777000161' } }, refetch: vi.fn() });
    const { toast } = await import('sonner');
    const error = vi.spyOn(toast, 'error');
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<CompanySettingsForm />);
    // Shown formatted, stored as digits.
    await user.clear(screen.getByDisplayValue('11.444.777/0001-61'));
    await user.type(screen.getByLabelText(/CPF\/CNPJ/), '11444777000162');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('não é válido'));
    expect(mutate).not.toHaveBeenCalled();
  });

  it('fills the address from the CEP without overwriting what was typed', async () => {
    useAuthStore.setState({ user: { id: 'u1', tenantId: 't1', name: 'Dono', email: 'dono@example.invalid', role: 'ADMIN', permissions: ['settings.view', 'settings.manage'], status: 'active', createdAt: new Date().toISOString() } });
    useSettings.mockReturnValue({ isLoading: false, isError: false, data: { company: { name: 'Oficina Boa', document: '11444777000161', addressStreet: 'Rua já digitada' } }, refetch: vi.fn() });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ logradouro: 'Avenida Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP' }) } as Response);
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<CompanySettingsForm />);
    await user.type(screen.getByLabelText('CEP'), '01310100');
    await user.tab();
    expect(fetchMock).toHaveBeenCalledWith('https://viacep.com.br/ws/01310100/json/');
    expect(await screen.findByDisplayValue('São Paulo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bela Vista')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Rua já digitada')).toBeInTheDocument();
    expect(screen.getByDisplayValue('01310-100')).toBeInTheDocument();
    fetchMock.mockRestore();
  });
});
