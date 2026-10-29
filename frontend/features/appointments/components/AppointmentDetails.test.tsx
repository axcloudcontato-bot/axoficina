import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AppointmentResponse } from '@oficina/contracts';
import { AppointmentDetails } from './AppointmentDetails';
import { appointmentsApi } from '../api/appointments-api';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../api/appointments-api', () => ({ appointmentsApi: { transition: vi.fn().mockResolvedValue({}), start: vi.fn() } }));

const base: AppointmentResponse = {
  id: 'a1', tenantId: 't1', customerId: 'c1', customerName: 'Maria', customerPhone: '(11) 99999-0000', vehicleId: 'v1', vehicleBrand: 'Fiat', vehicleModel: 'Uno', vehiclePlate: 'ABC1D23',
  startsAt: new Date(Date.now() + 86_400_000).toISOString(), endsAt: new Date(Date.now() + 90_000_000).toISOString(), serviceDescription: 'Revisão', status: 'SCHEDULED', createdBy: 'u1', createdAt: new Date().toISOString(),
};
const renderDetails = (appointment: AppointmentResponse) => render(<QueryClientProvider client={new QueryClient()}><AppointmentDetails appointment={appointment} open onOpenChange={vi.fn()} onEdit={vi.fn()} /></QueryClientProvider>);

describe('AppointmentDetails', () => {
  it('shows how to reach the customer', () => {
    renderDetails(base);
    expect(screen.getByRole('link', { name: '(11) 99999-0000' })).toHaveAttribute('href', 'tel:11999990000');
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/5511999990000');
  });

  it('only offers "não compareceu" after the scheduled time', () => {
    renderDetails(base);
    expect(screen.queryByRole('button', { name: 'Não compareceu' })).not.toBeInTheDocument();
  });

  it('asks for a reason before cancelling and sends it', async () => {
    const user = userEvent.setup();
    renderDetails(base);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(appointmentsApi.transition).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Confirmar cancelamento' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Motivo do cancelamento'), 'Cliente remarcou');
    await user.click(confirm);
    await waitFor(() => expect(vi.mocked(appointmentsApi.transition).mock.calls[0]?.[0]).toEqual({ id: 'a1', toStatus: 'CANCELLED', reason: 'Cliente remarcou' }));
  });

  it('lets the order close an appointment in service and links to it', () => {
    renderDetails({ ...base, status: 'IN_SERVICE', serviceOrderId: 'so-9' });
    expect(screen.getByRole('link', { name: 'Abrir OS' })).toHaveAttribute('href', '/ordens-de-servico/so-9');
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Concluir' })).not.toBeInTheDocument();
  });
});
