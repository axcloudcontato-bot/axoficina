import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { FiscalDocument, FiscalSettings } from '@oficina/database';
import { FISCAL_DEFAULTS, type CancelFiscalDocumentRequest, type FiscalAttachmentResponse, type FiscalDocumentKind, type FiscalDocumentResponse, type FiscalEnvironment, type FiscalPreviewResponse, type FiscalSettingsResponse, type IssueFiscalDocumentRequest, type RegisterFiscalDocumentRequest, type UpdateFiscalSettingsRequest, type UploadFiscalCertificateRequest } from '@oficina/contracts';
import { AuditLogService } from '../../shared/audit-log/audit-log.service';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { TenantRepository } from '../iam/repositories/tenant.repository';
import { SecretEncryptionService } from '../settings/services/secret-encryption.service';
import { buildCompanyPayload, buildMerchandisePayload, buildNfsePayload, fiscalReadiness, onlyDigits, previewDocument, type FiscalConfig, type FiscalTenant } from './fiscal-payload';
import { FiscalRepository } from './fiscal.repository';
import { FocusNfeClient, FocusNotFoundError, type FocusDocumentResult } from './focus-nfe.client';
import { IbgeCityService } from './ibge-city.service';

const ATTACHMENT_EXTENSIONS: Record<string, string> = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'application/xml': '.xml', 'text/xml': '.xml' };
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const MAX_CERTIFICATE_BYTES = 64 * 1024;
// Orders still being quoted have no definitive values to put on a note.
const ISSUABLE_STATUSES = ['IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'DELIVERED'];

@Injectable()
export class FiscalManager {
  private readonly logger = new Logger(FiscalManager.name);
  private readonly uploadRoot: string;

  constructor(
    private readonly repository: FiscalRepository,
    private readonly tenants: TenantRepository,
    private readonly focus: FocusNfeClient,
    private readonly ibge: IbgeCityService,
    private readonly secrets: SecretEncryptionService,
    private readonly audit: AuditLogService,
    config: ConfigService,
  ) {
    this.uploadRoot = resolve(config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads')));
  }

  async getSettings(user: AuthenticatedUser): Promise<FiscalSettingsResponse> {
    const [tenant, settings] = await Promise.all([this.tenant(user.tenantId), this.repository.settings(user.tenantId)]);
    // First visit: suggest the city code from the workshop address so the form starts filled in.
    const cityIbgeCode = settings?.cityIbgeCode ?? (await this.ibge.codeFor(tenant.addressCity, tenant.addressState));
    return this.toSettingsResponse(tenant, settings, cityIbgeCode ?? undefined);
  }

  async updateSettings(user: AuthenticatedUser, input: UpdateFiscalSettingsRequest): Promise<FiscalSettingsResponse> {
    const tenant = await this.tenant(user.tenantId);
    const current = await this.repository.settings(user.tenantId);
    const nfceCsc = input.nfceCsc?.trim();
    let settings = await this.repository.saveSettings(user.tenantId, {
      environment: input.environment,
      taxRegime: input.taxRegime,
      municipalRegistration: input.municipalRegistration?.trim() || null,
      cityIbgeCode: onlyDigits(input.cityIbgeCode) || null,
      cnae: onlyDigits(input.cnae) || null,
      nfseEnabled: input.nfseEnabled,
      nfeEnabled: input.nfeEnabled,
      nfceEnabled: input.nfceEnabled,
      serviceListItem: input.serviceListItem.trim(),
      municipalTaxCode: input.municipalTaxCode?.trim() || null,
      issRatePercent: input.issRatePercent ?? null,
      issWithheld: input.issWithheld,
      defaultNcm: onlyDigits(input.defaultNcm),
      defaultCfop: onlyDigits(input.defaultCfop),
      csosn: onlyDigits(input.csosn),
      pisCofinsCst: onlyDigits(input.pisCofinsCst),
      nfceCscId: input.nfceCscId?.trim() || null,
      ...(nfceCsc ? { nfceCsc: this.secrets.encrypt(nfceCsc) } : {}),
    });
    // Keep the registration at the provider in step with what was just saved (only once a certificate exists).
    if (this.focus.available && (current?.providerCompanyId || settings.certificateUploadedAt)) settings = await this.syncCompany(user.tenantId, tenant, settings);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'fiscal.settings_updated', entity: 'tenant', entityId: user.tenantId, metadata: { itemAction: 'update', environment: settings.environment } });
    return this.toSettingsResponse(tenant, settings);
  }

  async uploadCertificate(user: AuthenticatedUser, input: UploadFiscalCertificateRequest): Promise<FiscalSettingsResponse> {
    if (!this.focus.available) throw new UnprocessableEntityException('A emissão pelo Ofix ainda não está ativa neste servidor. Enquanto isso, registre as notas emitidas fora do sistema.');
    if (!/\.(pfx|p12)$/i.test(input.fileName)) throw new BadRequestException('Envie o certificado A1 no formato .pfx ou .p12.');
    const content = Buffer.from(input.dataBase64, 'base64');
    if (!content.length || content.length > MAX_CERTIFICATE_BYTES) throw new BadRequestException('O arquivo do certificado está vazio ou grande demais.');
    const tenant = await this.tenant(user.tenantId);
    if (onlyDigits(tenant.document).length !== 14) throw new UnprocessableEntityException('A emissão de notas exige que o documento da oficina seja um CNPJ (Configurações → Empresa e marca).');
    let settings = (await this.repository.settings(user.tenantId)) ?? (await this.repository.saveSettings(user.tenantId, {}));
    // The certificate and its password go straight to the provider; the Ofix never stores either.
    settings = await this.syncCompany(user.tenantId, tenant, settings, { dataBase64: content.toString('base64'), password: input.password }, true);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'fiscal.certificate_uploaded', entity: 'tenant', entityId: user.tenantId, metadata: { itemAction: 'update' } });
    return this.toSettingsResponse(tenant, settings);
  }

  async list(serviceOrderId: string): Promise<FiscalDocumentResponse[]> {
    await this.bundle(serviceOrderId);
    return (await this.repository.documents(serviceOrderId)).map(toDocumentResponse);
  }

  async preview(user: AuthenticatedUser, serviceOrderId: string, kind: FiscalDocumentKind): Promise<FiscalPreviewResponse> {
    const { tenant, bundle, config } = await this.context(user.tenantId, serviceOrderId);
    const preview = previewDocument(kind, bundle.order, bundle.customer, config);
    const blockers = fiscalReadiness(tenant, config, this.focus.available)[kind];
    if (!ISSUABLE_STATUSES.includes(bundle.status)) blockers.push('A nota só pode ser emitida depois que o cliente aprovar o orçamento e o serviço começar.');
    return { kind, ...preview, blockers, environment: config.environment as FiscalEnvironment };
  }

  async issue(user: AuthenticatedUser, request: IssueFiscalDocumentRequest): Promise<FiscalDocumentResponse> {
    const { tenant, settings, bundle, config } = await this.context(user.tenantId, request.serviceOrderId);
    const blockers = fiscalReadiness(tenant, config, this.focus.available)[request.kind];
    if (blockers.length) throw new UnprocessableEntityException(blockers[0]);
    if (!ISSUABLE_STATUSES.includes(bundle.status)) throw new UnprocessableEntityException('A nota só pode ser emitida depois que o cliente aprovar o orçamento e o serviço começar.');
    if (await this.repository.activeDocument(request.serviceOrderId, request.kind)) throw new ConflictException('Esta OS já tem uma nota deste tipo emitida ou em processamento. Cancele a anterior para emitir outra.');
    const preview = previewDocument(request.kind, bundle.order, bundle.customer, config);
    if (preview.problems.length) throw new UnprocessableEntityException(preview.problems[0]);
    const environment = settings!.environment as FiscalEnvironment;
    const token = this.token(settings!, environment);
    const issuedAt = new Date();
    const payload = request.kind === 'NFSE'
      ? buildNfsePayload({ tenant, config, order: bundle.order, customer: bundle.customer, preview, issuedAt, customerCityIbgeCode: await this.ibge.codeFor(bundle.customer.address?.city, bundle.customer.address?.state) })
      : buildMerchandisePayload(request.kind, { tenant, config, order: bundle.order, customer: bundle.customer, preview, issuedAt });
    const id = randomUUID();
    const ref = `ofix-${id}`;
    let document = await this.repository.createDocument(user.tenantId, {
      id, serviceOrderId: request.serviceOrderId, kind: request.kind, origin: 'INTEGRATED', environment, status: 'PROCESSING', providerRef: ref,
      amountCents: preview.amountCents, itemIds: preview.items.map((item) => item.id), createdBy: user.userId,
    });
    try {
      document = await this.apply(document, await this.focus.issue(request.kind, environment, token, ref, payload));
    } catch (error) {
      // A validation refusal is final; an unreachable provider leaves it processing so "Atualizar" can find out.
      if (error instanceof UnprocessableEntityException) document = await this.repository.updateDocument(document.id, { status: 'ERROR', errorMessage: error.message });
      else if (error instanceof ServiceUnavailableException) document = await this.repository.updateDocument(document.id, { errorMessage: error.message });
      else throw error;
    }
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'fiscal.document_issued', entity: 'fiscal_document', entityId: document.id, metadata: { serviceOrderId: request.serviceOrderId, kind: request.kind, status: document.status, environment, amountCents: document.amountCents } });
    return toDocumentResponse(document);
  }

  async refresh(user: AuthenticatedUser, id: string): Promise<FiscalDocumentResponse> {
    const document = await this.requireDocument(id);
    if (document.origin !== 'INTEGRATED' || !document.providerRef || !['PROCESSING', 'AUTHORIZED'].includes(document.status)) return toDocumentResponse(document);
    const settings = await this.repository.settings(user.tenantId);
    if (!settings) return toDocumentResponse(document);
    try {
      const result = await this.focus.status(document.kind as FiscalDocumentKind, document.environment as FiscalEnvironment, this.token(settings, document.environment as FiscalEnvironment), document.providerRef);
      return toDocumentResponse(await this.apply(document, result));
    } catch (error) {
      if (error instanceof FocusNotFoundError) return toDocumentResponse(await this.repository.updateDocument(document.id, { status: 'ERROR', errorMessage: 'O emissor não recebeu esta nota. Exclua o registro e emita de novo.' }));
      throw error;
    }
  }

  async cancel(user: AuthenticatedUser, request: CancelFiscalDocumentRequest): Promise<FiscalDocumentResponse> {
    const document = await this.requireDocument(request.id);
    if (document.status !== 'AUTHORIZED') throw new UnprocessableEntityException('Só é possível cancelar uma nota emitida.');
    const reason = request.reason.trim();
    let updated: FiscalDocument;
    if (document.origin === 'MANUAL') {
      // Notes issued outside the Ofix are cancelled where they were issued; here we only record it.
      updated = await this.repository.updateDocument(document.id, { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason });
    } else {
      const settings = await this.repository.settings(user.tenantId);
      if (!settings || !document.providerRef) throw new UnprocessableEntityException('A configuração fiscal da oficina não foi encontrada.');
      const result = await this.focus.cancel(document.kind as FiscalDocumentKind, document.environment as FiscalEnvironment, this.token(settings, document.environment as FiscalEnvironment), document.providerRef, reason);
      updated = await this.repository.updateDocument(document.id, { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason, ...(result.xmlUrl ? { xmlUrl: result.xmlUrl } : {}) });
    }
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'fiscal.document_cancelled', entity: 'fiscal_document', entityId: document.id, metadata: { serviceOrderId: document.serviceOrderId, kind: document.kind, origin: document.origin } });
    return toDocumentResponse(updated);
  }

  async register(user: AuthenticatedUser, request: RegisterFiscalDocumentRequest): Promise<FiscalDocumentResponse> {
    await this.bundle(request.serviceOrderId);
    const id = randomUUID();
    let attachment: { key: string; name: string; mimeType: string } | undefined;
    if (request.attachment) {
      const extension = ATTACHMENT_EXTENSIONS[request.attachment.mimeType];
      const content = Buffer.from(request.attachment.dataBase64, 'base64');
      if (!extension) throw new BadRequestException('Anexe a nota em PDF, XML, PNG ou JPG.');
      if (!content.length || content.length > MAX_ATTACHMENT_BYTES) throw new BadRequestException('O arquivo da nota deve ter até 2 MB.');
      // Under UPLOAD_DIR/<tenantId>, so closing the account also removes it.
      const key = `${user.tenantId}/fiscal/${id}${extension}`;
      const target = this.resolveKey(key);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, { flag: 'wx' });
      attachment = { key, name: request.attachment.name.slice(0, 160), mimeType: request.attachment.mimeType };
    }
    const document = await this.repository.createDocument(user.tenantId, {
      id, serviceOrderId: request.serviceOrderId, kind: request.kind, origin: 'MANUAL', status: 'AUTHORIZED',
      number: request.number.trim(), series: request.series?.trim() || null, issuedAt: new Date(request.issuedAt), amountCents: request.amountCents,
      verificationCode: request.verificationCode?.trim() || null, accessKey: onlyDigits(request.accessKey) || null, notes: request.notes?.trim() || null,
      attachmentKey: attachment?.key ?? null, attachmentName: attachment?.name ?? null, attachmentMimeType: attachment?.mimeType ?? null, createdBy: user.userId,
    });
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'fiscal.document_registered', entity: 'fiscal_document', entityId: document.id, metadata: { serviceOrderId: request.serviceOrderId, kind: request.kind, amountCents: request.amountCents } });
    return toDocumentResponse(document);
  }

  async remove(user: AuthenticatedUser, id: string): Promise<{ success: true }> {
    const document = await this.requireDocument(id);
    // An issued note has fiscal effect: it must be cancelled, not erased. Manual records and failed attempts can go.
    if (document.origin === 'INTEGRATED' && !['ERROR', 'CANCELLED'].includes(document.status)) throw new UnprocessableEntityException('Uma nota emitida não pode ser excluída. Cancele a nota.');
    if (document.origin === 'INTEGRATED' && document.status === 'CANCELLED') throw new UnprocessableEntityException('Notas canceladas ficam no histórico da OS.');
    await this.repository.deleteDocument(document.id);
    if (document.attachmentKey) await rm(this.resolveKey(document.attachmentKey), { force: true });
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'fiscal.document_deleted', entity: 'fiscal_document', entityId: document.id, metadata: { serviceOrderId: document.serviceOrderId, kind: document.kind, origin: document.origin } });
    return { success: true };
  }

  async attachment(id: string): Promise<FiscalAttachmentResponse> {
    const document = await this.requireDocument(id);
    if (!document.attachmentKey) throw new NotFoundException('Esta nota não tem arquivo anexado.');
    const content = await readFile(this.resolveKey(document.attachmentKey));
    return { name: document.attachmentName ?? 'nota-fiscal', mimeType: document.attachmentMimeType ?? 'application/pdf', dataBase64: content.toString('base64') };
  }

  private async syncCompany(tenantId: string, tenant: FiscalTenant, settings: FiscalSettings, certificate?: { dataBase64: string; password: string }, failLoudly = false): Promise<FiscalSettings> {
    try {
      const company = await this.focus.saveCompany(settings.providerCompanyId, buildCompanyPayload({ tenant, config: this.config(settings), nfceCsc: settings.nfceCsc ? this.secrets.decrypt(settings.nfceCsc) : null, certificate }));
      return await this.repository.saveSettings(tenantId, {
        providerCompanyId: company.id,
        ...(company.tokenProduction ? { providerTokenProduction: this.secrets.encrypt(company.tokenProduction) } : {}),
        ...(company.tokenHomologation ? { providerTokenHomologation: this.secrets.encrypt(company.tokenHomologation) } : {}),
        ...(company.certificateValidUntil ? { certificateValidUntil: company.certificateValidUntil } : {}),
        ...(certificate ? { certificateUploadedAt: new Date() } : {}),
        lastSyncAt: new Date(), lastSyncError: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao atualizar o cadastro no emissor.';
      this.logger.warn(`Cadastro fiscal da oficina ${tenantId} não sincronizado: ${message}`);
      const saved = await this.repository.saveSettings(tenantId, { lastSyncAt: new Date(), lastSyncError: message });
      if (failLoudly) throw error;
      return saved;
    }
  }

  private async apply(document: FiscalDocument, result: FocusDocumentResult): Promise<FiscalDocument> {
    return this.repository.updateDocument(document.id, {
      status: result.status,
      number: result.number ?? document.number,
      series: result.series ?? document.series,
      verificationCode: result.verificationCode ?? document.verificationCode,
      accessKey: result.accessKey ?? document.accessKey,
      issuedAt: result.issuedAt ?? (result.status === 'AUTHORIZED' ? document.issuedAt ?? new Date() : document.issuedAt),
      pdfUrl: result.pdfUrl ?? document.pdfUrl,
      xmlUrl: result.xmlUrl ?? document.xmlUrl,
      errorMessage: result.status === 'ERROR' ? result.errorMessage ?? 'O emissor recusou a nota.' : null,
      ...(result.status === 'CANCELLED' && !document.cancelledAt ? { cancelledAt: new Date() } : {}),
    });
  }

  private token(settings: FiscalSettings, environment: FiscalEnvironment): string {
    const stored = environment === 'PRODUCAO' ? settings.providerTokenProduction : settings.providerTokenHomologation;
    if (!stored) throw new UnprocessableEntityException('O cadastro da oficina no emissor não foi concluído. Envie o certificado novamente.');
    return this.secrets.decrypt(stored);
  }

  private async context(tenantId: string, serviceOrderId: string) {
    const [tenant, settings, bundle] = await Promise.all([this.tenant(tenantId), this.repository.settings(tenantId), this.bundle(serviceOrderId)]);
    return { tenant, settings, bundle, config: this.config(settings) };
  }

  private async bundle(serviceOrderId: string) {
    const bundle = await this.repository.orderBundle(serviceOrderId);
    if (!bundle) throw new NotFoundException('Ordem de serviço não encontrada.');
    return bundle;
  }

  private async requireDocument(id: string): Promise<FiscalDocument> {
    const document = await this.repository.document(id);
    if (!document) throw new NotFoundException('Nota fiscal não encontrada.');
    return document;
  }

  private async tenant(tenantId: string): Promise<FiscalTenant> {
    const tenant = await this.tenants.byId(tenantId);
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    return tenant;
  }

  private config(settings: FiscalSettings | null, cityIbgeCode?: string): FiscalConfig {
    return {
      environment: settings?.environment ?? 'HOMOLOGACAO',
      taxRegime: settings?.taxRegime ?? 'SIMPLES_NACIONAL',
      municipalRegistration: settings?.municipalRegistration,
      cityIbgeCode: settings?.cityIbgeCode ?? cityIbgeCode,
      cnae: settings?.cnae,
      nfseEnabled: settings?.nfseEnabled ?? true,
      nfeEnabled: settings?.nfeEnabled ?? false,
      nfceEnabled: settings?.nfceEnabled ?? false,
      serviceListItem: settings?.serviceListItem ?? FISCAL_DEFAULTS.serviceListItem,
      municipalTaxCode: settings?.municipalTaxCode,
      issRatePercent: settings?.issRatePercent === null || settings?.issRatePercent === undefined ? null : Number(settings.issRatePercent),
      issWithheld: settings?.issWithheld ?? false,
      defaultNcm: settings?.defaultNcm ?? FISCAL_DEFAULTS.defaultNcm,
      defaultCfop: settings?.defaultCfop ?? FISCAL_DEFAULTS.defaultCfop,
      csosn: settings?.csosn ?? FISCAL_DEFAULTS.csosn,
      pisCofinsCst: settings?.pisCofinsCst ?? FISCAL_DEFAULTS.pisCofinsCst,
      nfceCscId: settings?.nfceCscId,
      hasNfceCsc: Boolean(settings?.nfceCsc),
      certificateUploaded: Boolean(settings?.certificateUploadedAt),
      companyRegistered: Boolean(settings?.providerCompanyId && (settings.providerTokenHomologation || settings.providerTokenProduction)),
    };
  }

  private toSettingsResponse(tenant: FiscalTenant, settings: FiscalSettings | null, suggestedCityCode?: string): FiscalSettingsResponse {
    const config = this.config(settings, suggestedCityCode);
    return {
      providerAvailable: this.focus.available,
      environment: config.environment as FiscalEnvironment,
      taxRegime: config.taxRegime as FiscalSettingsResponse['taxRegime'],
      document: tenant.document,
      legalName: tenant.legalName ?? undefined,
      stateRegistration: tenant.stateRegistration ?? undefined,
      municipalRegistration: config.municipalRegistration ?? undefined,
      cityIbgeCode: config.cityIbgeCode ?? undefined,
      cnae: config.cnae ?? undefined,
      nfseEnabled: config.nfseEnabled,
      nfeEnabled: config.nfeEnabled,
      nfceEnabled: config.nfceEnabled,
      serviceListItem: config.serviceListItem,
      municipalTaxCode: config.municipalTaxCode ?? undefined,
      issRatePercent: config.issRatePercent ?? undefined,
      issWithheld: config.issWithheld,
      defaultNcm: config.defaultNcm,
      defaultCfop: config.defaultCfop,
      csosn: config.csosn,
      pisCofinsCst: config.pisCofinsCst,
      nfceCscId: config.nfceCscId ?? undefined,
      hasNfceCsc: config.hasNfceCsc,
      certificate: { uploaded: config.certificateUploaded, validUntil: settings?.certificateValidUntil?.toISOString(), uploadedAt: settings?.certificateUploadedAt?.toISOString() },
      companyRegistered: config.companyRegistered,
      lastSyncError: settings?.lastSyncError ?? undefined,
      lastSyncAt: settings?.lastSyncAt?.toISOString(),
      readiness: fiscalReadiness(tenant, config, this.focus.available),
    };
  }

  private resolveKey(key: string): string {
    const target = resolve(this.uploadRoot, key);
    if (target !== this.uploadRoot && !target.startsWith(`${this.uploadRoot}${sep}`)) throw new Error('Chave de armazenamento inválida.');
    return target;
  }
}

export function toDocumentResponse(document: FiscalDocument): FiscalDocumentResponse {
  return {
    id: document.id,
    serviceOrderId: document.serviceOrderId,
    kind: document.kind as FiscalDocumentKind,
    origin: document.origin as FiscalDocumentResponse['origin'],
    environment: (document.environment ?? undefined) as FiscalEnvironment | undefined,
    status: document.status as FiscalDocumentResponse['status'],
    number: document.number ?? undefined,
    series: document.series ?? undefined,
    verificationCode: document.verificationCode ?? undefined,
    accessKey: document.accessKey ?? undefined,
    issuedAt: document.issuedAt?.toISOString(),
    amountCents: document.amountCents,
    pdfUrl: document.pdfUrl ?? undefined,
    xmlUrl: document.xmlUrl ?? undefined,
    hasAttachment: Boolean(document.attachmentKey),
    attachmentName: document.attachmentName ?? undefined,
    errorMessage: document.errorMessage ?? undefined,
    cancelledAt: document.cancelledAt?.toISOString(),
    cancelReason: document.cancelReason ?? undefined,
    notes: document.notes ?? undefined,
    createdAt: document.createdAt.toISOString(),
  };
}
