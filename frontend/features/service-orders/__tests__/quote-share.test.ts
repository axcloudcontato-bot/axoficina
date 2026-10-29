import { describe, expect, it } from 'vitest';
import type { ServiceOrderResponse } from '@oficina/contracts';
import { buildEmailQuoteUrl, buildQuoteMessage, buildWhatsAppQuoteUrl, normalizeBrazilianPhone } from '../quote-share';

const serviceOrder: ServiceOrderResponse = {
  id: 'order-1',
  tenantId: 'tenant-1',
  orderNumber: 12,
  customerId: 'customer-1',
  customerName: 'Sergio Oliveira',
  customerPhone: '(12) 99999-9999',
  vehicleId: 'vehicle-1',
  vehicleBrand: 'Honda',
  vehicleModel: 'HR-V',
  vehiclePlate: 'MOB2024',
  status: 'OPEN',
  openedAt: '2026-07-27T12:00:00Z',
  createdAt: '2026-07-27T12:00:00Z',
  totalAmountCents: 35_000,
  discountCents: 0,
  receivedAmountCents: 0,
  outstandingAmountCents: 35_000,
  paymentStatus: 'AWAITING_PAYMENT',
  items: [{
    id: 'item-1',
    serviceOrderId: 'order-1',
    type: 'PART',
    description: 'Pastilha de freio',
    quantity: 1,
    unitPriceCents: 35_000,
    lineTotalCents: 35_000,
    createdAt: '2026-07-27T12:00:00Z',
  }],
};

describe('quote sharing', () => {
  it('builds a customer-facing message with items and total', () => {
    const message = buildQuoteMessage(serviceOrder);
    expect(message).toContain('OS #00012');
    expect(message).toContain('Pastilha de freio');
    expect(message).toContain('R$ 350,00');
  });

  it('shows the discount before the net total', () => {
    const message = buildQuoteMessage({ ...serviceOrder, discountCents: 5_000, totalAmountCents: 30_000 });
    expect(message).toContain('Desconto');
    expect(message).toMatch(/R\$\s50,00/);
    expect(message).toMatch(/R\$\s300,00/);
    expect(buildQuoteMessage(serviceOrder)).not.toContain('Desconto');
  });

  it('normalizes valid Brazilian phones and rejects invalid ones', () => {
    expect(normalizeBrazilianPhone('(12) 99999-9999')).toBe('5512999999999');
    expect(normalizeBrazilianPhone('+55 12 99999-9999')).toBe('5512999999999');
    expect(normalizeBrazilianPhone('123')).toBeNull();
  });

  it('creates encoded WhatsApp and email links', () => {
    expect(buildWhatsAppQuoteUrl(serviceOrder.customerPhone, serviceOrder)).toMatch(/^https:\/\/wa\.me\/5512999999999\?text=/);
    expect(buildEmailQuoteUrl('cliente@example.com', serviceOrder)).toContain('mailto:cliente@example.com?');
    expect(buildEmailQuoteUrl('', serviceOrder)).toBeNull();
  });
});
