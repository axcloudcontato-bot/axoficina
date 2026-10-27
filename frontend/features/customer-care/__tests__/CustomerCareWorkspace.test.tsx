import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CARE_SETTINGS } from '@oficina/contracts';
import { CustomerCareWorkspace } from '../CustomerCareWorkspace';

const mocks = vi.hoisted(() => ({ save: vi.fn(), record: vi.fn(), retry: vi.fn(), preview: vi.fn(), data: undefined as unknown, role: 'MANAGER', permissions: [] as string[] }));
vi.mock('@/stores/auth-store', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { role: mocks.role, permissions: mocks.permissions } }) }));
vi.mock('../use-customer-care', () => ({
  useCustomerCare: () => ({ data: mocks.data, isLoading: false, isError: false }),
  useSaveCareSettings: () => ({ mutate: mocks.save, isPending: false }), useRecordCareService: () => ({ mutate: mocks.record, isPending: false }),
  useRetryCareDelivery: () => ({ mutate: mocks.retry, isPending: false }), useCarePreview: () => ({ mutate: mocks.preview, isPending: false }),
}));
vi.mock('@/features/vehicles/components/VehicleSearchCombobox', () => ({ VehicleSearchCombobox: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <input value={value} onChange={event => onChange(event.target.value)} /> }));

describe('customer care workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.role = 'MANAGER'; mocks.permissions = ['alerts.view', 'alerts.manage', 'settings.manage'];
    mocks.data = { settings: structuredClone(DEFAULT_CARE_SETTINGS), channels: { whatsapp: true, email: false }, stats: { optedIn: 14, birthdaysThisMonth: 2, dueThisMonth: 3, sentThisMonth: 4, pending: 0, failed: 0 }, plans: [], deliveries: [], totalPlans: 0, totalDeliveries: 0 };
  });
  it('keeps the automation paused until the operator explicitly saves an activation', async () => {
    render(<CustomerCareWorkspace />);
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
    expect(await screen.findByRole('checkbox', { name: 'Ativar disparos automáticos' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Registrar cuidado' })).not.toBeInTheDocument();
  });
});
