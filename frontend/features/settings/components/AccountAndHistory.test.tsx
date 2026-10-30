import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditHistory } from './AuditHistory';
import { WorkshopPlanAndData } from './WorkshopPlanAndData';
import { auditLabel } from '../audit-labels';

const mocks = vi.hoisted(() => ({ auditRequests: [] as unknown[], plan: {} as Record<string, unknown>, modules: [] as string[], exportData: vi.fn() }));
vi.mock('../hooks/use-settings', () => ({
  useAuditLog: (request: unknown) => { mocks.auditRequests.push(request); return { data: { items: [
    { id: 'a1', action: 'settings.order_defaults_updated', entity: 'tenant', entityId: 't', userId: 'u1', userName: 'Ana', metadata: {}, createdAt: '2026-10-30T12:00:00.000Z' },
    { id: 'a2', action: 'financial.entry_payment_reversed', entity: 'x', entityId: 'x', userId: null, userName: null, metadata: { amountCents: 5000 }, createdAt: '2026-10-30T11:00:00.000Z' },
  ], total: 2, offset: 0, limit: 30 }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }; },
  useWorkshopSubscription: () => ({ data: mocks.plan, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/features/plan/use-entitlements', () => ({ useEntitlements: () => ({ hasModule: (key: string) => mocks.modules.includes(key) }) }));
vi.mock('../api/settings-api', () => ({ settingsApi: { exportData: (dataset: string) => mocks.exportData(dataset) } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('audit history', () => {
  beforeEach(() => { mocks.auditRequests = []; });

  it('says what happened in the words of the screen, and who did it', () => {
    render(<AuditHistory />);
    expect(screen.getByText('Alterou os padrões da OS')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Estornou um pagamento')).toBeInTheDocument();
    expect(screen.getByText(/amountCents: 5000/)).toBeInTheDocument();
  });

  it('filters by area and by whole days in the workshop time zone', async () => {
    const user = userEvent.setup();
    render(<AuditHistory />);
    await user.selectOptions(screen.getByLabelText('Área'), 'financial.');
    await user.type(screen.getByLabelText('De'), '2026-10-01');
    await user.type(screen.getByLabelText('Até'), '2026-10-31');
    expect(mocks.auditRequests.at(-1)).toMatchObject({ actionPrefix: 'financial.', from: '2026-10-01T03:00:00.000Z', to: '2026-11-01T03:00:00.000Z', offset: 0 });
  });

  it('falls back to a readable text for an action it does not know', () => {
    expect(auditLabel('algo.novo_evento')).toBe('algo: novo evento');
  });
});

describe('plan and data export', () => {
  beforeEach(() => { mocks.exportData.mockReset(); mocks.modules = ['financeiro', 'produtividade', 'cuidado', 'whatsapp', 'governanca']; mocks.plan = { plan: 'completo', status: 'past_due', amountCents: 19990, cycle: 'monthly', dueAt: '2026-11-10T12:00:00.000Z', customerSince: '2026-07-24T12:00:00.000Z' }; });

  it('shows the plan and warns when payment is late', () => {
    render(<WorkshopPlanAndData />);
    expect(screen.getByText('Pagamento em atraso')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Fale com o suporte');
    expect(screen.getByText(/R\$\s*199,90 por mês/)).toBeInTheDocument();
  });

  it('shows the plan name and which modules it includes', () => {
    mocks.modules = ['financeiro'];
    mocks.plan = { ...mocks.plan, plan: 'essencial' };
    render(<WorkshopPlanAndData />);
    expect(screen.getByText('Essencial')).toBeInTheDocument();
    expect(screen.getByText('Financeiro').closest('li')).toHaveTextContent('(incluído)');
    expect(screen.getByText('WhatsApp').closest('li')).toHaveTextContent('(fora do plano)');
  });

  it('offers the plan instead of the export when it is not included', () => {
    mocks.modules = [];
    render(<WorkshopPlanAndData />);
    expect(screen.queryByRole('button', { name: 'Baixar Clientes' })).not.toBeInTheDocument();
    expect(screen.getByText('Histórico e exportação não faz parte do seu plano')).toBeInTheDocument();
  });

  it('downloads each dataset as a spreadsheet', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
    mocks.exportData.mockResolvedValue({ blob: new Blob(['a;b']), filename: 'customers-2026-10-30.csv' });
    const user = userEvent.setup();
    render(<WorkshopPlanAndData />);
    await user.click(screen.getByRole('button', { name: 'Baixar Clientes' }));
    await waitFor(() => expect(mocks.exportData).toHaveBeenCalledWith('customers'));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});
