import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FiscalDocumentResponse, FiscalPreviewResponse, FiscalSettingsResponse, ServiceOrderResponse } from '@oficina/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FiscalSettingsForm } from './FiscalSettingsForm';
import { ServiceOrderFiscalSection } from './ServiceOrderFiscalSection';

const mocks = vi.hoisted(() => ({
  settings: undefined as FiscalSettingsResponse | undefined,
  documents: [] as FiscalDocumentResponse[],
  preview: undefined as FiscalPreviewResponse | undefined,
  update: vi.fn(),
  upload: vi.fn(),
  issue: vi.fn(),
  register: vi.fn(),
  cancel: vi.fn(),
  remove: vi.fn(),
  refetch: vi.fn(),
  role: 'ADMIN',
}));

vi.mock('../hooks/use-fiscal', () => ({
  useFiscalSettings: () => ({ data: mocks.settings, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateFiscalSettings: () => ({ mutate: mocks.update, isPending: false }),
  useUploadFiscalCertificate: () => ({ mutate: mocks.upload, isPending: false }),
  useFiscalDocuments: () => ({ data: mocks.documents, isLoading: false, isError: false, refetch: mocks.refetch }),
  useFiscalPreview: (_id: string, kind: string | null) => ({ data: kind ? mocks.preview : undefined, isLoading: false, isError: false }),
  useIssueFiscalDocument: () => ({ mutate: mocks.issue, isPending: false }),
  useRegisterFiscalDocument: () => ({ mutate: mocks.register, isPending: false }),
  useCancelFiscalDocument: () => ({ mutate: mocks.cancel, isPending: false }),
  useDeleteFiscalDocument: () => ({ mutate: mocks.remove, isPending: false }),
}));
vi.mock('@/stores/auth-store', () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ user: { role: mocks.role, permissions: ['settings.view', 'settings.manage', 'receipts.manage'] } }) }));
vi.mock('@/features/settings/hooks/use-unsaved-settings', () => ({ useUnsavedSettings: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

const settings = (overrides: Partial<FiscalSettingsResponse> = {}): FiscalSettingsResponse => ({
  providerAvailable: true, environment: 'HOMOLOGACAO', taxRegime: 'SIMPLES_NACIONAL', document: '11.222.333/0001-81', stateRegistration: '123', municipalRegistration: '999', cityIbgeCode: '3550308',
  nfseEnabled: true, nfeEnabled: false, nfceEnabled: false, serviceListItem: '14.01', issWithheld: false, defaultNcm: '87089990', defaultCfop: '5102', csosn: '102', pisCofinsCst: '49',
  hasNfceCsc: false, certificate: { uploaded: false }, companyRegistered: false, readiness: { NFSE: ['Envie o certificado digital A1 da oficina.'], NFE: ['NF-e desativada nas configurações.'], NFCE: ['NFC-e desativada nas configurações.'] }, ...overrides,
});

const order = { id: 'so1', orderNumber: 12, customerName: 'Maria', vehiclePlate: 'ABC1D23', totalAmountCents: 15000 } as ServiceOrderResponse;
const document = (overrides: Partial<FiscalDocumentResponse> = {}): FiscalDocumentResponse => ({ id: 'd1', serviceOrderId: 'so1', kind: 'NFSE', origin: 'INTEGRATED', environment: 'HOMOLOGACAO', status: 'AUTHORIZED', number: '45', amountCents: 10000, hasAttachment: false, createdAt: '2026-11-13T10:00:00Z', pdfUrl: 'https://p/n.pdf', ...overrides });

describe('FiscalSettingsForm', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.role = 'ADMIN'; mocks.settings = settings(); vi.spyOn(window, 'confirm').mockReturnValue(true); });

  it('shows what is missing for each note and the test environment', () => {
    render(<FiscalSettingsForm />);
    expect(screen.getAllByText('Homologação (teste)')).toHaveLength(2);
    expect(screen.getByText('Envie o certificado digital A1 da oficina.')).toBeInTheDocument();
    expect(screen.getByText(/NFS-e · pendente/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('3550308')).toBeInTheDocument();
  });

  it('saves the changed configuration with the ISS rate as a number', async () => {
    const user = userEvent.setup();
    render(<FiscalSettingsForm />);
    const save = screen.getByRole('button', { name: /Salvar configuração fiscal/ });
    expect(save).toBeDisabled();
    await user.type(screen.getByPlaceholderText('Ex.: 2,00'), '2,5');
    await user.click(screen.getByRole('checkbox', { name: /NF-e/ }));
    await user.click(save);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ issRatePercent: 2.5, nfeEnabled: true, nfceCsc: undefined }), expect.anything());
  });

  it('asks before switching to production and explains when emission is not active', async () => {
    mocks.settings = settings({ providerAvailable: false });
    const user = userEvent.setup();
    render(<FiscalSettingsForm />);
    expect(screen.getByText(/depende da ativação no servidor/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Produção/ }));
    await user.click(screen.getByRole('button', { name: /Salvar configuração fiscal/ }));
    expect(window.confirm).toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ environment: 'PRODUCAO' }), expect.anything());
  });

  it('lets only the administrator send the certificate', () => {
    mocks.role = 'MANAGER';
    render(<FiscalSettingsForm />);
    expect(screen.getByText('Só o administrador da oficina envia o certificado.')).toBeInTheDocument();
  });
});

describe('ServiceOrderFiscalSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.documents = [];
    mocks.preview = { kind: 'NFSE', amountCents: 10000, discountCents: 0, items: [{ id: 'l1', type: 'LABOR', description: 'Revisão', quantity: 1, unitPriceCents: 10000, totalCents: 10000, discountCents: 0 }], blockers: [], problems: [], warnings: ['Ambiente de homologação: a nota é de teste e não tem valor fiscal.'], environment: 'HOMOLOGACAO' };
  });

  it('starts empty and issues the chosen note after showing the preview', async () => {
    const user = userEvent.setup();
    render(<ServiceOrderFiscalSection serviceOrder={order} />);
    expect(screen.getByText('Nenhuma nota para esta OS.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Emitir nota/ }));
    expect(screen.getByText('Revisão')).toBeInTheDocument();
    expect(screen.getByText(/homologação/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Emitir NFS-e de teste' }));
    expect(mocks.issue).toHaveBeenCalledWith({ serviceOrderId: 'so1', kind: 'NFSE' }, expect.anything());
  });

  it('blocks issuing while the configuration or the order has problems', async () => {
    mocks.preview = { ...mocks.preview!, blockers: ['Envie o certificado digital A1 da oficina.'], problems: ['A NF-e exige o CPF ou CNPJ do cliente.'] };
    const user = userEvent.setup();
    render(<ServiceOrderFiscalSection serviceOrder={order} />);
    await user.click(screen.getByRole('button', { name: /Emitir nota/ }));
    expect(screen.getByText('Envie o certificado digital A1 da oficina.')).toBeInTheDocument();
    expect(screen.getByText('A NF-e exige o CPF ou CNPJ do cliente.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Emitir NFS-e de teste' })).toBeDisabled();
  });

  it('lists notes with their actions and cancels with a justification', async () => {
    mocks.documents = [document(), document({ id: 'd2', kind: 'NFE', origin: 'MANUAL', status: 'AUTHORIZED', number: '7', environment: undefined, pdfUrl: undefined, hasAttachment: true }), document({ id: 'd3', status: 'ERROR', number: undefined, pdfUrl: undefined, errorMessage: 'Inscrição municipal inválida' })];
    const user = userEvent.setup();
    render(<ServiceOrderFiscalSection serviceOrder={order} />);
    expect(screen.getAllByText('Teste')).toHaveLength(2);
    expect(screen.getByText('Emitida fora do Ofix')).toBeInTheDocument();
    expect(screen.getByText('Inscrição municipal inválida')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir nota/ })).toHaveAttribute('href', 'https://p/n.pdf');
    expect(screen.getAllByRole('button', { name: /Excluir/ })).toHaveLength(2);
    await user.click(screen.getAllByRole('button', { name: /Cancelar/ })[0]);
    const confirm = screen.getByRole('button', { name: 'Cancelar nota' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByPlaceholderText(/valor lançado errado/), 'Valor lançado errado na nota');
    await user.click(confirm);
    expect(mocks.cancel).toHaveBeenCalledWith({ id: 'd1', reason: 'Valor lançado errado na nota' }, expect.anything());
  });

  it('registers a note issued elsewhere with number and amount', async () => {
    const user = userEvent.setup();
    render(<ServiceOrderFiscalSection serviceOrder={order} />);
    await user.click(screen.getByRole('button', { name: /Registrar nota emitida/ }));
    await user.click(screen.getByRole('button', { name: 'Registrar nota' }));
    expect(mocks.register).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Número'), '321');
    await user.click(screen.getByRole('button', { name: 'Registrar nota' }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledWith(expect.objectContaining({ serviceOrderId: 'so1', kind: 'NFSE', number: '321', amountCents: 15000 }), expect.anything()));
  });
});
