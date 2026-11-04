import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Form } from '@/components/ui/form';
import { fipeApi } from '@/features/fipe/api/fipe-api';
import { FipeBrandModelFields } from '../FipeBrandModelFields';
import type { VehicleFormValues } from '../VehicleFormModal';

vi.mock('@/features/fipe/api/fipe-api', () => ({
  fipeApi: { listBrands: vi.fn(), listModels: vi.fn() },
}));

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

const EMPTY_VALUES: VehicleFormValues = {
  category: 'CAR',
  customerId: '',
  brand: '',
  model: '',
  plate: '',
  year: '',
  engine: '',
  fuelType: '',
  chassis: '',
  mileage: '',
};

function Harness({ isEditing, defaultValues }: { isEditing: boolean; defaultValues?: Partial<VehicleFormValues> }) {
  const form = useForm<VehicleFormValues>({ defaultValues: { ...EMPTY_VALUES, ...defaultValues } });
  return (
    <Form {...form}>
      <form>
        <FipeBrandModelFields form={form} isEditing={isEditing} />
      </form>
    </Form>
  );
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('FipeBrandModelFields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fipeApi.listBrands).mockResolvedValue({ brands: [{ id: 'b1', name: 'Fiat' }] });
    vi.mocked(fipeApi.listModels).mockResolvedValue({ models: [{ id: 'm1', name: 'Uno' }] });
  });

  it('starts on FIPE selects in create mode, Categoria defaulting to Carro', async () => {
    renderWithClient(<Harness isEditing={false} />);

    // Categoria default é CAR — comprovado indiretamente: listBrands já é
    // chamado com CAR sem nenhuma interação do usuário.
    await waitFor(() => expect(fipeApi.listBrands).toHaveBeenCalledWith('CAR'));
  });

  it('starts on free-text inputs pre-filled in edit mode', () => {
    renderWithClient(<Harness isEditing defaultValues={{ brand: 'Fiat', model: 'Uno' }} />);

    expect(screen.getByLabelText(/marca/i)).toHaveValue('Fiat');
    expect(screen.getByLabelText(/modelo/i)).toHaveValue('Uno');
    expect(screen.getByRole('button', { name: /selecionar da lista fipe/i })).toBeInTheDocument();
  });

  it('selecting a brand from the FIPE list populates the field and enables Modelo', async () => {
    const user = userEvent.setup();
    renderWithClient(<Harness isEditing={false} />);

    await user.click(screen.getByLabelText(/marca/i));
    await user.click(await screen.findByRole('option', { name: 'Fiat' }));

    await waitFor(() => expect(screen.getByLabelText(/modelo/i)).not.toBeDisabled());

    await user.click(screen.getByLabelText(/modelo/i));
    await user.click(await screen.findByRole('option', { name: 'Uno' }));

    expect(fipeApi.listModels).toHaveBeenCalledWith('b1');
  });

  it('choosing "Outro" for Marca switches to a free-text input', async () => {
    const user = userEvent.setup();
    renderWithClient(<Harness isEditing={false} />);

    await user.click(screen.getByLabelText(/marca/i));
    await user.click(await screen.findByRole('option', { name: /outro/i }));

    expect(screen.getByPlaceholderText('Fiat')).toBeInTheDocument();
  });

  it('changing Categoria resets a previously chosen Marca back to an empty select', async () => {
    const user = userEvent.setup();
    renderWithClient(<Harness isEditing={false} />);

    await user.click(screen.getByLabelText(/marca/i));
    await user.click(await screen.findByRole('option', { name: 'Fiat' }));
    await waitFor(() => expect(screen.getByLabelText(/modelo/i)).not.toBeDisabled());

    await user.click(screen.getByLabelText('Categoria'));
    await user.click(await screen.findByRole('option', { name: 'Moto' }));

    expect(screen.getByLabelText(/modelo/i)).toBeDisabled();
  });

  it('shows only "Outro" when the category has no synced brands yet', async () => {
    vi.mocked(fipeApi.listBrands).mockResolvedValue({ brands: [] });
    const user = userEvent.setup();
    renderWithClient(<Harness isEditing={false} />);

    await user.click(screen.getByLabelText(/marca/i));

    expect(await screen.findByRole('option', { name: /outro/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Fiat' })).not.toBeInTheDocument();
  });
});
