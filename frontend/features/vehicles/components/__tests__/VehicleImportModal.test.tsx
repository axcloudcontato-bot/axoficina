import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { vehiclesApi } from '../../api/vehicles-api';
import { VehicleImportModal } from '../VehicleImportModal';

vi.mock('../../api/vehicles-api', () => ({ vehiclesApi: { importRows: vi.fn() } }));
const { toastMock } = vi.hoisted(() => ({ toastMock: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('sonner', () => ({ toast: toastMock }));

const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

describe('VehicleImportModal', () => {
  it('reads the chosen file, imports it and tells which rows were left out', async () => {
    vi.mocked(vehiclesApi.importRows).mockResolvedValue({ created: 1, problems: [{ line: 3, plate: 'XYZ9K88', reason: 'Nenhum cliente com este telefone. Cadastre o cliente antes.' }] });
    const user = userEvent.setup();
    wrap(<VehicleImportModal open onOpenChange={() => {}} />);
    const file = new File(['placa;marca;modelo;telefone\nABC1D23;Fiat;Uno;11999998888\nXYZ9K88;VW;Gol;11911112222\n'], 'veiculos.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('Arquivo CSV'), file);
    expect(await screen.findByText(/veículos prontos para importar/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Importar 2 veículos' }));
    await waitFor(() => expect(vi.mocked(vehiclesApi.importRows).mock.calls[0]?.[0]).toEqual({ rows: [
      { line: 2, plate: 'ABC1D23', brand: 'Fiat', model: 'Uno', ownerPhone: '11999998888' },
      { line: 3, plate: 'XYZ9K88', brand: 'VW', model: 'Gol', ownerPhone: '11911112222' },
    ] }));
    expect(await screen.findByText(/Linha 3 \(XYZ9K88\): Nenhum cliente com este telefone/)).toBeInTheDocument();
  });

  it('does not offer to import a file without a way to find the owner', async () => {
    const user = userEvent.setup();
    wrap(<VehicleImportModal open onOpenChange={() => {}} />);
    await user.upload(screen.getByLabelText('Arquivo CSV'), new File(['placa;marca;modelo\nABC1D23;Fiat;Uno\n'], 'sem-dono.csv', { type: 'text/csv' }));
    expect(await screen.findByText(/Preciso de uma coluna/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar 0 veículos' })).toBeDisabled();
  });
});
