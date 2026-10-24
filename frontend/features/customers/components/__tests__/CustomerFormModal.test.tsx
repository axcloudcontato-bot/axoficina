import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerListItemResponse } from '@oficina/contracts';
import { CustomerFormModal } from '../CustomerFormModal';
import { customersApi } from '../../api/customers-api';
import { serviceOrdersApi } from '../../../service-orders/api/service-orders-api';

vi.mock('../../api/customers-api', () => ({
  customersApi: { create: vi.fn(), update: vi.fn() },
}));

vi.mock('../../../service-orders/api/service-orders-api', () => ({
  serviceOrdersApi: { list: vi.fn() },
}));

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: toastMock }));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const editingCustomer: CustomerListItemResponse = {
  id: 'c1',
  tenantId: 't1',
  type: 'PF',
  document: '11144477735',
  name: 'João da Silva',
  phone: '11999998888',
  createdAt: '2026-01-01T00:00:00Z',
};

const editingCompanyCustomer: CustomerListItemResponse = { ...editingCustomer, id: 'c2', type: 'PJ', name: 'Oficina LTDA' };

describe('CustomerFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.mocked(serviceOrdersApi.list).mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20, hasMore: false });
  });

  it('creates a basic customer without requiring CPF or CNPJ', async () => {
    vi.mocked(customersApi.create).mockResolvedValue({ customer: { ...editingCustomer, document: '' } });
    const user = userEvent.setup();
    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} />);
    await user.type(screen.getByLabelText(/^nome$/i), 'Cliente básico');
    await user.type(screen.getByLabelText(/telefone/i), '11999998888');
    await user.click(screen.getByRole('button', { name: /cadastrar cliente/i }));
    await waitFor(() => expect(customersApi.create).toHaveBeenCalledWith(expect.objectContaining({ document: undefined, name: 'Cliente básico' })));
  });

  it('actually removes an optional email when it is cleared in edit mode', async () => {
    vi.mocked(customersApi.update).mockResolvedValue({ customer: editingCustomer });
    const user = userEvent.setup();
    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} customer={{ ...editingCustomer, email: 'remove@example.invalid' }} />);
    await user.clear(screen.getByLabelText(/e-mail/i));
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));
    await waitFor(() => expect(customersApi.update).toHaveBeenCalledWith(expect.objectContaining({ email: null })));
  });

  it('sends CEP to ViaCEP only after an explicit lookup click', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ logradouro: 'Rua de teste', localidade: 'São Paulo', uf: 'SP', bairro: 'Centro' }) });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} />);
    await user.click(screen.getByRole('tab', { name: /endereço/i }));
    await user.type(screen.getByLabelText(/^cep$/i), '01001000');
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Consultar CEP' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('https://viacep.com.br/ws/01001000/json/'));
    await waitFor(() => expect(screen.getByLabelText(/^rua$/i)).toHaveValue('Rua de teste'));
  });

  it('shows type/document fields in create mode', () => {
    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} />);

    expect(screen.getByLabelText(/cpf ou cnpj/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cadastrar cliente/i })).toBeInTheDocument();
  });

  it('shows address as a separate step in the guided create flow', async () => {
    const user = userEvent.setup();
    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} presentation="page" />);

    expect(screen.getByText('Endereço')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^rua$/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/cpf ou cnpj/i), '11144477735');
    await user.type(screen.getByLabelText(/^nome$/i), 'Maria Souza');
    await user.type(screen.getByLabelText(/telefone/i), '11988887777');
    await user.click(screen.getByRole('button', { name: /próximo/i }));

    expect(screen.getByLabelText(/^rua$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^nome$/i)).not.toBeInTheDocument();
  });

  it('allows document correction in edit mode', () => {
    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} customer={editingCustomer} />);

    expect(screen.getByLabelText(/cpf ou cnpj/i)).toHaveValue('11144477735');
    expect(screen.getByDisplayValue('João da Silva')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeInTheDocument();
  });

  it('shows RG for a PF customer and Inscrição Estadual for a PJ customer', () => {
    const { unmount } = renderWithClient(<CustomerFormModal open onOpenChange={() => {}} customer={editingCustomer} />);
    expect(screen.getByLabelText(/^rg/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/inscrição estadual/i)).not.toBeInTheDocument();
    unmount();

    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} customer={editingCompanyCustomer} />);
    expect(screen.getByLabelText(/inscrição estadual/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^rg/i)).not.toBeInTheDocument();
  });

  it('shows validation errors when submitted empty in create mode', async () => {
    const user = userEvent.setup();
    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: /cadastrar cliente/i }));

    expect(await screen.findByText(/informe o nome/i)).toBeInTheDocument();
    expect(customersApi.create).not.toHaveBeenCalled();
  });

  it('submits the create payload and closes on success', async () => {
    vi.mocked(customersApi.create).mockResolvedValue({ customer: { ...editingCustomer, id: 'new-id' } });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<CustomerFormModal open onOpenChange={onOpenChange} />);

    await user.type(screen.getByLabelText(/cpf ou cnpj/i), '11144477735');
    await user.type(screen.getByLabelText(/^nome$/i), 'Maria Souza');
    await user.type(screen.getByLabelText(/telefone/i), '11988887777');
    await user.click(screen.getByRole('button', { name: /cadastrar cliente/i }));

    await waitFor(() =>
      expect(customersApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PF', document: '111.444.777-35', name: 'Maria Souza', phone: '(11) 98888-7777' }),
      ),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('omits address from the payload when left blank', async () => {
    vi.mocked(customersApi.create).mockResolvedValue({ customer: { ...editingCustomer, id: 'new-id' } });
    const user = userEvent.setup();
    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText(/cpf ou cnpj/i), '11144477735');
    await user.type(screen.getByLabelText(/^nome$/i), 'Maria Souza');
    await user.type(screen.getByLabelText(/telefone/i), '11988887777');
    await user.click(screen.getByRole('button', { name: /cadastrar cliente/i }));

    await waitFor(() => expect(customersApi.create).toHaveBeenCalled());
    expect(customersApi.create).toHaveBeenCalledWith(expect.objectContaining({ address: undefined }));
  });

  it('includes only the filled-in address fields in the payload', async () => {
    vi.mocked(customersApi.create).mockResolvedValue({ customer: { ...editingCustomer, id: 'new-id' } });
    const user = userEvent.setup();
    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText(/cpf ou cnpj/i), '11144477735');
    await user.type(screen.getByLabelText(/^nome$/i), 'Maria Souza');
    await user.type(screen.getByLabelText(/telefone/i), '11988887777');

    await user.click(screen.getByRole('tab', { name: /endereço/i }));
    await user.type(screen.getByLabelText(/^rua$/i), 'Rua das Flores');
    await user.type(screen.getByLabelText(/^cidade$/i), 'São Paulo');

    await user.click(screen.getByRole('button', { name: /cadastrar cliente/i }));

    await waitFor(() =>
      expect(customersApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ address: { street: 'Rua das Flores', city: 'São Paulo' } }),
      ),
    );
  });

  it('submits only the editable fields in edit mode', async () => {
    vi.mocked(customersApi.update).mockResolvedValue({ customer: editingCustomer });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<CustomerFormModal open onOpenChange={onOpenChange} customer={editingCustomer} />);

    const phoneInput = screen.getByLabelText(/telefone/i);
    await user.clear(phoneInput);
    await user.type(phoneInput, '11777776666');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    await waitFor(() =>
      expect(customersApi.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c1', name: 'João da Silva', phone: '(11) 77777-6666' }),
      ),
    );
    expect(customersApi.update).not.toHaveBeenCalledWith(expect.objectContaining({ type: expect.anything() }));
  });

  it('keeps values entered in one tab after switching to another and back (Edge Case 5)', async () => {
    const user = userEvent.setup();
    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText(/^nome$/i), 'Maria Souza');

    await user.click(screen.getByRole('tab', { name: /contato/i }));
    await user.type(screen.getByLabelText(/^nome \(opcional\)$/i), 'José Souza');

    await user.click(screen.getByRole('tab', { name: /dados gerais/i }));
    expect(screen.getByLabelText(/^nome$/i)).toHaveValue('Maria Souza');

    await user.click(screen.getByRole('tab', { name: /contato/i }));
    expect(screen.getByLabelText(/^nome \(opcional\)$/i)).toHaveValue('José Souza');
  });

  it('submits contact and preference fields when filled', async () => {
    vi.mocked(customersApi.create).mockResolvedValue({ customer: { ...editingCustomer, id: 'new-id' } });
    const user = userEvent.setup();
    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText(/cpf ou cnpj/i), '11144477735');
    await user.type(screen.getByLabelText(/^nome$/i), 'Maria Souza');
    await user.type(screen.getByLabelText(/telefone/i), '11988887777');

    await user.click(screen.getByRole('tab', { name: /contato/i }));
    await user.type(screen.getByLabelText(/^nome \(opcional\)$/i), 'José Souza');
    await user.type(screen.getByLabelText(/relação/i), 'Cônjuge');

    await user.click(screen.getByRole('button', { name: /cadastrar cliente/i }));

    await waitFor(() =>
      expect(customersApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ secondaryContactName: 'José Souza', secondaryContactRelation: 'Cônjuge' }),
      ),
    );
  });

  it('disables the Histórico tab content in create mode without calling the API', async () => {
    const user = userEvent.setup();
    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} />);

    await user.click(screen.getByRole('tab', { name: /histórico/i }));

    expect(await screen.findByText(/disponível depois de salvar o cliente/i)).toBeInTheDocument();
    expect(serviceOrdersApi.list).not.toHaveBeenCalled();
  });

  it('loads the service order history in edit mode', async () => {
    vi.mocked(serviceOrdersApi.list).mockResolvedValue({
      items: [
        {
          id: 'so-1',
          tenantId: 't1',
          orderNumber: 1,
          customerId: 'c1',
          customerName: 'João da Silva',
          customerPhone: '11999999999',
          vehicleId: 'v1',
          vehicleBrand: 'Fiat',
          vehicleModel: 'Uno',
          vehiclePlate: 'ABC1D23',
          status: 'DELIVERED',
          openedAt: '2026-01-01T00:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
          totalAmountCents: 0,
          receivedAmountCents: 0,
          outstandingAmountCents: 0,
          paymentStatus: 'AWAITING_PAYMENT',
        },
      ],
      total: 1,
      offset: 0,
      limit: 20,
      hasMore: false,
    });
    const user = userEvent.setup();
    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} customer={editingCustomer} />);

    await user.click(screen.getByRole('tab', { name: /histórico/i }));

    await waitFor(() => expect(serviceOrdersApi.list).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'c1' })));
    expect(await screen.findByText(/Fiat Uno/i)).toBeInTheDocument();
  });

  it('paginates the Histórico tab for a customer with more than one page of service orders (Edge Case 4)', async () => {
    const soItem = (id: string) => ({
      id,
      tenantId: 't1',
      orderNumber: 2,
      customerId: 'c1',
      customerName: 'João da Silva',
      customerPhone: '11999999999',
      vehicleId: 'v1',
      vehicleBrand: 'Fiat',
      vehicleModel: 'Uno',
      vehiclePlate: 'ABC1D23',
      status: 'DELIVERED' as const,
      openedAt: '2026-01-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      totalAmountCents: 0,
      receivedAmountCents: 0,
      outstandingAmountCents: 0,
      paymentStatus: 'AWAITING_PAYMENT' as const,
    });
    vi.mocked(serviceOrdersApi.list).mockImplementation(async (request) => ({
      items: [soItem(request.offset === 0 ? 'so-page1' : 'so-page2')],
      total: 25,
      offset: request.offset,
      limit: 20,
      hasMore: request.offset === 0,
    }));
    const user = userEvent.setup();
    renderWithClient(<CustomerFormModal open onOpenChange={() => {}} customer={editingCustomer} />);

    await user.click(screen.getByRole('tab', { name: /histórico/i }));
    await waitFor(() => expect(serviceOrdersApi.list).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 })));

    const nextButton = screen.getByRole('button', { name: /próxima/i });
    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();
    await user.click(nextButton);

    await waitFor(() => expect(serviceOrdersApi.list).toHaveBeenCalledWith(expect.objectContaining({ offset: 20 })));
    expect(screen.getByRole('button', { name: /próxima/i })).toBeDisabled();
    // Clicking pagination inside the tab must never submit the outer customer form.
    expect(customersApi.update).not.toHaveBeenCalled();
  });
});

