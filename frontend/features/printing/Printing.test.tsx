import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ServiceOrderResponse } from '@oficina/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrintSettingsForm } from './PrintSettingsForm';
import { DEFAULT_PRINT_PREFERENCES, pageStyle, parsePaperFormat, usePrintPreferences } from './print-preferences';
import { ThermalServiceOrderTicket } from './ThermalServiceOrderTicket';

const order = {
  id: 'so1', orderNumber: 12, status: 'COMPLETED', openedAt: '2026-11-13T10:00:00Z', customerName: 'Maria Cliente', customerPhone: '11999990000',
  vehicleBrand: 'VW', vehicleModel: 'Gol', vehiclePlate: 'ABC1D23', entryMileage: 50000, technicianName: 'João', customerComplaint: 'Barulho no freio',
  items: [
    { id: 'i1', serviceOrderId: 'so1', type: 'LABOR', description: 'Troca de pastilhas', quantity: 1, unitPriceCents: 12000, lineTotalCents: 12000, createdAt: '' },
    { id: 'i2', serviceOrderId: 'so1', type: 'PART', description: 'Pastilha dianteira', quantity: 2, unitPriceCents: 4000, lineTotalCents: 8000, createdAt: '' },
  ],
  discountCents: 1000, totalAmountCents: 19000, receivedAmountCents: 5000, outstandingAmountCents: 14000, paymentMethod: 'CREDIT_CARD', paymentInstallments: 3, warrantyDays: 90,
} as unknown as ServiceOrderResponse;

describe('print preferences', () => {
  beforeEach(() => usePrintPreferences.getState().reset());

  it('reads the paper from links and builds page rules for each paper', () => {
    expect(parsePaperFormat('80mm')).toBe('THERMAL_80');
    expect(parsePaperFormat('58mm')).toBe('THERMAL_58');
    expect(parsePaperFormat('a4')).toBe('A4');
    expect(parsePaperFormat('x')).toBeUndefined();
    expect(pageStyle('A4', { a4MarginMm: 10, thermalMarginMm: 2 })).toContain('size: A4 portrait; margin: 10mm');
    expect(pageStyle('A4', { a4MarginMm: 10, thermalMarginMm: 2 })).toContain('height: 276mm');
    expect(pageStyle('A4', { a4MarginMm: 99, thermalMarginMm: 2 })).toContain('margin: 25mm');
    expect(pageStyle('THERMAL_80', { a4MarginMm: 12, thermalMarginMm: 3 })).toContain('margin: 3mm 3mm 7mm 3mm');
    expect(pageStyle('THERMAL_58', { a4MarginMm: 12, thermalMarginMm: Number.NaN })).toContain('margin: 0mm');
  });

  it('saves the choices of this computer and resets to the defaults', async () => {
    const user = userEvent.setup();
    render(<PrintSettingsForm />);
    await user.click(screen.getByRole('radio', { name: /Bobina térmica de 80 mm/ }));
    await user.click(screen.getByRole('checkbox', { name: /Abrir a impressão sozinha/ }));
    expect(usePrintPreferences.getState()).toMatchObject({ serviceOrderFormat: 'THERMAL_80', autoPrint: true });
    expect(JSON.parse(localStorage.getItem('ofix-print-preferences') ?? '{}').state.serviceOrderFormat).toBe('THERMAL_80');
    await user.click(screen.getByRole('button', { name: /Voltar ao padrão/ }));
    expect(usePrintPreferences.getState()).toMatchObject(DEFAULT_PRINT_PREFERENCES);
  });

  it('opens the test page of the chosen paper', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const user = userEvent.setup();
    render(<PrintSettingsForm />);
    await user.click(screen.getByRole('button', { name: /Página de teste 58 mm/ }));
    expect(open).toHaveBeenCalledWith('/impressao/teste?formato=58mm', '_blank', 'noopener,noreferrer');
  });
});

describe('ThermalServiceOrderTicket', () => {
  const company = { name: 'Oficina Boa', document: '11.222.333/0001-81', addressStreet: 'Rua A', addressNumber: '10', addressCity: 'São Paulo', addressState: 'SP', phone: '1133334444', documentFooter: 'Volte sempre' };

  it('prints the order on the roll with totals, payment and the no-tax-value notice', () => {
    render(<ThermalServiceOrderTicket serviceOrder={order} company={company} options={{ format: 'THERMAL_80', fontSize: 'normal', copies: 1, showLogo: true }} />);
    expect(screen.getByText(/ORDEM DE SERVIÇO Nº 00012/)).toBeInTheDocument();
    expect(screen.getByText('CNPJ 11.222.333/0001-81')).toBeInTheDocument();
    expect(screen.getByText(/Pastilha dianteira/)).toBeInTheDocument();
    expect(screen.getByText('TOTAL').nextSibling).toHaveTextContent('190,00');
    expect(screen.getByText('Desconto').nextSibling).toHaveTextContent('10,00');
    expect(screen.getByText('Saldo').nextSibling).toHaveTextContent('140,00');
    expect(screen.getByText(/Cartão de crédito em 3x/)).toBeInTheDocument();
    expect(screen.getByText('Garantia dos serviços: 90 dias.')).toBeInTheDocument();
    expect(screen.getByText('DOCUMENTO SEM VALOR FISCAL')).toBeInTheDocument();
    expect(document.querySelector('.thermal-ticket')).toHaveStyle({ width: '72mm' });
  });

  it('prints two copies on 58 mm and hides prices from whoever may not see them', () => {
    render(<ThermalServiceOrderTicket serviceOrder={order} company={company} showPrices={false} options={{ format: 'THERMAL_58', fontSize: 'large', copies: 2, showLogo: false }} />);
    expect(screen.getByText('Via da oficina')).toBeInTheDocument();
    expect(screen.getByText('Via do cliente')).toBeInTheDocument();
    expect(screen.queryByText('TOTAL')).not.toBeInTheDocument();
    const tickets = document.querySelectorAll('.thermal-ticket');
    expect(tickets).toHaveLength(2);
    expect(tickets[0]).toHaveClass('break-after-page');
    expect(tickets[1]).not.toHaveClass('break-after-page');
    expect(tickets[0]).toHaveStyle({ width: '48mm', fontSize: '13px' });
  });
});
