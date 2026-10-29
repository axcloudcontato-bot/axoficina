import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CreateCustomerRequest,
  CustomerArchiveImpactResponse,
  CustomerListStats,
  ImportCustomersProblem,
  ImportCustomersRequest,
  ImportCustomersResponse,
  MergeCustomersRequest,
  MergeCustomersResponse,
  CustomerOverviewResponse,
  CustomerListItemResponse,
  CustomerListRequest,
  CustomerResponse,
  PaginationData,
  UpdateCustomerRequest,
} from '@oficina/contracts';
import { Prisma } from '@oficina/database';
import type { Customer as CustomerEntity } from '@oficina/database';
import { AppErrorCode } from '../../../shared/errors/app-error-code';
import { AppException } from '../../../shared/errors/app-exception';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import { DocumentValidatorService } from '../../../shared/documents/document-validator.service';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { CustomerRepository } from '../repositories/customer.repository';
import { whatsappRecipient } from '../../settings/services/whatsapp-recipient';
import { summarizeHistory } from '../services/customer-stats';
import type { UpdateCustomerInput } from '../repositories/customer.repository';

const normalizeName = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
// Same number whatever the mask or the country code.
const phoneKey = (value: string) => { const digits = value.replace(/\D/g, ''); return digits.startsWith('55') && [12, 13].includes(digits.length) ? digits.slice(2) : digits; };

// What the person asking may see: money figures are for those who may see prices.
export interface CustomerViewer { canViewPrices: boolean }
const NO_PRICES: CustomerViewer = { canViewPrices: false };
const INACTIVE_AFTER_DAYS = 180;

@Injectable()
export class CustomerManager {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly documentValidator: DocumentValidatorService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(actingUser: AuthenticatedUser, request: CreateCustomerRequest): Promise<{ customer: CustomerResponse }> {
    const birthDate = this.birthDate(request.birthDate, request.type);
    this.validateNotificationPhone(request.notifyServiceOrderUpdates, request.phone);
    const documentCheck = request.document?.trim()
      ? this.documentValidator.validate(request.document)
      : { valid: true, normalized: '' };
    if (!documentCheck.valid) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'CPF/CNPJ inválido.');
    }
    this.assertDocumentFitsType(request.type, documentCheck);

    const existing = documentCheck.normalized ? await this.customerRepository.byDocument(documentCheck.normalized) : null;
    if (existing) {
      throw new AppException(
        AppErrorCode.CUSTOMER_DOCUMENT_ALREADY_EXISTS,
        'Já existe um cliente cadastrado com este documento.',
        HttpStatus.CONFLICT,
      );
    }

    // O check acima (byDocument) tem uma janela de corrida entre duas
    // requisições concorrentes com o mesmo documento — o catch abaixo é a
    // rede de segurança que garante 409 (não 500) mesmo nesse caso, contra
    // o índice único parcial composto (tenant_id, document).
    let customer: CustomerEntity;
    try {
      customer = await this.customerRepository.insert({
        tenantId: actingUser.tenantId,
        type: request.type,
        document: documentCheck.normalized,
        name: request.name,
        phone: request.phone,
        birthDate,
        careMessagesEnabled: request.careMessagesEnabled,
        careConsentAt: request.careMessagesEnabled ? new Date() : undefined,
        careConsentSource: request.careMessagesEnabled ? request.careConsentSource : undefined,
        careConsentBy: request.careMessagesEnabled ? actingUser.userId : undefined,
        email: request.email,
        address: request.address,
        notes: request.notes,
        rg: request.rg,
        stateRegistration: request.stateRegistration,
        secondaryContactName: request.secondaryContactName,
        secondaryContactPhone: request.secondaryContactPhone,
        secondaryContactRelation: request.secondaryContactRelation,
        preferredContactChannel: request.preferredContactChannel,
        preferredContactTime: request.preferredContactTime,
        notifyServiceOrderUpdates: request.notifyServiceOrderUpdates,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(
          AppErrorCode.CUSTOMER_DOCUMENT_ALREADY_EXISTS,
          'Já existe um cliente cadastrado com este documento.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }

    await this.auditLog.record({
      tenantId: actingUser.tenantId,
      userId: actingUser.userId,
      action: 'customer.created',
      entity: 'customer',
      entityId: customer.id,
      metadata: { ...(request.notifyServiceOrderUpdates === undefined ? {} : { notifyServiceOrderUpdates: request.notifyServiceOrderUpdates }), ...(request.careMessagesEnabled === undefined ? {} : { careMessagesEnabled: request.careMessagesEnabled }) },
    });

    return { customer: this.toResponse(customer) };
  }

  async update(actingUser: AuthenticatedUser, request: UpdateCustomerRequest): Promise<{ customer: CustomerResponse }> {
    const existing = await this.customerRepository.byId(request.id);
    if (!existing) {
      throw new AppException(AppErrorCode.CUSTOMER_NOT_FOUND, 'Cliente não encontrado.', HttpStatus.NOT_FOUND);
    }
    this.validateNotificationPhone(request.notifyServiceOrderUpdates ?? existing.notifyServiceOrderUpdates, request.phone ?? existing.phone);
    const type = request.type ?? (existing.type as CustomerResponse['type']);
    const typeChanged = type !== existing.type;
    // A company has no birth date: switching to PJ clears it, whatever the request carries.
    const birthDate = type === 'PJ' ? (typeChanged || request.birthDate === null ? null : undefined) : request.birthDate === undefined ? undefined : request.birthDate === null ? null : this.birthDate(request.birthDate, type);

    let document: string | undefined;
    // A new type has to be checked against the document already on file, too.
    const documentToCheck = request.document !== undefined ? request.document : typeChanged ? existing.document : undefined;
    if (documentToCheck !== undefined) {
      const checked = documentToCheck.trim() ? this.documentValidator.validate(documentToCheck) : { valid: true, normalized: '' };
      if (!checked.valid) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'CPF/CNPJ inválido.');
      this.assertDocumentFitsType(type, checked);
      const duplicate = checked.normalized ? await this.customerRepository.byDocument(checked.normalized) : null;
      if (duplicate && duplicate.id !== existing.id) throw new AppException(AppErrorCode.CUSTOMER_DOCUMENT_ALREADY_EXISTS, 'Já existe um cliente cadastrado com este documento.', HttpStatus.CONFLICT);
      if (request.document !== undefined) document = checked.normalized;
    }
    // Corrigir ou remover documento não exige recriar o cadastro.
    try {
      await this.customerRepository.update(request.id, {
        ...(typeChanged ? { type } : {}),
        document,
        name: request.name,
        phone: request.phone,
        birthDate,
        careMessagesEnabled: request.careMessagesEnabled,
        careConsentAt: request.careMessagesEnabled && !existing.careMessagesEnabled ? new Date() : undefined,
        // The source and who recorded it belong to the moment consent was given, so they follow the date.
        careConsentSource: request.careMessagesEnabled && !existing.careMessagesEnabled ? request.careConsentSource : undefined,
        careConsentBy: request.careMessagesEnabled && !existing.careMessagesEnabled ? actingUser.userId : undefined,
        email: request.email,
        address: request.address,
        notes: request.notes,
        rg: typeChanged && type === 'PJ' ? null : request.rg,
        stateRegistration: typeChanged && type === 'PF' ? null : request.stateRegistration,
        secondaryContactName: request.secondaryContactName,
        secondaryContactPhone: request.secondaryContactPhone,
        secondaryContactRelation: request.secondaryContactRelation,
        preferredContactChannel: request.preferredContactChannel,
        preferredContactTime: request.preferredContactTime,
        notifyServiceOrderUpdates: request.notifyServiceOrderUpdates,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppException(AppErrorCode.CUSTOMER_DOCUMENT_ALREADY_EXISTS, 'Já existe um cliente cadastrado com este documento.', HttpStatus.CONFLICT);
      throw error;
    }

    const updated = await this.customerRepository.byId(request.id);
    if (!updated) {
      throw new AppException(AppErrorCode.CUSTOMER_NOT_FOUND, 'Cliente não encontrado.', HttpStatus.NOT_FOUND);
    }

    await this.auditLog.record({
      tenantId: actingUser.tenantId,
      userId: actingUser.userId,
      action: 'customer.updated',
      entity: 'customer',
      entityId: updated.id,
      metadata: { ...(request.notifyServiceOrderUpdates === undefined ? {} : { notifyServiceOrderUpdates: request.notifyServiceOrderUpdates }), ...(request.careMessagesEnabled === undefined ? {} : { careMessagesEnabled: request.careMessagesEnabled }) },
    });

    return { customer: this.toResponse(updated) };
  }

  async delete(actingUser: AuthenticatedUser, id: string): Promise<{ customer: CustomerResponse }> {
    const existing = await this.customerRepository.byId(id);
    if (!existing) {
      throw new AppException(AppErrorCode.CUSTOMER_NOT_FOUND, 'Cliente não encontrado.', HttpStatus.NOT_FOUND);
    }

    const { count } = await this.customerRepository.softDelete(id);
    if (count === 0) {
      // Deletado por outra requisição concorrente entre o byId acima e
      // agora — mesmo raciocínio de corrida do create() (ver comentário lá).
      throw new AppException(AppErrorCode.CUSTOMER_NOT_FOUND, 'Cliente não encontrado.', HttpStatus.NOT_FOUND);
    }

    await this.auditLog.record({
      tenantId: actingUser.tenantId,
      userId: actingUser.userId,
      action: 'customer.deleted',
      entity: 'customer',
      entityId: id,
      metadata: {},
    });

    return { customer: this.toResponse(existing) };
  }

  // Joins a duplicate into the customer to keep. Fields the kept customer lacks are filled from the duplicate;
  // the consent to care messages is never copied, because it belongs to what that registration was told.
  async merge(actingUser: AuthenticatedUser, request: MergeCustomersRequest): Promise<MergeCustomersResponse> {
    if (request.keepId === request.mergeId) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Escolha dois cadastros diferentes para juntar.');
    const [keep, duplicate] = await Promise.all([this.customerRepository.byId(request.keepId), this.customerRepository.byId(request.mergeId)]);
    if (!keep || !duplicate) throw new AppException(AppErrorCode.CUSTOMER_NOT_FOUND, 'Cliente não encontrado.', HttpStatus.NOT_FOUND);
    if (keep.type !== duplicate.type) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Só é possível juntar cadastros do mesmo tipo (pessoa física com pessoa física, empresa com empresa).');

    const patch: UpdateCustomerInput = {};
    const fill = <K extends keyof UpdateCustomerInput>(key: K, keepValue: unknown, duplicateValue: UpdateCustomerInput[K] | undefined) => {
      if ((keepValue === null || keepValue === undefined || keepValue === '') && duplicateValue !== null && duplicateValue !== undefined && duplicateValue !== '') patch[key] = duplicateValue;
    };
    fill('document', keep.document, duplicate.document);
    fill('email', keep.email, duplicate.email);
    fill('birthDate', keep.birthDate, duplicate.birthDate);
    fill('rg', keep.rg, duplicate.rg);
    fill('stateRegistration', keep.stateRegistration, duplicate.stateRegistration);
    fill('address', keep.address, duplicate.address as UpdateCustomerInput['address']);
    fill('secondaryContactName', keep.secondaryContactName, duplicate.secondaryContactName);
    fill('secondaryContactPhone', keep.secondaryContactPhone, duplicate.secondaryContactPhone);
    fill('secondaryContactRelation', keep.secondaryContactRelation, duplicate.secondaryContactRelation);
    fill('preferredContactChannel', keep.preferredContactChannel, duplicate.preferredContactChannel);
    fill('preferredContactTime', keep.preferredContactTime, duplicate.preferredContactTime);
    if (duplicate.notes?.trim()) patch.notes = [keep.notes?.trim(), `Do cadastro unido (${duplicate.name}): ${duplicate.notes.trim()}`].filter(Boolean).join('\n\n').slice(0, 2000);

    const moved = await this.customerRepository.mergeInto(keep.id, duplicate.id, patch);
    await this.auditLog.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'customer.merged', entity: 'customer', entityId: keep.id, metadata: {} });
    const updated = await this.customerRepository.byId(keep.id);
    return { customer: this.toResponse(updated ?? keep), ...moved };
  }

  // Spreadsheet import. A row that is invalid, or that matches a customer already registered (same document,
  // or same name and phone), is reported instead of imported; the rest go in.
  async importRows(actingUser: AuthenticatedUser, request: ImportCustomersRequest): Promise<ImportCustomersResponse> {
    const existing = await this.customerRepository.allForMatching();
    const documents = new Set(existing.map((customer) => customer.document).filter(Boolean));
    const people = new Set(existing.map((customer) => `${normalizeName(customer.name)}|${phoneKey(customer.phone)}`));
    const problems: ImportCustomersProblem[] = [];
    let created = 0;

    for (const row of request.rows) {
      const name = row.name.trim();
      const fail = (reason: string) => problems.push({ line: row.line, name: name || '(sem nome)', reason });
      if (!name) { fail('Falta o nome.'); continue; }
      if (phoneKey(row.phone).length < 8) { fail('Telefone inválido ou ausente.'); continue; }
      const checked = row.document?.trim() ? this.documentValidator.validate(row.document) : { valid: true, type: null, normalized: '' };
      if (!checked.valid) { fail('CPF/CNPJ inválido.'); continue; }
      const type = row.type ?? (checked.type === 'CNPJ' ? 'PJ' : 'PF');
      try { this.assertDocumentFitsType(type, checked); } catch { fail(type === 'PF' ? 'Pessoa física usa CPF.' : 'Pessoa jurídica usa CNPJ.'); continue; }
      if (row.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) { fail('E-mail inválido.'); continue; }
      if (checked.normalized && documents.has(checked.normalized)) { fail('Já existe um cliente com este documento.'); continue; }
      const personKey = `${normalizeName(name)}|${phoneKey(row.phone)}`;
      if (people.has(personKey)) { fail('Já existe um cliente com este nome e telefone.'); continue; }
      try {
        const customer = await this.customerRepository.insert({ tenantId: actingUser.tenantId, type, document: checked.normalized, name, phone: row.phone.trim(), email: row.email?.trim() || undefined });
        created += 1;
        if (customer.document) documents.add(customer.document);
        people.add(personKey);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { fail('Já existe um cliente com este documento.'); continue; }
        throw error;
      }
    }
    await this.auditLog.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'customer.imported', entity: 'customer', entityId: actingUser.tenantId, metadata: {} });
    return { created, problems };
  }

  async restore(actingUser: AuthenticatedUser, id: string): Promise<{ customer: CustomerResponse }> {
    const archived = await this.customerRepository.archivedById(id);
    if (!archived) throw new AppException(AppErrorCode.CUSTOMER_NOT_FOUND, 'Cliente arquivado não encontrado.', HttpStatus.NOT_FOUND);
    // The document is unique among active customers: someone may have registered it again since.
    if (archived.document && (await this.customerRepository.byDocument(archived.document))) {
      throw new AppException(AppErrorCode.CUSTOMER_DOCUMENT_ALREADY_EXISTS, 'Já existe um cliente ativo com este documento. Arquive ou corrija o outro cadastro antes de reativar.', HttpStatus.CONFLICT);
    }
    try {
      await this.customerRepository.restore(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppException(AppErrorCode.CUSTOMER_DOCUMENT_ALREADY_EXISTS, 'Já existe um cliente ativo com este documento.', HttpStatus.CONFLICT);
      throw error;
    }
    await this.auditLog.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'customer.restored', entity: 'customer', entityId: id, metadata: {} });
    return { customer: this.toResponse({ ...archived, deletedAt: null }) };
  }

  async archiveImpact(id: string): Promise<CustomerArchiveImpactResponse> {
    if (!(await this.customerRepository.byId(id))) throw new AppException(AppErrorCode.CUSTOMER_NOT_FOUND, 'Cliente não encontrado.', HttpStatus.NOT_FOUND);
    return this.customerRepository.archiveImpact(id);
  }

  async getById(id: string): Promise<{ customer: CustomerResponse }> {
    const customer = await this.customerRepository.byId(id);
    if (!customer) {
      throw new AppException(AppErrorCode.CUSTOMER_NOT_FOUND, 'Cliente não encontrado.', HttpStatus.NOT_FOUND);
    }

    return { customer: this.toResponse(customer) };
  }

  async list(request: CustomerListRequest, viewer: CustomerViewer = NO_PRICES, now = new Date()): Promise<PaginationData<CustomerListItemResponse>> {
    const ids = await this.filterIds(request.filter, now);
    // A filter that matches nobody is an empty page, not an unfiltered one.
    if (ids && ids.in && ids.in.length === 0) return { items: [], total: 0, offset: request.offset, limit: request.limit, hasMore: false };
    const { items, total } = await this.customerRepository.listByTenant(request.offset, request.limit, request.search, request.archived === true, ids);
    const stats = await this.statsFor(items.map((customer) => customer.id), viewer);

    return {
      items: items.map((customer) => ({ ...this.toResponse(customer), stats: stats.get(customer.id) })),
      total,
      offset: request.offset,
      limit: request.limit,
      hasMore: request.offset + items.length < total,
    };
  }

  // Everything the customer's page needs in one call. Money is left out unless the viewer may see prices.
  async overview(id: string, viewer: CustomerViewer = NO_PRICES, now = new Date()): Promise<CustomerOverviewResponse> {
    if (!(await this.customerRepository.byId(id))) throw new AppException(AppErrorCode.CUSTOMER_NOT_FOUND, 'Cliente não encontrado.', HttpStatus.NOT_FOUND);
    const [vehicles, history, open, appointments] = await Promise.all([
      this.customerRepository.vehiclesOf([id]),
      this.customerRepository.ordersOf([id]),
      this.customerRepository.openOrdersOf(id),
      this.customerRepository.upcomingAppointmentsOf(id, now),
    ]);
    const summary = summarizeHistory(history.orders, history.items);
    const labelOf = new Map(vehicles.map((vehicle) => [vehicle.id, `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`]));
    return {
      vehicles: vehicles.map((vehicle) => ({ id: vehicle.id, brand: vehicle.brand, model: vehicle.model, plate: vehicle.plate, year: vehicle.year ?? undefined, mileage: vehicle.mileage ?? undefined })),
      orderCount: summary.orderCount,
      deliveredCount: summary.deliveredCount,
      lastVisitAt: summary.lastVisitAt?.toISOString(),
      openServiceOrders: open.map((order) => ({ id: order.id, orderNumber: order.orderNumber, status: order.status, vehicleLabel: labelOf.get(order.vehicleId) ?? 'Veículo' })),
      upcomingAppointments: appointments.map((appointment) => ({ id: appointment.id, startsAt: appointment.startsAt.toISOString(), status: appointment.status, serviceDescription: appointment.serviceDescription })),
      ...(viewer.canViewPrices ? { money: {
        totalSpentCents: summary.totalSpentCents,
        averageTicketCents: summary.deliveredCount ? Math.round(summary.totalSpentCents / summary.deliveredCount) : 0,
        pendingCents: await this.customerRepository.pendingCentsOf(id),
      } } : {}),
    };
  }

  private async filterIds(filter: CustomerListRequest['filter'], now: Date): Promise<{ in?: string[]; notIn?: string[] } | undefined> {
    if (filter === 'DEBT') return { in: await this.customerRepository.idsWithDebt() };
    if (filter === 'INACTIVE') return { notIn: await this.customerRepository.idsDeliveredSince(new Date(now.getTime() - INACTIVE_AFTER_DAYS * 86_400_000)) };
    return undefined;
  }

  private async statsFor(ids: string[], viewer: CustomerViewer): Promise<Map<string, CustomerListStats>> {
    const [vehicles, history] = await Promise.all([this.customerRepository.vehiclesOf(ids), this.customerRepository.ordersOf(ids)]);
    return new Map(ids.map((id) => {
      const summary = summarizeHistory(history.orders.filter((order) => order.customerId === id), history.items);
      return [id, {
        plates: vehicles.filter((vehicle) => vehicle.customerId === id).map((vehicle) => vehicle.plate),
        orderCount: summary.orderCount,
        lastVisitAt: summary.lastVisitAt?.toISOString(),
        ...(viewer.canViewPrices ? { totalSpentCents: summary.totalSpentCents } : {}),
      }];
    }));
  }

  private toResponse(customer: CustomerEntity): CustomerResponse {
    return {
      id: customer.id,
      tenantId: customer.tenantId,
      type: customer.type as CustomerResponse['type'],
      document: customer.document,
      name: customer.name,
      email: customer.email ?? undefined,
      phone: customer.phone,
      birthDate: customer.birthDate?.toISOString().slice(0, 10),
      careMessagesEnabled: customer.careMessagesEnabled ?? false,
      careConsentAt: customer.careConsentAt?.toISOString(),
      careConsentSource: (customer.careConsentSource ?? undefined) as CustomerResponse['careConsentSource'],
      notifyServiceOrderUpdates: customer.notifyServiceOrderUpdates ?? false,
      address: (customer.address as CustomerResponse['address']) ?? undefined,
      notes: customer.notes ?? undefined,
      rg: customer.rg ?? undefined,
      stateRegistration: customer.stateRegistration ?? undefined,
      secondaryContactName: customer.secondaryContactName ?? undefined,
      secondaryContactPhone: customer.secondaryContactPhone ?? undefined,
      secondaryContactRelation: customer.secondaryContactRelation ?? undefined,
      preferredContactChannel: (customer.preferredContactChannel as CustomerResponse['preferredContactChannel']) ?? undefined,
      preferredContactTime: (customer.preferredContactTime as CustomerResponse['preferredContactTime']) ?? undefined,
      createdAt: customer.createdAt.toISOString(),
      archivedAt: customer.deletedAt?.toISOString(),
    };
  }

  // A person has a CPF and a company a CNPJ: the other way round is a typo the record would carry forever.
  private assertDocumentFitsType(type: string, checked: { type?: 'CPF' | 'CNPJ' | null; normalized: string }) {
    if (!checked.normalized) return;
    if ((type === 'PF' && checked.type !== 'CPF') || (type === 'PJ' && checked.type !== 'CNPJ')) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, type === 'PF' ? 'Pessoa física usa CPF. Para um CNPJ, escolha pessoa jurídica.' : 'Pessoa jurídica usa CNPJ. Para um CPF, escolha pessoa física.');
    }
  }

  private validateNotificationPhone(enabled: boolean | undefined, phone: string) {
    if (enabled && !whatsappRecipient(phone)) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Informe um telefone com DDD válido para ativar os avisos da OS pelo WhatsApp.', HttpStatus.BAD_REQUEST, [{ field: 'phone', message: 'Informe um telefone com DDD válido para WhatsApp.' }]);
  }

  private birthDate(value: string | undefined, type: string): Date | undefined {
    if (!value) return undefined;
    const date = new Date(`${value}T00:00:00Z`);
    if (type !== 'PF' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || date > new Date() || date.getUTCFullYear() < new Date().getUTCFullYear() - 120) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Informe uma data de nascimento válida para uma pessoa física.');
    }
    return date;
  }
}
