import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';
import { AgendaHoursSettings } from './AgendaHoursSettings';
import { OrderDefaultsSettings } from './OrderDefaultsSettings';

const mocks = vi.hoisted(() => ({ agenda: vi.fn(), defaults: vi.fn(), rate: vi.fn(), months: vi.fn() }));
vi.mock('../hooks/use-settings', () => ({
  useBranding: () => ({ isPending: false, isError: false, data: { whatsappEnabled: true, agendaHours: { openHour: 8, closeHour: 18, workDays: [1, 2, 3, 4, 5, 6], bays: null, remindersEnabled: false, dayHours: {}, closedDates: [] } } }),
  useUpdateAgendaHours: () => ({ mutate: mocks.agenda, isPending: false }),
  useOrderDefaults: () => ({ defaultWarrantyDays: null, quoteValidityDays: null, documentTerms: null, acceptedPaymentMethods: [] }),
  useUpdateOrderDefaults: () => ({ mutate: mocks.defaults, isPending: false }),
  useLaborRate: () => 12000,
  useMaintenanceAlertMonths: () => 6,
  useUpdateLaborRate: () => ({ mutate: mocks.rate, isPending: false }),
  useUpdateMaintenanceAlertMonths: () => ({ mutate: mocks.months, isPending: false }),
}));
vi.mock('../hooks/use-unsaved-settings', () => ({ useUnsavedSettings: () => undefined }));

describe('Operation settings', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    useAuthStore.setState({ user: { id: 'u1', tenantId: 't1', name: 'Dono', email: 'dono@oficina.com', role: 'ADMIN', permissions: ['settings.view', 'settings.manage', 'service_orders.prices'], status: 'active', createdAt: '2026-10-01T00:00:00Z' } as never });
  });

  it('saves Saturday until noon and a holiday', async () => {
    const user = userEvent.setup();
    render(<AgendaHoursSettings />);
    await user.click(screen.getByRole('checkbox', { name: 'Sábado' }));
    await user.selectOptions(screen.getByLabelText('Sábado: fecha às'), '12');
    await user.type(screen.getByLabelText('Data fechada'), '2030-12-25');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: 'Salvar horário' }));
    expect(mocks.agenda).toHaveBeenCalledWith(expect.objectContaining({ dayHours: { '6': { openHour: 8, closeHour: 12 } }, closedDates: ['2030-12-25'] }), expect.anything());
  });

  it('refuses a day that closes before it opens', async () => {
    const user = userEvent.setup();
    render(<AgendaHoursSettings />);
    await user.click(screen.getByRole('checkbox', { name: 'Sábado' }));
    await user.selectOptions(screen.getByLabelText('Sábado: abre às'), '14');
    expect(screen.getByRole('alert')).toHaveTextContent('Sábado: o fechamento deve ser depois da abertura');
    expect(screen.getByRole('button', { name: 'Salvar horário' })).toBeDisabled();
  });

  it('saves what every new order and printed document starts with', async () => {
    const user = userEvent.setup();
    render(<OrderDefaultsSettings />);
    await user.type(screen.getByLabelText('Garantia padrão (dias)'), '90');
    await user.type(screen.getByLabelText('Validade do orçamento (dias)'), '7');
    await user.type(screen.getByLabelText('Termos e condições'), 'Peças trocadas ficam 30 dias à disposição.');
    await user.click(screen.getByRole('checkbox', { name: 'PIX' }));
    await user.click(screen.getByRole('checkbox', { name: 'Dinheiro' }));
    await user.click(screen.getByRole('button', { name: 'Salvar padrões' }));
    expect(mocks.defaults).toHaveBeenCalledWith({ defaultWarrantyDays: 90, quoteValidityDays: 7, documentTerms: 'Peças trocadas ficam 30 dias à disposição.', acceptedPaymentMethods: ['PIX', 'CASH'] }, expect.anything());
  });

  it('keeps the labor hour and the alert period in the same place', async () => {
    const user = userEvent.setup();
    render(<OrderDefaultsSettings />);
    expect(screen.getByLabelText('Valor da hora da oficina')).toHaveValue('120,00');
    await user.clear(screen.getByLabelText('Valor da hora da oficina'));
    await user.type(screen.getByLabelText('Valor da hora da oficina'), '150');
    await user.click(screen.getAllByRole('button', { name: 'Salvar' })[0]);
    expect(mocks.rate).toHaveBeenCalledWith({ laborRateCents: 15000 }, expect.anything());
  });
});
