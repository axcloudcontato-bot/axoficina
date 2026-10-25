import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VehicleSearchCombobox } from '../VehicleSearchCombobox';
import { vehiclesApi } from '../../api/vehicles-api';

vi.mock('../../api/vehicles-api', () => ({
  vehiclesApi: { list: vi.fn() },
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const vehicle = {
  id: 'v1',
  tenantId: 't1',
  customerId: 'c1',
  customerName: 'João da Silva',
  brand: 'Fiat',
  model: 'Uno',
  plate: 'ABC1D23',
  photos: [],
  createdAt: '2026-01-01T00:00:00Z',
};

describe('VehicleSearchCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not search before the minimum number of characters is typed', async () => {
    const user = userEvent.setup();
    renderWithClient(<VehicleSearchCombobox value="" onChange={vi.fn()} />);

    await user.type(screen.getByRole('combobox'), 'U');

    await act(() => new Promise((resolve) => setTimeout(resolve, 350)));
    expect(vehiclesApi.list).not.toHaveBeenCalled();
  });

  it('loads the selected customer vehicles as soon as the customer is provided', async () => {
    vi.mocked(vehiclesApi.list).mockResolvedValue({ items: [vehicle], total: 1, offset: 0, limit: 20, hasMore: false });
    renderWithClient(<VehicleSearchCombobox value="" customerId="c1" onChange={vi.fn()} />);

    expect(await screen.findByRole('option', { name: /Fiat Uno/ })).toBeInTheDocument();
    expect(vehiclesApi.list).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'c1', search: undefined }));
  });

  it('debounces and searches after typing, showing matching results', async () => {
    vi.mocked(vehiclesApi.list).mockResolvedValue({ items: [vehicle], total: 1, offset: 0, limit: 20, hasMore: false });
    const user = userEvent.setup();
    renderWithClient(<VehicleSearchCombobox value="" onChange={vi.fn()} />);

    await user.type(screen.getByRole('combobox'), 'Uno');

    expect(await screen.findByRole('option', { name: /João da Silva.*Fiat Uno · ABC1D23/ })).toBeInTheDocument();
    expect(vehiclesApi.list).toHaveBeenCalledWith(expect.objectContaining({ search: 'Uno' }));
  });

  it('selecting a result calls onChange with the vehicle id and closes the list', async () => {
    vi.mocked(vehiclesApi.list).mockResolvedValue({ items: [vehicle], total: 1, offset: 0, limit: 20, hasMore: false });
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<VehicleSearchCombobox value="" onChange={onChange} />);

    await user.type(screen.getByRole('combobox'), 'Uno');
    await user.click(await screen.findByRole('option', { name: /Fiat Uno/ }));

    expect(onChange).toHaveBeenCalledWith('v1');
    await waitFor(() => expect(screen.queryByRole('option')).not.toBeInTheDocument());
  });

  it('shows a no-results message when the search returns nothing', async () => {
    vi.mocked(vehiclesApi.list).mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20, hasMore: false });
    const user = userEvent.setup();
    renderWithClient(<VehicleSearchCombobox value="" onChange={vi.fn()} />);

    await user.type(screen.getByRole('combobox'), 'zzz');

    expect(await screen.findByText(/nenhum veículo encontrado/i)).toBeInTheDocument();
  });

  it('clears the selected vehicleId when the user edits the text after a selection was already made', async () => {
    vi.mocked(vehiclesApi.list).mockResolvedValue({ items: [vehicle], total: 1, offset: 0, limit: 20, hasMore: false });
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<VehicleSearchCombobox value="" onChange={onChange} />);

    await user.type(screen.getByRole('combobox'), 'Uno');
    await user.click(await screen.findByRole('option', { name: /Fiat Uno/ }));
    onChange.mockClear();

    await user.type(screen.getByRole('combobox'), 'x');

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('selects the highlighted result with the keyboard (Enter), without needing a click', async () => {
    const otherVehicle = { ...vehicle, id: 'v2', model: 'Palio', plate: 'XYZ9W88' };
    vi.mocked(vehiclesApi.list).mockResolvedValue({ items: [vehicle, otherVehicle], total: 2, offset: 0, limit: 20, hasMore: false });
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<VehicleSearchCombobox value="" onChange={onChange} />);

    const input = screen.getByRole('combobox');
    await user.type(input, 'Fiat');
    await screen.findAllByRole('option');

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('v2');
  });

  it('resets the displayed text when the parent clears value externally (e.g. modal reopened)', async () => {
    vi.mocked(vehiclesApi.list).mockResolvedValue({ items: [vehicle], total: 1, offset: 0, limit: 20, hasMore: false });
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState('');
      return (
        <>
          <VehicleSearchCombobox value={value} onChange={setValue} />
          <button type="button" onClick={() => setValue('')}>
            simular reabertura do modal
          </button>
        </>
      );
    }

    renderWithClient(<Harness />);

    await user.type(screen.getByRole('combobox'), 'Uno');
    await user.click(await screen.findByRole('option', { name: /Fiat Uno/ }));
    expect(screen.getByRole('combobox')).toHaveValue('João da Silva — Fiat Uno · ABC1D23');

    await user.click(screen.getByRole('button', { name: /simular reabertura/i }));

    expect(screen.getByRole('combobox')).toHaveValue('');
  });
});
