import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FiscalDocument, FiscalSettings } from '@oficina/database';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { FiscalManager } from './fiscal.manager';
import { FocusNotFoundError } from './focus-nfe.client';

const user = { tenantId: 't1', userId: 'u1', role: 'ADMIN' } as AuthenticatedUser;
const tenant = {
  name: 'Oficina Boa', legalName: 'Oficina Boa LTDA', document: '11222333000181', stateRegistration: '123', phone: '1199', email: 'a@b.test',
  addressStreet: 'Rua A', addressNumber: '1', addressDistrict: 'Centro', addressCity: 'São Paulo', addressState: 'SP', addressPostalCode: '01001000',
};
const settings = (overrides: Partial<FiscalSettings> = {}): FiscalSettings => ({
  id: 's1', tenantId: 't1', environment: 'HOMOLOGACAO', taxRegime: 'SIMPLES_NACIONAL', municipalRegistration: '999', cityIbgeCode: '3550308', cnae: null,
  nfseEnabled: true, nfeEnabled: true, nfceEnabled: false, serviceListItem: '14.01', municipalTaxCode: null, issRatePercent: null, issWithheld: false,
  defaultNcm: '87089990', defaultCfop: '5102', csosn: '102', pisCofinsCst: '49', nfceCscId: null, nfceCsc: null,
  providerCompanyId: '77', providerTokenProduction: 'enc:prod', providerTokenHomologation: 'enc:homo', certificateValidUntil: new Date('2027-01-01'), certificateUploadedAt: new Date('2026-11-01'),
  lastSyncAt: null, lastSyncError: null, createdAt: new Date(), updatedAt: new Date(), ...overrides,
} as unknown as FiscalSettings);
const bundle = (status = 'COMPLETED') => ({
  status,
  order: { orderNumber: 7, vehicleLabel: 'VW Gol', vehiclePlate: 'ABC1D23', discountCents: 0, paymentMethod: 'PIX', items: [
    { id: 'l1', type: 'LABOR', description: 'Revisão', quantity: 1, unitPriceCents: 10000 },
    { id: 'p1', type: 'PART', description: 'Filtro', quantity: 1, unitPriceCents: 3000, ncm: '84212300' },
  ] },
  customer: { type: 'PF', document: '52998224725', name: 'Maria', email: 'm@c.test', address: { street: 'R', number: '1', neighborhood: 'B', city: 'São Paulo', state: 'SP', zipCode: '02002000' } },
});
const doc = (overrides: Partial<FiscalDocument> = {}): FiscalDocument => ({
  id: 'd1', tenantId: 't1', serviceOrderId: 'so1', kind: 'NFSE', origin: 'INTEGRATED', environment: 'HOMOLOGACAO', status: 'PROCESSING', providerRef: 'ofix-d1',
  number: null, series: null, verificationCode: null, accessKey: null, issuedAt: null, amountCents: 10000, pdfUrl: null, xmlUrl: null, attachmentKey: null, attachmentName: null,
  attachmentMimeType: null, errorMessage: null, cancelledAt: null, cancelReason: null, notes: null, itemIds: ['l1'], createdBy: 'u1', createdAt: new Date('2026-11-13'), updatedAt: new Date(), ...overrides,
} as FiscalDocument);

describe('FiscalManager', () => {
  let uploadDir: string;
  let repository: Record<string, jest.Mock>;
  let focus: { available: boolean; saveCompany: jest.Mock; issue: jest.Mock; status: jest.Mock; cancel: jest.Mock };
  let ibge: { codeFor: jest.Mock };
  let audit: { record: jest.Mock };
  let manager: FiscalManager;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'fiscal-'));
    repository = {
      settings: jest.fn().mockResolvedValue(settings()),
      saveSettings: jest.fn().mockImplementation(async (_tenant: string, data: Partial<FiscalSettings>) => settings(data)),
      orderBundle: jest.fn().mockResolvedValue(bundle()),
      documents: jest.fn().mockResolvedValue([doc({ status: 'AUTHORIZED' })]),
      document: jest.fn().mockResolvedValue(doc({ status: 'AUTHORIZED' })),
      activeDocument: jest.fn().mockResolvedValue(null),
      createDocument: jest.fn().mockImplementation(async (_tenant: string, data: Partial<FiscalDocument>) => doc(data)),
      updateDocument: jest.fn().mockImplementation(async (id: string, data: Partial<FiscalDocument>) => doc({ id, ...data })),
      deleteDocument: jest.fn().mockResolvedValue(undefined),
    };
    focus = { available: true, saveCompany: jest.fn().mockResolvedValue({ id: '77', tokenProduction: 'prod', tokenHomologation: 'homo', certificateValidUntil: new Date('2027-06-01') }), issue: jest.fn(), status: jest.fn(), cancel: jest.fn() };
    ibge = { codeFor: jest.fn().mockResolvedValue('3550308') };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const secrets = { encrypt: (value: string) => `enc:${value}`, decrypt: (value: string) => value.replace(/^enc:/, '') };
    const config = { get: (key: string, fallback?: string) => (key === 'UPLOAD_DIR' ? uploadDir : fallback) } as unknown as ConfigService;
    manager = new FiscalManager(repository as never, { byId: jest.fn().mockResolvedValue(tenant) } as never, focus as never, ibge as never, secrets as never, audit as never, config);
  });

  afterEach(async () => { await rm(uploadDir, { recursive: true, force: true }); });

  it('returns the settings with readiness and suggests the city code on the first visit', async () => {
    repository.settings.mockResolvedValueOnce(null);
    const response = await manager.getSettings(user);
    expect(response.cityIbgeCode).toBe('3550308');
    expect(response.nfseEnabled).toBe(true);
    expect(response.certificate.uploaded).toBe(false);
    expect(response.readiness.NFSE).toEqual(expect.arrayContaining([expect.stringContaining('certificado')]));
    const ready = await manager.getSettings(user);
    expect(ready.readiness.NFSE).toEqual([]);
    expect(ready.companyRegistered).toBe(true);
  });

  it('saves the settings, encrypts the CSC and syncs the company once a certificate exists', async () => {
    const input = { environment: 'PRODUCAO', taxRegime: 'MEI', municipalRegistration: ' 999 ', cityIbgeCode: '3550308', cnae: '4520-0/01', nfseEnabled: true, nfeEnabled: false, nfceEnabled: true, serviceListItem: '14.01', issRatePercent: 2, issWithheld: false, defaultNcm: '87089990', defaultCfop: '5102', csosn: '102', pisCofinsCst: '49', nfceCscId: '1', nfceCsc: 'SECRET' } as const;
    await manager.updateSettings(user, input);
    expect(repository.saveSettings.mock.calls[0][1]).toMatchObject({ municipalRegistration: '999', cnae: '4520001', nfceCsc: 'enc:SECRET', environment: 'PRODUCAO' });
    expect(focus.saveCompany).toHaveBeenCalledWith('77', expect.objectContaining({ cnpj: '11222333000181' }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'fiscal.settings_updated' }));
    // A provider failure is kept as a sync error instead of losing the saved form.
    focus.saveCompany.mockRejectedValueOnce(new UnprocessableEntityException('IE inválida'));
    repository.settings.mockResolvedValueOnce(settings());
    const saved = await manager.updateSettings(user, { ...input, nfceCsc: undefined });
    expect(saved.lastSyncError).toBe('IE inválida');
    focus.available = false;
    focus.saveCompany.mockClear();
    await manager.updateSettings(user, input);
    expect(focus.saveCompany).not.toHaveBeenCalled();
  });

  it('forwards the certificate to the provider without storing it', async () => {
    const response = await manager.uploadCertificate(user, { fileName: 'cert.pfx', dataBase64: Buffer.from('pfx').toString('base64'), password: 'senha' });
    expect(focus.saveCompany).toHaveBeenCalledWith('77', expect.objectContaining({ arquivo_certificado_base64: Buffer.from('pfx').toString('base64'), senha_certificado: 'senha' }));
    const saved = repository.saveSettings.mock.calls.at(-1)![1];
    expect(saved).toMatchObject({ providerTokenProduction: 'enc:prod', providerTokenHomologation: 'enc:homo', lastSyncError: null });
    expect(JSON.stringify(saved)).not.toContain('senha');
    expect(response.certificate.uploaded).toBe(true);
    await expect(manager.uploadCertificate(user, { fileName: 'cert.txt', dataBase64: 'AA==', password: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(manager.uploadCertificate(user, { fileName: 'cert.pfx', dataBase64: '', password: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    focus.saveCompany.mockRejectedValueOnce(new UnprocessableEntityException('Senha do certificado incorreta'));
    await expect(manager.uploadCertificate(user, { fileName: 'c.p12', dataBase64: 'AA==', password: 'x' })).rejects.toThrow('Senha do certificado incorreta');
    focus.available = false;
    await expect(manager.uploadCertificate(user, { fileName: 'c.pfx', dataBase64: 'AA==', password: 'x' })).rejects.toThrow('não está ativa');
  });

  it('refuses a certificate for a workshop registered with a CPF', async () => {
    const cpfManager = new FiscalManager(repository as never, { byId: jest.fn().mockResolvedValue({ ...tenant, document: '52998224725' }) } as never, focus as never, ibge as never, { encrypt: String, decrypt: String } as never, audit as never, { get: () => uploadDir } as unknown as ConfigService);
    await expect(cpfManager.uploadCertificate(user, { fileName: 'c.pfx', dataBase64: 'AA==', password: 'x' })).rejects.toThrow('CNPJ');
  });

  it('lists and previews the notes of an order', async () => {
    expect(await manager.list('so1')).toEqual([expect.objectContaining({ id: 'd1', status: 'AUTHORIZED', hasAttachment: false })]);
    const preview = await manager.preview(user, 'so1', 'NFE');
    expect(preview).toMatchObject({ kind: 'NFE', amountCents: 3000, environment: 'HOMOLOGACAO', problems: [], blockers: [] });
    repository.orderBundle.mockResolvedValueOnce(bundle('OPEN'));
    expect((await manager.preview(user, 'so1', 'NFCE')).blockers).toEqual(expect.arrayContaining(['NFC-e desativada nas configurações.', expect.stringContaining('aprovar o orçamento')]));
    repository.orderBundle.mockResolvedValueOnce(null);
    await expect(manager.list('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('issues an NFS-e with the homologation token and stores the authorized result', async () => {
    focus.issue.mockResolvedValueOnce({ status: 'AUTHORIZED', number: '12', verificationCode: 'XYZ', pdfUrl: 'https://p/nota', issuedAt: new Date('2026-11-13T12:00:00Z') });
    const result = await manager.issue(user, { serviceOrderId: 'so1', kind: 'NFSE' });
    const [kind, environment, token, ref, payload] = focus.issue.mock.calls[0];
    expect([kind, environment, token]).toEqual(['NFSE', 'HOMOLOGACAO', 'homo']);
    expect(ref).toMatch(/^ofix-/);
    expect(payload.tomador.endereco.codigo_municipio).toBe('3550308');
    expect(repository.createDocument.mock.calls[0][1]).toMatchObject({ status: 'PROCESSING', amountCents: 10000, itemIds: ['l1'], origin: 'INTEGRATED' });
    expect(result).toMatchObject({ status: 'AUTHORIZED', number: '12', verificationCode: 'XYZ', pdfUrl: 'https://p/nota' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'fiscal.document_issued', metadata: expect.objectContaining({ kind: 'NFSE', status: 'AUTHORIZED' }) }));
  });

  it('issues an NF-e in production and records refusals and outages', async () => {
    repository.settings.mockResolvedValue(settings({ environment: 'PRODUCAO' }));
    focus.issue.mockRejectedValueOnce(new UnprocessableEntityException('NCM inválido'));
    expect(await manager.issue(user, { serviceOrderId: 'so1', kind: 'NFE' })).toMatchObject({ status: 'ERROR', errorMessage: 'NCM inválido' });
    expect(focus.issue.mock.calls[0][2]).toBe('prod');
    focus.issue.mockRejectedValueOnce(new ServiceUnavailableException('O emissor de notas não respondeu.'));
    expect(await manager.issue(user, { serviceOrderId: 'so1', kind: 'NFE' })).toMatchObject({ status: 'PROCESSING', errorMessage: 'O emissor de notas não respondeu.' });
    focus.issue.mockRejectedValueOnce(new Error('bug'));
    await expect(manager.issue(user, { serviceOrderId: 'so1', kind: 'NFE' })).rejects.toThrow('bug');
  });

  it('blocks issuing when not ready, too early, duplicated or with data problems', async () => {
    await expect(manager.issue(user, { serviceOrderId: 'so1', kind: 'NFCE' })).rejects.toThrow('NFC-e desativada');
    repository.orderBundle.mockResolvedValueOnce(bundle('OPEN'));
    await expect(manager.issue(user, { serviceOrderId: 'so1', kind: 'NFSE' })).rejects.toThrow('aprovar o orçamento');
    repository.activeDocument.mockResolvedValueOnce(doc());
    await expect(manager.issue(user, { serviceOrderId: 'so1', kind: 'NFSE' })).rejects.toBeInstanceOf(ConflictException);
    repository.orderBundle.mockResolvedValueOnce({ ...bundle(), customer: { ...bundle().customer, document: '' } });
    await expect(manager.issue(user, { serviceOrderId: 'so1', kind: 'NFE' })).rejects.toThrow('CPF ou CNPJ');
    repository.settings.mockResolvedValueOnce(settings({ providerTokenHomologation: null, providerTokenProduction: null }));
    await expect(manager.issue(user, { serviceOrderId: 'so1', kind: 'NFSE' })).rejects.toThrow('cadastro da oficina');
  });

  it('refreshes processing notes and marks notes the provider never received', async () => {
    repository.document.mockResolvedValueOnce(doc());
    focus.status.mockResolvedValueOnce({ status: 'AUTHORIZED', number: '5' });
    expect(await manager.refresh(user, 'd1')).toMatchObject({ status: 'AUTHORIZED', number: '5' });
    expect(repository.updateDocument.mock.calls[0][1].issuedAt).toBeInstanceOf(Date);
    repository.document.mockResolvedValueOnce(doc());
    focus.status.mockRejectedValueOnce(new FocusNotFoundError('x'));
    expect(await manager.refresh(user, 'd1')).toMatchObject({ status: 'ERROR', errorMessage: expect.stringContaining('não recebeu') });
    repository.document.mockResolvedValueOnce(doc());
    focus.status.mockRejectedValueOnce(new ServiceUnavailableException('fora'));
    await expect(manager.refresh(user, 'd1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    repository.document.mockResolvedValueOnce(doc({ origin: 'MANUAL', status: 'AUTHORIZED' }));
    expect((await manager.refresh(user, 'd1')).origin).toBe('MANUAL');
    repository.document.mockResolvedValueOnce(doc());
    repository.settings.mockResolvedValueOnce(null);
    expect((await manager.refresh(user, 'd1')).status).toBe('PROCESSING');
    repository.document.mockResolvedValueOnce(null);
    await expect(manager.refresh(user, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cancels integrated notes at the provider and manual ones only locally', async () => {
    focus.cancel.mockResolvedValueOnce({ status: 'CANCELLED', xmlUrl: 'https://x/cancel.xml' });
    expect(await manager.cancel(user, { id: 'd1', reason: '  Valor lançado errado na nota  ' })).toMatchObject({ status: 'CANCELLED', cancelReason: 'Valor lançado errado na nota', xmlUrl: 'https://x/cancel.xml' });
    expect(focus.cancel).toHaveBeenCalledWith('NFSE', 'HOMOLOGACAO', 'homo', 'ofix-d1', 'Valor lançado errado na nota');
    repository.document.mockResolvedValueOnce(doc({ origin: 'MANUAL', status: 'AUTHORIZED', providerRef: null }));
    await manager.cancel(user, { id: 'd1', reason: 'Nota cancelada na prefeitura' });
    expect(focus.cancel).toHaveBeenCalledTimes(1);
    repository.document.mockResolvedValueOnce(doc({ status: 'ERROR' }));
    await expect(manager.cancel(user, { id: 'd1', reason: 'Nota cancelada na prefeitura' })).rejects.toThrow('nota emitida');
    repository.settings.mockResolvedValueOnce(null);
    await expect(manager.cancel(user, { id: 'd1', reason: 'Nota cancelada na prefeitura' })).rejects.toThrow('configuração fiscal');
  });

  it('registers a note issued elsewhere with its PDF and serves it back', async () => {
    const pdf = Buffer.from('%PDF-1.4 nota');
    const result = await manager.register(user, { serviceOrderId: 'so1', kind: 'NFSE', number: ' 123 ', issuedAt: '2026-11-10T12:00:00Z', amountCents: 10000, accessKey: '35.26', attachment: { name: 'nota.pdf', mimeType: 'application/pdf', dataBase64: pdf.toString('base64') } });
    const data = repository.createDocument.mock.calls[0][1];
    expect(data).toMatchObject({ origin: 'MANUAL', status: 'AUTHORIZED', number: '123', accessKey: '3526', attachmentName: 'nota.pdf' });
    expect(data.attachmentKey).toMatch(/^t1\/fiscal\/.+\.pdf$/);
    expect(await readdir(join(uploadDir, 't1', 'fiscal'))).toHaveLength(1);
    expect(result.hasAttachment).toBe(true);
    repository.document.mockResolvedValueOnce(doc({ attachmentKey: data.attachmentKey, attachmentName: 'nota.pdf', attachmentMimeType: 'application/pdf' }));
    expect(await manager.attachment('d1')).toEqual({ name: 'nota.pdf', mimeType: 'application/pdf', dataBase64: pdf.toString('base64') });
    await expect(manager.attachment('d1')).rejects.toBeInstanceOf(NotFoundException);
    await manager.register(user, { serviceOrderId: 'so1', kind: 'NFE', number: '9', issuedAt: '2026-11-10T12:00:00Z', amountCents: 1 });
    expect(repository.createDocument.mock.calls[1][1]).toMatchObject({ attachmentKey: null, series: null, notes: null });
    await expect(manager.register(user, { serviceOrderId: 'so1', kind: 'NFSE', number: '1', issuedAt: '2026-11-10', amountCents: 1, attachment: { name: 'a.exe', mimeType: 'application/x-msdownload', dataBase64: 'AA==' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(manager.register(user, { serviceOrderId: 'so1', kind: 'NFSE', number: '1', issuedAt: '2026-11-10', amountCents: 1, attachment: { name: 'a.pdf', mimeType: 'application/pdf', dataBase64: '' } })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletes manual records and failed attempts but never an issued or cancelled note', async () => {
    const pdf = await manager.register(user, { serviceOrderId: 'so1', kind: 'NFSE', number: '1', issuedAt: '2026-11-10', amountCents: 1, attachment: { name: 'n.pdf', mimeType: 'application/pdf', dataBase64: Buffer.from('x').toString('base64') } });
    expect(pdf.hasAttachment).toBe(true);
    const key = repository.createDocument.mock.calls[0][1].attachmentKey;
    repository.document.mockResolvedValueOnce(doc({ origin: 'MANUAL', status: 'AUTHORIZED', attachmentKey: key }));
    expect(await manager.remove(user, 'd1')).toEqual({ success: true });
    expect(await readdir(join(uploadDir, 't1', 'fiscal'))).toHaveLength(0);
    repository.document.mockResolvedValueOnce(doc({ status: 'ERROR' }));
    await manager.remove(user, 'd1');
    expect(repository.deleteDocument).toHaveBeenCalledTimes(2);
    repository.document.mockResolvedValueOnce(doc({ status: 'AUTHORIZED' }));
    await expect(manager.remove(user, 'd1')).rejects.toThrow('Cancele a nota');
    repository.document.mockResolvedValueOnce(doc({ status: 'CANCELLED' }));
    await expect(manager.remove(user, 'd1')).rejects.toThrow('histórico');
  });
});
