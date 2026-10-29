import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewServiceOrderPage from './page';

const { search } = vi.hoisted(() => ({ search: { value: '' } }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search.value) }));

vi.mock('@/features/customers/components/CustomerFormModal', () => ({
  CustomerFormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="customer-step" /> : null,
}));

vi.mock('@/features/vehicles/components/VehicleFormModal', () => ({
  VehicleFormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="vehicle-step" /> : null,
}));

vi.mock('@/features/service-orders/components/ServiceOrderFormModal', () => ({
  ServiceOrderFormModal: ({ open, initialCustomer, initialVehicleId, initialVehicleLabel }: { open: boolean; initialCustomer?: { id: string; name: string }; initialVehicleId?: string; initialVehicleLabel?: string }) =>
    open ? <div data-testid="order-step" data-customer={initialCustomer?.name} data-vehicle={initialVehicleId} data-label={initialVehicleLabel} /> : null,
}));

describe('NewServiceOrderPage', () => {
  beforeEach(() => { search.value = ''; });

  it('inicia o atendimento pela etapa de cliente', () => {
    render(<NewServiceOrderPage />);

    expect(screen.getByText('1. Cliente').closest('[aria-current="step"]')).not.toBeNull();
    expect(screen.getByTestId('customer-step')).toBeInTheDocument();
    expect(screen.queryByTestId('order-step')).not.toBeInTheDocument();
    expect(screen.queryByText('Ainda não definido')).not.toBeInTheDocument();
    expect(screen.queryByText('Será selecionado na OS')).not.toBeInTheDocument();
  });

  it('vindo da ficha do cliente, já abre a etapa da OS com o cliente e o veículo escolhidos', () => {
    search.value = 'customerId=c1&customerName=Jo%C3%A3o+da+Silva&vehicleId=v1&vehicleLabel=Fiat+Uno+%C2%B7+ABC1D23';
    render(<NewServiceOrderPage />);

    expect(screen.queryByTestId('customer-step')).not.toBeInTheDocument();
    expect(screen.getByTestId('order-step')).toHaveAttribute('data-customer', 'João da Silva');
    expect(screen.getByTestId('order-step')).toHaveAttribute('data-vehicle', 'v1');
    expect(screen.getByTestId('order-step')).toHaveAttribute('data-label', 'Fiat Uno · ABC1D23');
  });

  it('ignora um veículo sem cliente na URL', () => {
    search.value = 'vehicleId=v1&vehicleLabel=Fiat';
    render(<NewServiceOrderPage />);

    expect(screen.getByTestId('customer-step')).toBeInTheDocument();
    expect(screen.queryByTestId('order-step')).not.toBeInTheDocument();
  });
});
