import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NewServiceOrderPage from './page';

vi.mock('@/features/customers/components/CustomerFormModal', () => ({
  CustomerFormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="customer-step" /> : null,
}));

vi.mock('@/features/vehicles/components/VehicleFormModal', () => ({
  VehicleFormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="vehicle-step" /> : null,
}));

vi.mock('@/features/service-orders/components/ServiceOrderFormModal', () => ({
  ServiceOrderFormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="order-step" /> : null,
}));

describe('NewServiceOrderPage', () => {
  it('inicia o atendimento pela etapa de cliente', () => {
    render(<NewServiceOrderPage />);

    expect(screen.getByText('1. Cliente').closest('[aria-current="step"]')).not.toBeNull();
    expect(screen.getByTestId('customer-step')).toBeInTheDocument();
    expect(screen.queryByTestId('order-step')).not.toBeInTheDocument();
    expect(screen.queryByText('Ainda não definido')).not.toBeInTheDocument();
    expect(screen.queryByText('Será selecionado na OS')).not.toBeInTheDocument();
  });
});
