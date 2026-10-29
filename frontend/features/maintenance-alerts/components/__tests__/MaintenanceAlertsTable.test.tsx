import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MaintenanceAlertListItemResponse } from '@oficina/contracts';
import { MaintenanceAlertsTable } from '../MaintenanceAlertsTable';
import { maintenanceAlertsApi } from '../../api/maintenance-alerts-api';

vi.mock('../../api/maintenance-alerts-api', () => ({
  maintenanceAlertsApi: { resolve: vi.fn(), snooze: vi.fn(), dismiss: vi.fn(), reopen: vi.fn(), recordContact: vi.fn(), contacts: vi.fn().mockResolvedValue({ contacts: [] }) },
}));

vi.mock('@/features/settings/api/settings-api', () => ({
  settingsApi: { branding: vi.fn().mockResolvedValue({ company: { name: 'Auto Center Silva', document: '1' } }) },
}));

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: toastMock }));

function noop() {}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const alert: MaintenanceAlertListItemResponse = {
  id: 'alert-1',
  tenantId: 't1',
  vehicleId: 'v1',
  vehicleBrand: 'Fiat',
  vehicleModel: 'Uno',
  vehiclePlate: 'ABC1D23',
  customerId: 'c1',
  customerName: 'João da Silva',
  referenceDate: '2026-01-01T00:00:00Z',
  monthsOverdue: 7,
  status: 'OPEN',
  customerPhone: '11999998888',
  customerCareEnabled: true,
  overdueCare: [],
  contactCount: 0,
};

describe('MaintenanceAlertsTable', () => {
  it('shows a loading state', () => {
    renderWithClient(<MaintenanceAlertsTable items={[]} isLoading isError={false} onRetry={noop} />);
    expect(screen.getByRole('status', { name: /carregando alertas de manutenção/i })).toBeInTheDocument();
  });

  it('shows an error state with a retry button', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<MaintenanceAlertsTable items={[]} isLoading={false} isError onRetry={onRetry} />);

    expect(screen.getByText(/não foi possível carregar os alertas de manutenção/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows an empty state when there are no alerts', () => {
    renderWithClient(<MaintenanceAlertsTable items={[]} isLoading={false} isError={false} onRetry={noop} />);
    expect(screen.getByText(/nenhum veículo devendo revisão no momento/i)).toBeInTheDocument();
  });

  it('renders vehicle, customer and months overdue', () => {
    renderWithClient(<MaintenanceAlertsTable items={[alert]} isLoading={false} isError={false} onRetry={noop} />);

    expect(screen.getByText(/Fiat Uno · ABC1D23/)).toBeInTheDocument();
    expect(screen.getByText('João da Silva')).toBeInTheDocument();
    expect(screen.getByText('7 meses')).toBeInTheDocument();
  });

  it('does not show the resolve button for an already RESOLVED alert', () => {
    renderWithClient(<MaintenanceAlertsTable items={[{ ...alert, status: 'RESOLVED' }]} isLoading={false} isError={false} onRetry={noop} />);

    expect(screen.queryByRole('button', { name: /marcar como resolvido/i })).not.toBeInTheDocument();
  });

  it('resolving an alert calls the mutation and disables the button while pending', async () => {
    let resolveMutation: (value: { alert: MaintenanceAlertListItemResponse }) => void = () => {};
    vi.mocked(maintenanceAlertsApi.resolve).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMutation = resolve;
        }),
    );
    const user = userEvent.setup();
    renderWithClient(<MaintenanceAlertsTable items={[alert]} isLoading={false} isError={false} onRetry={noop} />);

    const button = screen.getByRole('button', { name: /marcar como resolvido/i });
    await user.click(button);

    expect(maintenanceAlertsApi.resolve).toHaveBeenCalledWith({ id: 'alert-1' });
    expect(button).toBeDisabled();

    resolveMutation({ alert: { ...alert, status: 'RESOLVED' } });
  });

  it('links the vehicle and the customer to their pages, with the plate the way people read it', () => {
    renderWithClient(<MaintenanceAlertsTable items={[{ ...alert, vehiclePlate: 'ABC1234' }]} isLoading={false} isError={false} onRetry={noop} />);
    expect(screen.getByRole('link', { name: /Fiat Uno · ABC-1234/ })).toHaveAttribute('href', '/veiculos/v1');
    expect(screen.getByRole('link', { name: 'João da Silva' })).toHaveAttribute('href', '/clientes/c1');
  });

  it('gives people who may only look no buttons at all', () => {
    renderWithClient(<MaintenanceAlertsTable items={[alert]} isLoading={false} isError={false} onRetry={noop} canManage={false} />);
    expect(screen.getByText('João da Silva')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('postpones an alert for the chosen days', async () => {
    vi.mocked(maintenanceAlertsApi.snooze).mockResolvedValue({ alert });
    const user = userEvent.setup();
    renderWithClient(<MaintenanceAlertsTable items={[alert]} isLoading={false} isError={false} onRetry={noop} />);
    await user.click(screen.getByRole('button', { name: 'Adiar' }));
    expect(await screen.findByText(/volta sozinho quando o prazo acabar/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '60 dias' }));
    await waitFor(() => expect(maintenanceAlertsApi.snooze).toHaveBeenCalledWith({ id: 'alert-1', days: 60 }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining('60 dias')));
  });

  it('dismisses an alert only with a reason, and sends the note', async () => {
    vi.mocked(maintenanceAlertsApi.dismiss).mockResolvedValue({ alert });
    const user = userEvent.setup();
    renderWithClient(<MaintenanceAlertsTable items={[alert]} isLoading={false} isError={false} onRetry={noop} />);
    await user.click(screen.getByRole('button', { name: 'Dispensar' }));
    await screen.findByText(/não deve mais ser procurado/);
    await user.click(screen.getAllByRole('button', { name: 'Dispensar' }).at(-1) as HTMLElement);
    expect(toastMock.error).toHaveBeenCalledWith('Escolha o motivo da dispensa.');
    expect(maintenanceAlertsApi.dismiss).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText('Motivo'), 'SOLD');
    await user.type(screen.getByLabelText(/Observação/), 'Vendeu em setembro');
    await user.click(screen.getAllByRole('button', { name: 'Dispensar' }).at(-1) as HTMLElement);
    await waitFor(() => expect(maintenanceAlertsApi.dismiss).toHaveBeenCalledWith({ id: 'alert-1', reason: 'SOLD', note: 'Vendeu em setembro' }));
  });

  it('shows when a postponed alert comes back, and only offers to dismiss or resolve it', () => {
    renderWithClient(<MaintenanceAlertsTable filter="SNOOZED" items={[{ ...alert, snoozedUntil: '2026-12-01T12:00:00Z' }]} isLoading={false} isError={false} onRetry={noop} />);
    expect(screen.getByText('Volta em 01/12/2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adiar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dispensar' })).toBeInTheDocument();
  });

  it('shows who resolved an alert, or that an order delivery did, and reopens only what a person closed', async () => {
    vi.mocked(maintenanceAlertsApi.reopen).mockResolvedValue({ alert });
    const byPerson = { ...alert, id: 'a1', status: 'RESOLVED' as const, resolvedAt: '2026-10-10T12:00:00Z', resolvedBy: 'u1', resolvedByName: 'Ana Recepção' };
    const byDelivery = { ...alert, id: 'a2', status: 'RESOLVED' as const, resolvedAt: '2026-10-11T12:00:00Z' };
    const user = userEvent.setup();
    renderWithClient(<MaintenanceAlertsTable filter="RESOLVED" items={[byPerson, byDelivery]} isLoading={false} isError={false} onRetry={noop} />);
    expect(screen.getByText('Resolvido em 10/10/2026 por Ana Recepção')).toBeInTheDocument();
    expect(screen.getByText('Resolvido em 11/10/2026 pela entrega de uma OS')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Reabrir' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Reabrir' }));
    await waitFor(() => expect(maintenanceAlertsApi.reopen).toHaveBeenCalledWith({ id: 'a1' }));
  });

  it('shows the reason, the date, who and the note of a dismissed alert', () => {
    renderWithClient(<MaintenanceAlertsTable filter="DISMISSED" items={[{ ...alert, status: 'DISMISSED', resolvedAt: '2026-10-10T12:00:00Z', resolvedBy: 'u1', resolvedByName: 'Ana Recepção', dismissReason: 'SOLD', dismissNote: 'Vendeu em setembro' }]} isLoading={false} isError={false} onRetry={noop} />);
    expect(screen.getByText('Vendeu o carro')).toBeInTheDocument();
    expect(screen.getByText(/10\/10\/2026 por Ana Recepção/)).toBeInTheDocument();
    expect(screen.getByText('Vendeu em setembro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeInTheDocument();
  });

  it('tells a search with no match apart from an empty list, and has a message for each list', () => {
    const { rerender } = renderWithClient(<MaintenanceAlertsTable items={[]} isLoading={false} isError={false} onRetry={noop} searching />);
    expect(screen.getByText(/nenhum alerta encontrado para essa busca/i)).toBeInTheDocument();
    rerender(<QueryClientProvider client={new QueryClient()}><MaintenanceAlertsTable items={[]} isLoading={false} isError={false} onRetry={noop} filter="DISMISSED" /></QueryClientProvider>);
    expect(screen.getByText('Nenhum alerta dispensado.')).toBeInTheDocument();
  });

  describe('reaching the customer', () => {
    it('opens WhatsApp with a ready message, and offers to call, schedule and open an order for the car', async () => {
      renderWithClient(<MaintenanceAlertsTable items={[alert]} isLoading={false} isError={false} onRetry={noop} />);
      await screen.findByText('Ninguém contatou');
      const whatsapp = (await screen.findByRole('link', { name: 'WhatsApp de João da Silva' })).getAttribute('href') ?? '';
      expect(whatsapp.startsWith('https://wa.me/5511999998888?text=')).toBe(true);
      const text = decodeURIComponent(whatsapp.split('?text=')[1]);
      expect(text).toContain('Olá, João!');
      expect(text).toContain('Fiat Uno');
      expect(text).toContain('cerca de 7 meses');
      await waitFor(() => expect(decodeURIComponent((screen.getByRole('link', { name: 'WhatsApp de João da Silva' }).getAttribute('href') ?? '').split('?text=')[1])).toContain('Auto Center Silva'));
      expect(screen.getByRole('link', { name: 'Ligar para João da Silva' })).toHaveAttribute('href', 'tel:11999998888');
      expect(screen.getByRole('link', { name: 'Agendar ABC1D23' })).toHaveAttribute('href', '/agenda');
      const newOrder = screen.getByRole('link', { name: 'Nova OS para ABC1D23' }).getAttribute('href') ?? '';
      expect(newOrder).toContain('customerId=c1');
      expect(newOrder).toContain('vehicleId=v1');
    });

    it('does not offer WhatsApp or a call without a usable phone, and flags a customer who did not authorize reminders', () => {
      renderWithClient(<MaintenanceAlertsTable items={[{ ...alert, customerPhone: '123', customerCareEnabled: false }]} isLoading={false} isError={false} onRetry={noop} />);
      expect(screen.queryByRole('link', { name: /WhatsApp de/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Ligar para/ })).not.toBeInTheDocument();
      expect(screen.getByText('Contato manual')).toBeInTheDocument();
    });

    it('shows the cares already overdue, the last attempt, and how many there were', () => {
      renderWithClient(<MaintenanceAlertsTable items={[{ ...alert, overdueCare: [{ serviceName: 'Óleo e filtro do motor', reason: 'TIME' }, { serviceName: 'Pastilhas, discos e freios', reason: 'KM' }], contactCount: 2, lastContact: { outcome: 'NO_ANSWER', at: '2026-10-20T12:00:00Z', byName: 'Ana Recepção' } }]} isLoading={false} isError={false} onRetry={noop} />);
      expect(screen.getByText('Óleo e filtro do motor vencido')).toBeInTheDocument();
      expect(screen.getByText('Pastilhas, discos e freios vencido (km)')).toBeInTheDocument();
      expect(screen.getByText('Não atendeu')).toBeInTheDocument();
      expect(screen.getByText(/20\/10\/2026 · Ana Recepção · 2 tentativas/)).toBeInTheDocument();
    });

    it('records an attempt with what happened and a note, and shows the earlier ones', async () => {
      vi.mocked(maintenanceAlertsApi.contacts).mockResolvedValue({ contacts: [{ id: 'c0', outcome: 'MESSAGE_SENT', at: '2026-10-18T12:00:00Z', byName: 'Bruno', note: 'Link do orçamento' }] });
      vi.mocked(maintenanceAlertsApi.recordContact).mockResolvedValue({ alert });
      const user = userEvent.setup();
      renderWithClient(<MaintenanceAlertsTable items={[alert]} isLoading={false} isError={false} onRetry={noop} />);
      await user.click(screen.getByRole('button', { name: 'Registrar contato' }));
      expect(await screen.findByText(/· Bruno/)).toBeInTheDocument();
      expect(screen.getByText('Link do orçamento')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Registrar' }));
      expect(toastMock.error).toHaveBeenCalledWith('Escolha o que aconteceu no contato.');
      expect(maintenanceAlertsApi.recordContact).not.toHaveBeenCalled();

      await user.selectOptions(screen.getByLabelText('O que aconteceu'), 'WILL_SCHEDULE');
      await user.type(screen.getByLabelText(/Observação/), 'Quer sexta');
      await user.click(screen.getByRole('button', { name: 'Registrar' }));
      await waitFor(() => expect(maintenanceAlertsApi.recordContact).toHaveBeenCalledWith({ id: 'alert-1', outcome: 'WILL_SCHEDULE', note: 'Quer sexta' }));
    });

    it('keeps the contact actions out of the history lists', () => {
      renderWithClient(<MaintenanceAlertsTable filter="RESOLVED" items={[{ ...alert, status: 'RESOLVED', resolvedAt: '2026-10-10T12:00:00Z' }]} isLoading={false} isError={false} onRetry={noop} />);
      expect(screen.queryByRole('link', { name: /WhatsApp de/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Registrar contato' })).not.toBeInTheDocument();
      expect(screen.queryByText('Último contato')).not.toBeInTheDocument();
    });
  });
});
