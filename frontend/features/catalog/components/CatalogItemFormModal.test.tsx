import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogApi } from '../api/catalog-api';
import { CatalogItemFormModal } from './CatalogItemFormModal';

const mocks = vi.hoisted(() => ({ permissions: ['service_orders.prices', 'finance.view'] as string[] }));
vi.mock('@/stores/auth-store', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { role: 'MANAGER', permissions: mocks.permissions } }) }));
vi.mock('@/features/settings/api/settings-api', () => ({ settingsApi: { branding: vi.fn().mockResolvedValue({ company: { name: 'Oficina', document: '1' }, laborRateCents: 12000 }) } }));
vi.mock('@/features/financial/api/financial-api', () => ({ financialApi: { suppliers: vi.fn().mockResolvedValue({ suppliers: [{ id: 's1', name: 'Auto Peças Silva' }] }) } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../api/catalog-api', () => ({ catalogApi: { create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}), list: vi.fn() } }));

const renderForm = (defaultType: 'PART' | 'LABOR' = 'PART') => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CatalogItemFormModal open onOpenChange={vi.fn()} defaultType={defaultType} /></QueryClientProvider>);

describe('CatalogItemFormModal', () => {
  beforeEach(() => { mocks.permissions = ['service_orders.prices', 'finance.view']; vi.mocked(catalogApi.create).mockClear(); });

  it('lets finance users set cost and see the margin, and sends code, brand, unit and supplier', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Nome'), 'Pastilha');
    await user.type(screen.getByLabelText('Código (opcional)'), 'PF-1');
    await user.type(screen.getByLabelText('Marca (opcional)'), 'Cobreq');
    await user.selectOptions(screen.getByLabelText('Unidade'), 'jogo');
    await user.type(screen.getByLabelText(/Preço padrão/), '180.00');
    await user.type(screen.getByLabelText(/Custo/), '90,00');
    expect(screen.getByText(/Margem: 50%/)).toBeInTheDocument();
    await screen.findByRole('option', { name: 'Auto Peças Silva' });
    await user.selectOptions(screen.getByLabelText(/Fornecedor/), 's1');
    await user.click(screen.getByRole('button', { name: 'Salvar item' }));
    await waitFor(() => expect(vi.mocked(catalogApi.create).mock.calls[0]?.[0]).toMatchObject({ type: 'PART', name: 'Pastilha', unitPriceCents: 18000, costCents: 9000, code: 'PF-1', brand: 'Cobreq', unit: 'jogo', supplierId: 's1' }));
  });

  it('hides cost and supplier from people without finance access, and never sends them', async () => {
    mocks.permissions = ['service_orders.prices'];
    const user = userEvent.setup();
    renderForm();
    expect(screen.queryByLabelText(/Custo/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Fornecedor/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Nome'), 'Vela');
    await user.click(screen.getByRole('button', { name: 'Salvar item' }));
    await waitFor(() => expect(catalogApi.create).toHaveBeenCalled());
    expect(vi.mocked(catalogApi.create).mock.calls[0]?.[0]).not.toHaveProperty('costCents');
    expect(vi.mocked(catalogApi.create).mock.calls[0]?.[0]).not.toHaveProperty('supplierId');
  });

  it('prices a service from its standard time and the hourly rate, and sends the care it schedules', async () => {
    const user = userEvent.setup();
    renderForm('LABOR');
    await user.type(screen.getByLabelText('Nome'), 'Troca de óleo e filtro');
    await user.type(screen.getByLabelText(/Tempo padrão/), '45');
    await user.click(await screen.findByRole('button', { name: /Calcular pelo tempo: .*90,00/ }));
    expect(screen.getByLabelText(/Preço padrão/)).toHaveValue('90,00');
    await user.selectOptions(screen.getByLabelText(/Programa o próximo cuidado/), 'OIL_CHANGE');
    await user.click(screen.getByRole('button', { name: 'Salvar item' }));
    await waitFor(() => expect(vi.mocked(catalogApi.create).mock.calls[0]?.[0]).toMatchObject({ type: 'LABOR', unitPriceCents: 9000, standardMinutes: 45, careServiceKey: 'OIL_CHANGE', unit: 'h' }));
  });
});
