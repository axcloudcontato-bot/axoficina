import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CustomerListItemResponse } from '@oficina/contracts';
import { CustomersTable } from '../CustomersTable';

const customer: CustomerListItemResponse = {
  id: 'c1',
  tenantId: 't1',
  type: 'PF',
  document: '11144477735',
  name: 'João da Silva',
  phone: '11999998888',
  createdAt: '2026-01-01T00:00:00Z',
};

function noop() {}

describe('CustomersTable', () => {
  it('shows a loading state', () => {
    render(<CustomersTable items={[]} isLoading isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} />);
    expect(screen.getByRole('status', { name: /carregando clientes/i })).toBeInTheDocument();
  });

  it('shows an error state with a retry button', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<CustomersTable items={[]} isLoading={false} isError onRetry={onRetry} canManage onEdit={noop} onDelete={noop} />);

    expect(screen.getByText(/não foi possível carregar os clientes/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows an empty state', () => {
    render(<CustomersTable items={[]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} />);
    expect(screen.getByText(/nenhum cliente ainda/i)).toBeInTheDocument();
  });

  it('renders customer rows with action buttons when canManage is true', () => {
    render(<CustomersTable items={[customer]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} />);

    expect(screen.getByText('João da Silva')).toBeInTheDocument();
    expect(screen.getByText('111.444.777-35')).toBeInTheDocument();
    expect(screen.getByText('(11) 99999-8888')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /arquivar/i })).toBeInTheDocument();
  });

  it('hides action buttons when canManage is false (MECHANIC)', () => {
    render(
      <CustomersTable items={[customer]} isLoading={false} isError={false} onRetry={noop} canManage={false} onEdit={noop} onDelete={noop} />,
    );

    expect(screen.getByText('João da Silva')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /arquivar/i })).not.toBeInTheDocument();
  });

  it('calls onEdit/onDelete with the clicked customer', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<CustomersTable items={[customer]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /editar/i }));
    expect(onEdit).toHaveBeenCalledWith(customer);

    await user.click(screen.getByRole('button', { name: /arquivar/i }));
    expect(onDelete).toHaveBeenCalledWith(customer);
  });

  it('formats a CNPJ and a phone stored with the country code, and shows a dash when there is no document', () => {
    const company: CustomerListItemResponse = { ...customer, id: 'c2', type: 'PJ', name: 'Frota LTDA', document: '11222333000181', phone: '5511988887777' };
    const noDocument: CustomerListItemResponse = { ...customer, id: 'c3', name: 'Sem Documento', document: '' };
    render(<CustomersTable items={[company, noDocument]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} />);
    expect(screen.getByText('11.222.333/0001-81')).toBeInTheDocument();
    expect(screen.getByText('(11) 98888-7777')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('tells a search with no match apart from an empty registry', () => {
    const { rerender } = render(<CustomersTable items={[]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} searching />);
    expect(screen.getByText(/nenhum cliente encontrado para essa busca/i)).toBeInTheDocument();
    expect(screen.queryByText(/cadastre o primeiro/i)).not.toBeInTheDocument();
    rerender(<CustomersTable items={[]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} archived />);
    expect(screen.getByText(/nenhum cliente arquivado/i)).toBeInTheDocument();
  });

  it('offers only "Reativar" for archived customers and calls it with the customer', async () => {
    const onRestore = vi.fn();
    const user = userEvent.setup();
    render(<CustomersTable items={[{ ...customer, archivedAt: '2026-10-01T12:00:00Z' }]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} archived onRestore={onRestore} />);
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /arquivar/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reativar/i }));
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
  });

  it('shows plates, last visit and spend, links the name to the customer page, and offers WhatsApp and a new order', () => {
    const withStats: CustomerListItemResponse = { ...customer, stats: { plates: ['ABC1D23', 'XYZ9K88', 'QWE4R56'], orderCount: 4, lastVisitAt: '2026-09-10T12:00:00Z', totalSpentCents: 123450 } };
    render(<CustomersTable items={[withStats, { ...customer, id: 'c9', name: 'Novo Cliente', stats: { plates: [], orderCount: 0, totalSpentCents: 0 } }]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} />);
    expect(screen.getByRole('link', { name: 'João da Silva' })).toHaveAttribute('href', '/clientes/c1');
    expect(screen.getByText('ABC1D23, XYZ9K88 +1')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s1\.234,50/)).toBeInTheDocument();
    expect(screen.getByText('Nunca')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'WhatsApp de João da Silva' })).toHaveAttribute('href', 'https://wa.me/5511999998888');
    expect(screen.getByRole('link', { name: 'Nova OS para João da Silva' }).getAttribute('href')).toContain('customerId=c1');
  });

  it('hides the spend column when the list came without money (no price permission)', () => {
    render(<CustomersTable items={[{ ...customer, stats: { plates: [], orderCount: 1 } }]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} />);
    expect(screen.queryByText('Total gasto')).not.toBeInTheDocument();
  });
});
