import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CARE_SETTINGS } from '@oficina/contracts';
import { CustomerCareWorkspace } from '../CustomerCareWorkspace';

const mocks = vi.hoisted(() => ({ save: vi.fn(), record: vi.fn(), retry: vi.fn(), preview: vi.fn(), resolve: vi.fn(), testSend: vi.fn(), recordContact: vi.fn(), plans: { plans: [] as unknown[], total: 0 }, plansRequests: [] as unknown[], deliveries: { deliveries: [] as unknown[], total: 0 }, deliveriesRequests: [] as unknown[], data: undefined as unknown, role: 'MANAGER', permissions: [] as string[] }));
vi.mock('@/stores/auth-store', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { role: mocks.role, permissions: mocks.permissions } }) }));
vi.mock('../use-customer-care', () => ({
  useCustomerCare: () => ({ data: mocks.data, isLoading: false, isError: false }),
  useSaveCareSettings: () => ({ mutate: mocks.save, isPending: false }), useRecordCareService: () => ({ mutate: mocks.record, isPending: false }),
  useRetryCareDelivery: () => ({ mutate: mocks.retry, isPending: false }), useCarePreview: () => ({ mutate: mocks.preview, isPending: false }),
  useResolveCareDelivery: () => ({ mutate: mocks.resolve, isPending: false }),
  useCarePlans: (request: unknown) => { mocks.plansRequests.push(request); return { data: mocks.plans, isLoading: false, isError: false, refetch: vi.fn() }; },
  useCareDeliveries: (request: unknown) => { mocks.deliveriesRequests.push(request); return { data: mocks.deliveries, isLoading: false, isError: false, refetch: vi.fn() }; },
  useCareTestSend: () => ({ mutate: mocks.testSend, isPending: false }),
  useRecordCarePlanContact: () => ({ mutate: mocks.recordContact, isPending: false }),
  useCarePlanContacts: () => ({ data: { contacts: [] } }),
}));
vi.mock('@/features/settings/hooks/use-settings', () => ({ useBranding: () => ({ data: { company: { name: 'Oficina do Cuidado' } } }) }));
vi.mock('@/features/vehicles/components/VehicleSearchCombobox', () => ({ VehicleSearchCombobox: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <input value={value} onChange={event => onChange(event.target.value)} /> }));

describe('customer care workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.plans = { plans: [], total: 0 }; mocks.plansRequests = []; mocks.deliveries = { deliveries: [], total: 0 }; mocks.deliveriesRequests = []; mocks.role = 'MANAGER'; mocks.permissions = ['alerts.view', 'alerts.manage', 'settings.manage'];
    mocks.data = { settings: structuredClone(DEFAULT_CARE_SETTINGS), channels: { whatsapp: true, email: false }, stats: { optedIn: 14, birthdaysThisMonth: 2, dueThisMonth: 3, sentThisMonth: 4, pending: 0, failed: 0 }, plans: [], deliveries: [], totalPlans: 0, totalDeliveries: 0 };
  });
  it('keeps the automation paused until the operator explicitly saves an activation', async () => {
    render(<CustomerCareWorkspace />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Ajustes da régua' }));
    const toggle = await screen.findByRole('checkbox', { name: 'Ativar disparos automáticos' });
    expect(toggle).not.toBeChecked(); expect(mocks.save).not.toHaveBeenCalled();
    await userEvent.click(toggle); expect(mocks.save).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar régua de cuidado' }));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, campaigns: expect.arrayContaining([expect.objectContaining({ key: 'BIRTHDAY' })]) }), expect.anything());
  });
  it('retains an edited message across a background dashboard refresh, without sending it', async () => {
    const user = userEvent.setup(); const view = render(<CustomerCareWorkspace />);
    await screen.findByRole('heading', { name: 'O cuidado continua.' });
    await user.click(screen.getByRole('tab', { name: 'Campanhas e mensagens' }));
    const message = screen.getByRole('textbox', { name: /Mensagem da campanha/ });
    fireEvent.change(message, { target: { value: '🎂 Feliz aniversário, {cliente}! Estamos sempre por perto. 💛' } });
    mocks.data = structuredClone(mocks.data); view.rerender(<CustomerCareWorkspace />);
    expect(message).toHaveValue('🎂 Feliz aniversário, {cliente}! Estamos sempre por perto. 💛');
    expect(mocks.preview).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Ver mensagem completa' }));
    expect(mocks.preview).toHaveBeenCalledWith(expect.objectContaining({ campaignKey: 'BIRTHDAY', message: expect.stringContaining('💛') }), expect.anything());
  });
  it('records a real service and leaves other service schedules untouched', async () => {
    const user = userEvent.setup(); render(<CustomerCareWorkspace />);
    await user.click(await screen.findByRole('button', { name: 'Registrar cuidado' }));
    const vehicle = screen.getByLabelText('Veículo e cliente'); await user.type(vehicle, 'vehicle-id');
    await user.selectOptions(screen.getByLabelText('Cuidado realizado'), 'OIL_CHANGE');
    await user.type(screen.getByLabelText('Quilometragem (opcional)'), '25000');
    await user.click(screen.getByRole('button', { name: /^Registrar cuidado$/ }));
    await waitFor(() => expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ vehicleId: 'vehicle-id', serviceKey: 'OIL_CHANGE', mileage: 25000 }), expect.anything()));
  });
  it('protects configuration controls for a viewer without management permission', async () => {
    mocks.role = 'FRONT_DESK'; mocks.permissions = ['alerts.view']; render(<CustomerCareWorkspace />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Ajustes da régua' }));
    expect(await screen.findByRole('checkbox', { name: 'Ativar disparos automáticos' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Registrar cuidado' })).not.toBeInTheDocument();
  });

  it('lists who authorized the reminders but will not receive them, and why', async () => {
    (mocks.data as Record<string, unknown>).unreachable = { total: 2, customers: [
      { id: 'c1', name: 'Mariana Lopes', reason: 'NO_WHATSAPP' },
      { id: 'c2', name: 'Pedro Alves', reason: 'PHONE_PREFERRED' },
    ] };
    render(<CustomerCareWorkspace />);
    expect(await screen.findByText('2 clientes autorizaram os lembretes, mas não vão receber')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mariana Lopes' })).toHaveAttribute('href', '/clientes/c1');
    expect(screen.getByText(/Telefone sem WhatsApp válido/)).toBeInTheDocument();
    expect(screen.getByText(/Prefere ligação ou SMS/)).toBeInTheDocument();
  });

  it('shows nothing about unreachable customers when everyone can be reached', async () => {
    (mocks.data as Record<string, unknown>).unreachable = { total: 0, customers: [] };
    render(<CustomerCareWorkspace />);
    await screen.findByRole('heading', { name: 'O cuidado continua.' });
    expect(screen.queryByText(/não vão receber|não vai receber/)).not.toBeInTheDocument();
  });

  it('lets a manager settle a delivery whose result is unknown, either way', async () => {
    const user = userEvent.setup();
    mocks.deliveries = { deliveries: [{ id: 'd1', customerName: 'Mariana', campaignNames: ['Óleo'], channel: 'WHATSAPP', status: 'UNKNOWN', message: 'Olá', reason: 'Processamento interrompido.', scheduledAt: '2026-10-29T12:00:00Z' }], total: 1 };
    render(<CustomerCareWorkspace />);
    await user.click(await screen.findByRole('tab', { name: 'Histórico dos disparos' }));
    await user.click(screen.getByRole('button', { name: 'A mensagem chegou' }));
    expect(mocks.resolve).toHaveBeenCalledWith({ id: 'd1', outcome: 'DELIVERED' }, expect.anything());
    await user.click(screen.getByRole('button', { name: 'Não chegou' }));
    expect(mocks.resolve).toHaveBeenCalledWith({ id: 'd1', outcome: 'NOT_DELIVERED' }, expect.anything());
  });

  it('does not offer to settle deliveries to someone who cannot manage the settings', async () => {
    mocks.permissions = ['alerts.view'];
    const user = userEvent.setup();
    mocks.deliveries = { deliveries: [{ id: 'd1', customerName: 'Mariana', campaignNames: ['Óleo'], channel: 'WHATSAPP', status: 'UNKNOWN', message: 'Olá', scheduledAt: '2026-10-29T12:00:00Z' }], total: 1 };
    render(<CustomerCareWorkspace />);
    await user.click(await screen.findByRole('tab', { name: 'Histórico dos disparos' }));
    expect(screen.queryByRole('button', { name: 'A mensagem chegou' })).not.toBeInTheDocument();
  });

  it('shows the plans due first, says who gets the reminder and who needs a call, and filters them', async () => {
    const user = userEvent.setup();
    const plan = { id: 'p1', customerId: 'c1', customerName: 'Mariana Lopes', vehicleId: 'v1', vehicleName: 'Honda Fit', plate: 'ABC1234', serviceKey: 'OIL_CHANGE', serviceName: 'Óleo e filtro do motor', completedAt: '2026-01-10T12:00:00Z', dueAt: '2026-07-10T12:00:00Z', intervalMonths: 6, intervalKm: 10000, customerCareEnabled: false, overdue: true };
    mocks.plans = { plans: [plan, { ...plan, id: 'p2', customerCareEnabled: true, overdue: false, customerName: 'Pedro' }], total: 2 };
    render(<CustomerCareWorkspace />);
    await user.click(await screen.findByRole('tab', { name: 'Planos por veículo' }));
    expect(screen.getByText('Vencido')).toBeInTheDocument();
    expect(screen.getByText('Contato manual')).toBeInTheDocument();
    expect(screen.getByText('Recebe lembrete')).toBeInTheDocument();
    expect(screen.getAllByText('ABC-1234')).toHaveLength(2);
    expect(screen.getByText('2 planos cadastrados')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Situação do plano'), 'OVERDUE');
    expect(mocks.plansRequests.at(-1)).toMatchObject({ filter: 'OVERDUE', offset: 0 });
  });

  it('opens the list behind a number on top, already filtered', async () => {
    const user = userEvent.setup();
    render(<CustomerCareWorkspace />);
    await user.click(await screen.findByRole('button', { name: /Cuidados a acompanhar: 3/ }));
    expect(screen.getByRole('tab', { name: 'Planos por veículo' })).toHaveAttribute('aria-selected', 'true');
    expect(mocks.plansRequests.at(-1)).toMatchObject({ filter: 'DUE' });
    await user.click(screen.getByRole('button', { name: /Enviados neste mês: 4/ }));
    expect(screen.getByRole('tab', { name: 'Histórico dos disparos' })).toHaveAttribute('aria-selected', 'true');
    expect(mocks.deliveriesRequests.at(-1)).toMatchObject({ status: 'SENT' });
  });

  it('filters the history by result, campaign, customer and period', async () => {
    const user = userEvent.setup();
    render(<CustomerCareWorkspace />);
    await user.click(await screen.findByRole('tab', { name: 'Histórico dos disparos' }));
    await user.selectOptions(screen.getByLabelText('Resultado do envio'), 'NOT_SENT');
    await user.selectOptions(screen.getByLabelText('Campanha'), 'OIL_CHANGE');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    await waitFor(() => expect(mocks.deliveriesRequests.at(-1)).toMatchObject({ status: 'NOT_SENT', campaignKey: 'OIL_CHANGE', from: '2026-10-01', offset: 0 }));
  });

  it('lists the cares of customers who did not authorize the reminders, to be reached by hand', async () => {
    const user = userEvent.setup();
    const plan = { id: 'p1', customerId: 'c1', customerName: 'Mariana Lopes', customerPhone: '11999998888', vehicleId: 'v1', vehicleName: 'Honda Fit', plate: 'ABC1D23', serviceKey: 'OIL_CHANGE', serviceName: 'Óleo e filtro do motor', completedAt: '2026-01-10T12:00:00Z', dueAt: '2026-07-10T12:00:00Z', intervalMonths: 6, intervalKm: 10000, customerCareEnabled: false, overdue: true, contactCount: 2, lastContact: { outcome: 'NO_ANSWER', at: '2026-10-20T12:00:00Z', byName: 'Ana' } };
    mocks.plans = { plans: [plan], total: 1 };
    render(<CustomerCareWorkspace />);
    await user.click(await screen.findByRole('tab', { name: 'Para a equipe ligar' }));
    expect(mocks.plansRequests.at(-1)).toMatchObject({ consent: 'NOT_GRANTED', filter: 'DUE' });
    expect(screen.getByText(/Não atendeu/)).toBeInTheDocument();
    expect(screen.getByText(/2 tentativas/)).toBeInTheDocument();
    const whatsapp = screen.getByRole('link', { name: 'WhatsApp de Mariana Lopes' }).getAttribute('href') ?? '';
    expect(decodeURIComponent(whatsapp.split('?text=')[1])).toContain('Aqui é da Oficina do Cuidado');
    expect(screen.getByRole('link', { name: 'Agendar ABC1D23' }).getAttribute('href')).toContain('cliente=c1');
    await user.click(screen.getByRole('button', { name: 'Registrar contato' }));
    await user.selectOptions(screen.getByLabelText('O que aconteceu'), 'WILL_SCHEDULE');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));
    expect(mocks.recordContact).toHaveBeenCalledWith({ id: 'p1', outcome: 'WILL_SCHEDULE' }, expect.anything());
  });

  it('sends the campaign message on screen to the manager as a test', async () => {
    const user = userEvent.setup();
    render(<CustomerCareWorkspace />);
    await user.click(await screen.findByRole('tab', { name: 'Campanhas e mensagens' }));
    await user.click(screen.getByRole('button', { name: 'Enviar teste para mim' }));
    expect(screen.getByRole('button', { name: 'Enviar teste' })).toBeDisabled();
    await user.type(screen.getByLabelText('Seu WhatsApp'), '11988887777');
    await user.click(screen.getByRole('button', { name: 'Enviar teste' }));
    expect(mocks.testSend).toHaveBeenCalledWith(expect.objectContaining({ campaignKey: 'BIRTHDAY', phone: '11988887777', message: expect.any(String) }), expect.anything());
  });
});
