import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VehicleListItemResponse } from '@oficina/contracts';
import { VehicleFormModal } from '../VehicleFormModal';
import { vehiclesApi } from '../../api/vehicles-api';
import { customersApi } from '@/features/customers/api/customers-api';
import { fipeApi } from '@/features/fipe/api/fipe-api';

vi.mock('../../api/vehicles-api', () => ({
  vehiclesApi: { create: vi.fn(), update: vi.fn() },
}));

vi.mock('@/features/customers/api/customers-api', () => ({
  customersApi: { list: vi.fn() },
}));

vi.mock('@/features/fipe/api/fipe-api', () => ({
  fipeApi: { listBrands: vi.fn(), listModels: vi.fn() },
}));

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: toastMock }));

// jsdom não implementa a Pointer Events API que o Radix Select usa — mesmo
// polyfill já usado em ServiceOrderFormModal.test.tsx.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const customer = { id: 'c1', tenantId: 't1', type: 'PF' as const, document: '11144477735', name: 'João da Silva', phone: '11999998888', createdAt: '2026-01-01T00:00:00Z' };

const editingVehicle: VehicleListItemResponse = {
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

describe('VehicleFormModal', () => {
  it('keeps the searched plate and model when the first FIPE brand is selected', async () => {
    const user = userEvent.setup();
    renderWithClient(<VehicleFormModal open onOpenChange={() => {}} initialCustomer={customer} initialValues={{ plate: 'ABC1D23', model: 'Uno de teste' }} />);
    expect(screen.getByLabelText(/placa/i)).toHaveValue('ABC1D23');
    expect(screen.getByLabelText(/modelo/i)).toHaveValue('Uno de teste');
    await user.click(screen.getByLabelText(/marca/i));
    await user.click(await screen.findByRole('option', { name: 'Fiat' }));
    expect(screen.getByLabelText(/modelo/i)).toHaveValue('Uno de teste');
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(customersApi.list).mockResolvedValue({ items: [customer], total: 1, offset: 0, limit: 100, hasMore: false });
    vi.mocked(fipeApi.listBrands).mockResolvedValue({ brands: [{ id: 'b1', name: 'Fiat' }] });
    vi.mocked(fipeApi.listModels).mockResolvedValue({ models: [{ id: 'm1', name: 'Uno' }] });
  });

  it('shows the customer picker in create mode', async () => {
    renderWithClient(<VehicleFormModal open onOpenChange={() => {}} />);

    // Cliente + Categoria + Marca, todos comboboxes nesse ponto (Modelo ainda não tem marca escolhida).
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('button', { name: /cadastrar veículo/i })).toBeInTheDocument();
  });

  it('hides the customer picker in edit mode and shows the owner as read-only text', () => {
    renderWithClient(<VehicleFormModal open onOpenChange={() => {}} vehicle={editingVehicle} />);

    expect(screen.getByText('João da Silva')).toBeInTheDocument();
    // Edição: marca/modelo pré-existentes aparecem como texto livre, não select (spec Edge Case de edição).
    expect(screen.getByDisplayValue('Fiat')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Uno')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitted empty in create mode', async () => {
    const user = userEvent.setup();
    renderWithClient(<VehicleFormModal open onOpenChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: /cadastrar veículo/i }));

    expect(await screen.findByText(/selecione um cliente/i)).toBeInTheDocument();
    expect(vehiclesApi.create).not.toHaveBeenCalled();
  });

  it('creates a vehicle with brand/model chosen through the FIPE selects', async () => {
    vi.mocked(vehiclesApi.create).mockResolvedValue({ vehicle: editingVehicle });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<VehicleFormModal open onOpenChange={onOpenChange} />);

    await user.click(await screen.findByLabelText(/cliente/i));
    await user.click(await screen.findByRole('option', { name: 'João da Silva' }));

    await user.click(screen.getByLabelText(/marca/i));
    await user.click(await screen.findByRole('option', { name: 'Fiat' }));
    await waitFor(() => expect(screen.getByLabelText(/modelo/i)).not.toBeDisabled());

    await user.click(screen.getByLabelText(/modelo/i));
    await user.click(await screen.findByRole('option', { name: 'Uno' }));

    await user.type(screen.getByLabelText(/placa/i), 'ABC1D23');
    await user.click(screen.getByRole('button', { name: /cadastrar veículo/i }));

    await waitFor(() =>
      expect(vehiclesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'c1', brand: 'Fiat', model: 'Uno', plate: 'ABC1D23' }),
      ),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('submits only the editable fields in edit mode, without customerId', async () => {
    vi.mocked(vehiclesApi.update).mockResolvedValue({ vehicle: editingVehicle });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<VehicleFormModal open onOpenChange={onOpenChange} vehicle={editingVehicle} />);

    const plateInput = screen.getByLabelText(/placa/i);
    await user.clear(plateInput);
    await user.type(plateInput, 'XYZ9W88');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    await waitFor(() => expect(vehiclesApi.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1', plate: 'XYZ9W88' })));
    expect(vehiclesApi.update).not.toHaveBeenCalledWith(expect.objectContaining({ customerId: expect.anything() }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  describe('plate and mileage rules', () => {
    beforeEach(() => { vi.mocked(vehiclesApi.update).mockReset(); vi.mocked(vehiclesApi.update).mockResolvedValue({ vehicle: editingVehicle }); });

    it('writes the plate upper case without hyphen or spaces while typing, and sends it that way', async () => {
      const user = userEvent.setup();
      renderWithClient(<VehicleFormModal open onOpenChange={() => {}} vehicle={editingVehicle} />);
      const plateInput = screen.getByLabelText(/placa/i);
      await user.clear(plateInput);
      await user.type(plateInput, 'xyz-9w 88');
      expect(plateInput).toHaveValue('XYZ9W88');
      await user.click(screen.getByRole('button', { name: /salvar alterações/i }));
      await waitFor(() => expect(vehiclesApi.update).toHaveBeenCalledWith(expect.objectContaining({ plate: 'XYZ9W88' })));
    });

    it('refuses a plate that is not in the old or Mercosul format', async () => {
      const user = userEvent.setup();
      renderWithClient(<VehicleFormModal open onOpenChange={() => {}} vehicle={editingVehicle} />);
      const plateInput = screen.getByLabelText(/placa/i);
      await user.clear(plateInput);
      await user.type(plateInput, 'ABC12');
      await user.click(screen.getByRole('button', { name: /salvar alterações/i }));
      expect(await screen.findByText(/placa inválida/i)).toBeInTheDocument();
      expect(vehiclesApi.update).not.toHaveBeenCalled();
    });

    it('refuses an impossible year and a malformed chassis', async () => {
      const user = userEvent.setup();
      renderWithClient(<VehicleFormModal open onOpenChange={() => {}} vehicle={editingVehicle} />);
      await user.clear(screen.getByLabelText(/ano/i));
      await user.type(screen.getByLabelText(/ano/i), '1850');
      await user.type(screen.getByLabelText(/chassi/i), 'ABC123');
      await user.click(screen.getByRole('button', { name: /salvar alterações/i }));
      expect(await screen.findByText(/informe um ano entre 1900/i)).toBeInTheDocument();
      expect(vehiclesApi.update).not.toHaveBeenCalled();
    });

    it('asks before lowering the mileage and sends the confirmation only after it', async () => {
      const user = userEvent.setup();
      renderWithClient(<VehicleFormModal open onOpenChange={() => {}} vehicle={{ ...editingVehicle, mileage: 98000 }} />);
      const mileage = screen.getByLabelText(/quilometragem/i);
      await user.clear(mileage);
      await user.type(mileage, '9800');
      await user.click(screen.getByRole('button', { name: /salvar alterações/i }));
      expect(await screen.findByText(/quilometragem menor que a atual/i)).toBeInTheDocument();
      expect(vehiclesApi.update).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /corrigir mesmo assim/i }));
      await waitFor(() => expect(vehiclesApi.update).toHaveBeenCalledWith(expect.objectContaining({ mileage: 9800, confirmMileageDecrease: true })));
    });

    it('does not ask when the mileage goes up', async () => {
      const user = userEvent.setup();
      renderWithClient(<VehicleFormModal open onOpenChange={() => {}} vehicle={{ ...editingVehicle, mileage: 98000 }} />);
      const mileage = screen.getByLabelText(/quilometragem/i);
      await user.clear(mileage);
      await user.type(mileage, '99000');
      await user.click(screen.getByRole('button', { name: /salvar alterações/i }));
      await waitFor(() => expect(vehiclesApi.update).toHaveBeenCalledWith(expect.objectContaining({ mileage: 99000 })));
      expect(vehiclesApi.update).not.toHaveBeenCalledWith(expect.objectContaining({ confirmMileageDecrease: true }));
    });
  });
});
