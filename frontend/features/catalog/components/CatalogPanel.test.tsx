import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settingsApi } from '@/features/settings/api/settings-api';
import { catalogApi } from '../api/catalog-api';
import { CatalogPanel } from './CatalogPanel';

vi.mock('@/features/settings/api/settings-api', () => ({ settingsApi: { branding: vi.fn().mockResolvedValue({ company: { name: 'Oficina', document: '1' }, laborRateCents: 12000 }), updateLaborRate: vi.fn().mockResolvedValue({ laborRateCents: 15000 }) } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../api/catalog-api', () => ({
  catalogApi: { list: vi.fn(), create: vi.fn(), update: vi.fn().mockResolvedValue({}), remove: vi.fn().mockResolvedValue({ success: true }), seedDefaults: vi.fn() },
}));

const items = [
  { id: 'p1', type: 'PART', name: 'Pastilha de freio dianteira', category: 'Freios', unitPriceCents: 18000, costCents: 9000, code: 'PF-1', brand: 'Cobreq', unit: 'jogo' },
  { id: 'p2', type: 'PART', name: 'Disco de freio', category: 'Freios', unitPriceCents: 0 },
  { id: 'p3', type: 'PART', name: 'Vela de ignição', category: 'Motor', unitPriceCents: 0 },
];
const renderPanel = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CatalogPanel /></QueryClientProvider>);

describe('CatalogPanel', () => {
  beforeEach(() => { vi.mocked(catalogApi.list).mockResolvedValue({ items } as never); vi.mocked(catalogApi.update).mockClear(); vi.mocked(catalogApi.remove).mockClear(); });

  it('edits a price in place, reading a decimal typed with a dot as reais, not hundreds of reais', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Alterar preço de Disco de freio' }));
    await user.type(screen.getByLabelText('Preço de Disco de freio'), '230.50{Enter}');
    await waitFor(() => expect(vi.mocked(catalogApi.update).mock.calls[0]?.[0]).toMatchObject({ id: 'p2', unitPriceCents: 23050 }));
  });

  it('rejects an invalid price without calling the API', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Alterar preço de Vela de ignição' }));
    await user.type(screen.getByLabelText('Preço de Vela de ignição'), 'abc{Enter}');
    expect(catalogApi.update).not.toHaveBeenCalled();
  });

  it('counts unpriced items and can show only them', async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText(/2 itens sem preço/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mostrar só os sem preço' }));
    expect(screen.queryByText('Pastilha de freio dianteira')).not.toBeInTheDocument();
    expect(screen.getByText('Disco de freio')).toBeInTheDocument();
  });

  it('filters by category', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Vela de ignição');
    await user.selectOptions(screen.getByLabelText('Filtrar por categoria'), 'Motor');
    expect(screen.queryByText('Disco de freio')).not.toBeInTheDocument();
    expect(screen.getByText('Vela de ignição')).toBeInTheDocument();
  });

  it('asks for confirmation in its own dialog before deleting', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Excluir Disco de freio' }));
    expect(catalogApi.remove).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(vi.mocked(catalogApi.remove).mock.calls[0]?.[0]).toBe('p2'));
  });

  it('shows the margin next to the price when the cost is known, plus code, brand and unit', async () => {
    renderPanel();
    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/Freios · PF-1 · Cobreq · por jogo/)).toBeInTheDocument();
  });

  it('shows and changes the workshop hourly rate', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Alterar valor da hora' }));
    const input = screen.getByLabelText('Valor da hora');
    expect(input).toHaveValue('120,00');
    await user.clear(input);
    await user.type(input, '150.00{Enter}');
    await waitFor(() => expect(vi.mocked(settingsApi.updateLaborRate).mock.calls[0]?.[0]).toEqual({ laborRateCents: 15000 }));
  });
});
