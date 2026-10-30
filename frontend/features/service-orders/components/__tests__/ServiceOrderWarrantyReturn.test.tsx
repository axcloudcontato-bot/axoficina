import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceOrderWarrantyReturn } from '../ServiceOrderWarrantyReturn';

const mocks = vi.hoisted(() => ({ mark: vi.fn(), data: null as unknown }));
vi.mock('../../hooks/use-service-orders', () => ({
  useWarrantyReturn: () => ({ data: mocks.data }),
  useMarkWarrantyReturn: () => ({ mutate: mocks.mark, isPending: false, isError: false }),
}));

const candidates = [{ id: 'o7', orderNumber: 7, deliveredAt: '2026-10-01T12:00:00.000Z', warrantyDays: 90, technicianName: 'Ana' }, { id: 'o5', orderNumber: 5, deliveredAt: '2026-09-01T12:00:00.000Z', warrantyDays: 90, technicianName: null }];

describe('ServiceOrderWarrantyReturn', () => {
  beforeEach(() => { mocks.mark.mockReset(); mocks.data = { current: null, candidates }; });

  it('stays out of the way when the vehicle has no order under warranty', () => {
    mocks.data = { current: null, candidates: [] };
    const { container } = render(<ServiceOrderWarrantyReturn serviceOrderId="new" canManage />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the order as a return of the chosen earlier order', async () => {
    const user = userEvent.setup();
    render(<ServiceOrderWarrantyReturn serviceOrderId="new" canManage />);
    expect(screen.getByText('Este veículo ainda está na garantia')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('OS original'), 'o5');
    await user.type(screen.getByLabelText('O que voltou (opcional)'), 'Barulho voltou');
    await user.click(screen.getByRole('button', { name: 'Marcar como retorno' }));
    expect(mocks.mark).toHaveBeenCalledWith({ originalOrderId: 'o5', reason: 'Barulho voltou' });
  });

  it('shows a marked return and lets a manager undo it', async () => {
    mocks.data = { current: { originalOrderId: 'o7', orderNumber: 7, reason: 'Barulho voltou' }, candidates };
    const user = userEvent.setup();
    render(<ServiceOrderWarrantyReturn serviceOrderId="new" canManage />);
    expect(screen.getByRole('link', { name: 'OS #7' })).toHaveAttribute('href', '/ordens-de-servico/o7');
    await user.click(screen.getByRole('button', { name: 'Não é retorno' }));
    expect(mocks.mark).toHaveBeenCalledWith({ originalOrderId: null });
  });

  it('only shows the marking to people who manage orders', () => {
    const { container } = render(<ServiceOrderWarrantyReturn serviceOrderId="new" canManage={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
