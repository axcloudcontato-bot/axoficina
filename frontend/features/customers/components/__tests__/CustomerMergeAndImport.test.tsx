import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerListItemResponse, CustomerResponse } from '@oficina/contracts';
import { customersApi } from '../../api/customers-api';
import { CustomerImportModal } from '../CustomerImportModal';
import { MergeCustomerDialog } from '../MergeCustomerDialog';

vi.mock('../../api/customers-api', () => ({ customersApi: { list: vi.fn(), merge: vi.fn(), importRows: vi.fn() } }));
const { toastMock } = vi.hoisted(() => ({ toastMock: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('sonner', () => ({ toast: toastMock }));

const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>);
const customer: CustomerResponse = { id: 'keep', tenantId: 't', type: 'PF', document: '', name: 'João da Silva', phone: '11999998888', createdAt: '2026-01-01T00:00:00Z' };
const duplicate: CustomerListItemResponse = { ...customer, id: 'dup', name: 'Joao Silva', phone: '11999998888' };
const company: CustomerListItemResponse = { ...customer, id: 'co', type: 'PJ', name: 'Silva Auto LTDA' };

describe('MergeCustomerDialog', () => {
  beforeEach(() => { vi.mocked(customersApi.merge).mockReset(); toastMock.success.mockClear(); });

  it('searches, shows only other customers of the same type, asks for confirmation and merges', async () => {
    vi.mocked(customersApi.list).mockResolvedValue({ items: [{ ...customer }, duplicate, company], total: 3, offset: 0, limit: 8, hasMore: false });
    vi.mocked(customersApi.merge).mockResolvedValue({ customer, movedVehicles: 2, movedServiceOrders: 5 });
    const onMerged = vi.fn();
    const user = userEvent.setup();
    wrap(<MergeCustomerDialog customer={customer} open onOpenChange={() => {}} onMerged={onMerged} />);

    await user.type(screen.getByLabelText('Buscar o cadastro duplicado'), 'silva');
    expect(await screen.findByRole('button', { name: /Joao Silva/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Silva Auto/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /João da Silva/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Joao Silva/ }));
    expect(screen.getByText(/será arquivado/)).toBeInTheDocument();
    expect(customersApi.merge).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Juntar cadastros' }));
    await waitFor(() => expect(customersApi.merge).toHaveBeenCalledWith({ keepId: 'keep', mergeId: 'dup' }));
    await waitFor(() => expect(onMerged).toHaveBeenCalled());
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining('2 veículos'));
  });
});

describe('CustomerImportModal', () => {
  it('reads the chosen file, imports it and tells which rows were left out', async () => {
    vi.mocked(customersApi.importRows).mockResolvedValue({ created: 1, problems: [{ line: 3, name: 'Maria', reason: 'Já existe um cliente com este nome e telefone.' }] });
    const user = userEvent.setup();
    wrap(<CustomerImportModal open onOpenChange={() => {}} />);

    const file = new File(['nome;telefone\nAna;11988887777\nMaria;11977776666\n'], 'clientes.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('Arquivo CSV'), file);
    expect(await screen.findByText(/clientes prontos para importar/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Importar 2 clientes' }));
    await waitFor(() => expect(vi.mocked(customersApi.importRows).mock.calls[0]?.[0]).toEqual({ rows: [{ line: 2, name: 'Ana', phone: '11988887777' }, { line: 3, name: 'Maria', phone: '11977776666' }] }));
    expect(await screen.findByText(/Linha 3 \(Maria\): Já existe um cliente com este nome e telefone\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Importar/ })).not.toBeInTheDocument();
  });

  it('does not offer to import a file with nothing usable', async () => {
    const user = userEvent.setup();
    wrap(<CustomerImportModal open onOpenChange={() => {}} />);
    await user.upload(screen.getByLabelText('Arquivo CSV'), new File(['marca;cor\nX;Y\n'], 'errado.csv', { type: 'text/csv' }));
    expect(await screen.findByText(/Não encontrei a coluna "Nome"/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar 0 clientes' })).toBeDisabled();
  });
});
