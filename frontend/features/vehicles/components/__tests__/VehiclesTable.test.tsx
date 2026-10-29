import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { VehicleListItemResponse } from '@oficina/contracts';
import { VehiclesTable } from '../VehiclesTable';

const vehicle: VehicleListItemResponse = {
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

function noop() {}

describe('VehiclesTable', () => {
  it('shows a loading state', () => {
    render(<VehiclesTable items={[]} isLoading isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} />);
    expect(screen.getByRole('status', { name: /carregando veículos/i })).toBeInTheDocument();
  });

  it('shows an error state with a retry button', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<VehiclesTable items={[]} isLoading={false} isError onRetry={onRetry} canManage onEdit={noop} onDelete={noop} />);

    expect(screen.getByText(/não foi possível carregar os veículos/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows an empty state', () => {
    render(<VehiclesTable items={[]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} />);
    expect(screen.getByText(/nenhum veículo ainda/i)).toBeInTheDocument();
  });

  it('renders vehicle rows with the owning customer name and action buttons when canManage is true', () => {
    render(<VehiclesTable items={[vehicle]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} />);

    expect(screen.getByText('Fiat')).toBeInTheDocument();
    expect(screen.getByText('ABC1D23')).toBeInTheDocument();
    expect(screen.getByText('João da Silva')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /arquivar/i })).toBeInTheDocument();
  });

  it('hides action buttons when canManage is false (MECHANIC)', () => {
    render(<VehiclesTable items={[vehicle]} isLoading={false} isError={false} onRetry={noop} canManage={false} onEdit={noop} onDelete={noop} />);

    expect(screen.getByText('Fiat')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /arquivar/i })).not.toBeInTheDocument();
  });

  it('calls onEdit/onDelete with the clicked vehicle', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<VehiclesTable items={[vehicle]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /editar/i }));
    expect(onEdit).toHaveBeenCalledWith(vehicle);

    await user.click(screen.getByRole('button', { name: /arquivar/i }));
    expect(onDelete).toHaveBeenCalledWith(vehicle);
  });

  it('writes the plate the way people read it and links the owner to the customer page', () => {
    render(<VehiclesTable items={[{ ...vehicle, plate: 'ABC1234' }, { ...vehicle, id: 'v2', plate: 'XYZ9K88' }]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} />);
    expect(screen.getByText('ABC-1234')).toBeInTheDocument();
    expect(screen.getByText('XYZ9K88')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'João da Silva' })[0]).toHaveAttribute('href', '/clientes/c1');
  });

  it('tells a search with no match apart from an empty registry and from no archived vehicles', () => {
    const { rerender } = render(<VehiclesTable items={[]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} searching />);
    expect(screen.getByText(/nenhum veículo encontrado para essa busca/i)).toBeInTheDocument();
    expect(screen.queryByText(/cadastre o primeiro/i)).not.toBeInTheDocument();
    rerender(<VehiclesTable items={[]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} archived />);
    expect(screen.getByText(/nenhum veículo arquivado/i)).toBeInTheDocument();
  });

  it('offers only "Reativar" for archived vehicles and calls it with the vehicle', async () => {
    const onRestore = vi.fn();
    const user = userEvent.setup();
    render(<VehiclesTable items={[{ ...vehicle, archivedAt: '2026-10-01T12:00:00Z' }]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} archived onRestore={onRestore} />);
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /arquivar/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reativar/i }));
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1' }));
  });

  it('shows year, mileage, orders and last visit, links the plate to the vehicle page and offers a new order', () => {
    const rich: VehicleListItemResponse = { ...vehicle, year: 2012, mileage: 98000, stats: { orderCount: 4, lastVisitAt: '2026-09-20T12:00:00Z' } };
    render(<VehiclesTable items={[rich, { ...vehicle, id: 'v2', plate: 'XYZ9K88', stats: { orderCount: 0 } }]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} />);
    expect(screen.getByRole('link', { name: 'ABC1D23' })).toHaveAttribute('href', '/veiculos/v1');
    expect(screen.getByText('2012')).toBeInTheDocument();
    expect(screen.getByText('98.000')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('20/09/2026')).toBeInTheDocument();
    expect(screen.getByText('Nunca')).toBeInTheDocument();
    const href = screen.getByRole('link', { name: 'Nova OS para ABC1D23' }).getAttribute('href') ?? '';
    expect(href).toContain('customerId=c1');
    expect(href).toContain('vehicleId=v1');
  });

  it('sorts by clicking the Placa, Ano and Km headers, marking the active column and direction', async () => {
    const onSort = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<VehiclesTable items={[vehicle]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} onSort={onSort} />);
    await user.click(screen.getByRole('button', { name: 'Ano' }));
    expect(onSort).toHaveBeenLastCalledWith('year');
    await user.click(screen.getByRole('button', { name: 'Km' }));
    expect(onSort).toHaveBeenLastCalledWith('mileage');
    await user.click(screen.getByRole('button', { name: 'Placa' }));
    expect(onSort).toHaveBeenLastCalledWith('plate');
    expect(screen.getByRole('columnheader', { name: 'Ano' })).toHaveAttribute('aria-sort', 'none');

    rerender(<VehiclesTable items={[vehicle]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} onSort={onSort} sort="mileage" direction="desc" />);
    expect(screen.getByRole('columnheader', { name: /Km/ })).toHaveAttribute('aria-sort', 'descending');
    rerender(<VehiclesTable items={[vehicle]} isLoading={false} isError={false} onRetry={noop} canManage onEdit={noop} onDelete={noop} onSort={onSort} sort="plate" />);
    expect(screen.getByRole('columnheader', { name: /Placa/ })).toHaveAttribute('aria-sort', 'ascending');
  });
});
