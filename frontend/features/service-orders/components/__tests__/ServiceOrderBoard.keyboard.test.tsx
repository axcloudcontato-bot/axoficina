import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ServiceOrderListItemResponse } from '@oficina/contracts';
import { ServiceOrderBoard } from '../ServiceOrderBoard';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('@/features/service-orders/hooks/use-service-orders', () => ({ useTransitionServiceOrder: () => ({ mutate, isPending: false }) }));
const order: ServiceOrderListItemResponse = { id: 'so1', tenantId: 't1', orderNumber: 1, customerId: 'c1', customerName: 'Maria', customerPhone: '11999998888', vehicleId: 'v1', vehicleBrand: 'Fiat', vehicleModel: 'Uno', vehiclePlate: 'ABC1D23', status: 'IN_PROGRESS', openedAt: '2026-10-24T00:00:00Z', createdAt: '2026-10-24T00:00:00Z', totalAmountCents: 0, receivedAmountCents: 0, outstandingAmountCents: 0, paymentStatus: 'AWAITING_PAYMENT' };

describe('board keyboard alternative to dragging', () => {
  it('offers all valid transitions and only sends the chosen move after confirmation', async () => {
    mutate.mockClear(); const user = userEvent.setup();
    render(<ServiceOrderBoard items={[order]} isLoading={false} isError={false} onRetry={vi.fn()} canManage canViewPrices={false} />);
    const selector = screen.getByRole('combobox', { name: 'Mover OS #1 para outra etapa' });
    await user.selectOptions(selector, 'WAITING_PARTS');
    expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(mutate).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(selector).toHaveFocus());
    await user.selectOptions(selector, 'CANCELLED');
    const confirm = screen.getByRole('button', { name: 'Confirmar mudança' }); confirm.focus();
    await user.keyboard('{Enter}');
    expect(mutate).toHaveBeenCalledWith({ id: 'so1', toStatus: 'CANCELLED' }, expect.any(Object));
  });
});
