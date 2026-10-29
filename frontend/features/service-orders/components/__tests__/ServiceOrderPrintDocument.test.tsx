import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ServiceOrderResponse } from '@oficina/contracts';
import { ServiceOrderPrintDocument } from '../ServiceOrderPrintDocument';

const serviceOrder: ServiceOrderResponse = {
  id: 'so1',
  tenantId: 't1',
  orderNumber: 42,
  customerId: 'c1',
  customerName: 'João da Silva',
  customerPhone: '11999999999',
  vehicleId: 'v1',
  vehicleBrand: 'Fiat',
  vehicleModel: 'Uno',
  vehiclePlate: 'ABC1D23',
  status: 'IN_PROGRESS',
  entryMileage: 82450,
  customerComplaint: 'Ruído ao frear',
  receptionNotes: 'Risco na porta direita',
  diagnosis: 'Pastilhas dianteiras desgastadas',
  recommendedService: 'Substituir pastilhas',
  technicianName: 'Carlos Lima',
  expectedDeliveryAt: '2026-07-28T18:00:00Z',
  openedAt: '2026-07-27T12:00:00Z',
  createdAt: '2026-07-27T12:00:00Z',
  checklist: {
    version: 1,
    items: [{ id: 'brakes', label: 'Freios', status: 'critical', note: 'Trocar pastilhas' }],
  },
  totalAmountCents: 35000, discountCents: 0,
  receivedAmountCents: 0,
  outstandingAmountCents: 35000,
  paymentStatus: 'AWAITING_PAYMENT',
  items: [{
    id: 'item1',
    serviceOrderId: 'so1',
    type: 'PART',
    description: 'Jogo de pastilhas',
    quantity: 1,
    unitPriceCents: 35000,
    lineTotalCents: 35000,
    createdAt: '2026-07-27T13:00:00Z',
  }],
  statusHistory: [{
    id: 'history1',
    fromStatus: 'OPEN',
    toStatus: 'IN_PROGRESS',
    changedBy: 'user1',
    changedAt: '2026-07-27T13:30:00Z',
  }],
};

describe('ServiceOrderPrintDocument', () => {
  it('renders two approval copies with parts and labor, without technical request fields', () => {
    render(<ServiceOrderPrintDocument serviceOrder={serviceOrder} mode="summary" />);

    expect(screen.getAllByText('OS #00042')).toHaveLength(2);
    expect(screen.getAllByText('Via da oficina')).toHaveLength(1);
    expect(screen.getAllByText('Via do cliente')).toHaveLength(1);
    expect(screen.getByText('✂ Recorte')).toBeInTheDocument();
    expect(screen.getAllByText('Jogo de pastilhas')).toHaveLength(2);
    expect(screen.getAllByText('R$ 350,00').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Ruído ao frear')).not.toBeInTheDocument();
    expect(screen.queryByText('Substituir pastilhas')).not.toBeInTheDocument();
    expect(screen.queryByText('Inspeção técnica')).not.toBeInTheDocument();
    expect(screen.queryByText('Histórico da OS')).not.toBeInTheDocument();
  });

  it('renders inspection, diagnosis, items and history in the complete version', () => {
    render(<ServiceOrderPrintDocument serviceOrder={serviceOrder} mode="full" />);

    expect(screen.getByText('Inspeção técnica')).toBeInTheDocument();
    expect(screen.getByText('Pastilhas dianteiras desgastadas')).toBeInTheDocument();
    expect(screen.getByText('Jogo de pastilhas')).toBeInTheDocument();
    expect(screen.getByText('Histórico da OS')).toBeInTheDocument();
  });
});

