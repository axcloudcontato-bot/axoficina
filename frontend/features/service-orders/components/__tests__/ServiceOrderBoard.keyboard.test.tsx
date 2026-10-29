import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ServiceOrderListItemResponse } from '@oficina/contracts';
import { ServiceOrderBoard, sortByUrgency } from '../ServiceOrderBoard';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('@/features/service-orders/hooks/use-service-orders', () => ({ useTransitionServiceOrder: () => ({ mutate, isPending: false }) }));
const order: ServiceOrderListItemResponse = { id: 'so1', tenantId: 't1', orderNumber: 1, customerId: 'c1', customerName: 'Maria', customerPhone: '11999998888', vehicleId: 'v1', vehicleBrand: 'Fiat', vehicleModel: 'Uno', vehiclePlate: 'ABC1D23', status: 'IN_PROGRESS', openedAt: '2026-10-24T00:00:00Z', createdAt: '2026-10-24T00:00:00Z', totalAmountCents: 0, discountCents: 0, receivedAmountCents: 0, outstandingAmountCents: 0, paymentStatus: 'AWAITING_PAYMENT' };

describe('board keyboard alternative to dragging', () => {
  it('offers the valid transitions, never cancellation, and only sends the chosen move after confirmation', async () => {
    mutate.mockClear(); const user = userEvent.setup();
    render(<ServiceOrderBoard items={[order]} isLoading={false} isError={false} onRetry={vi.fn()} canManage canViewPrices={false} />);
    const selector = screen.getByRole('combobox', { name: 'Mover OS #1 para outra etapa' });
    await user.selectOptions(selector, 'WAITING_PARTS');
    expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(mutate).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(selector).toHaveFocus());
    expect(screen.queryByRole('option', { name: 'Cancelada' })).not.toBeInTheDocument();
    await user.selectOptions(selector, 'WAITING_PARTS');
    const confirm = screen.getByRole('button', { name: 'Confirmar mudança' }); confirm.focus();
    await user.keyboard('{Enter}');
    expect(mutate).toHaveBeenCalledWith({ id: 'so1', toStatus: 'WAITING_PARTS' }, expect.any(Object));
  });

  it('lists overdue orders first, then the nearest promised delivery, then whoever waited longest', () => {
    const base = { ...order, expectedDeliveryAt: undefined };
    const ids = sortByUrgency([
      { ...base, id: 'no-date-old', statusSince: '2026-10-01T00:00:00Z' },
      { ...base, id: 'later', expectedDeliveryAt: '2999-02-01T00:00:00Z' },
      { ...base, id: 'overdue', expectedDeliveryAt: '2020-01-01T00:00:00Z' },
      { ...base, id: 'soon', expectedDeliveryAt: '2999-01-01T00:00:00Z' },
      { ...base, id: 'no-date-new', statusSince: '2026-10-20T00:00:00Z' },
    ]).map((item) => item.id);
    expect(ids).toEqual(['overdue', 'soon', 'later', 'no-date-old', 'no-date-new']);
  });
});
