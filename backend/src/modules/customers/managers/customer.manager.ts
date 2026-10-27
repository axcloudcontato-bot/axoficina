import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CreateCustomerRequest,
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
    const birthDate = request.birthDate === undefined ? undefined : request.birthDate === null ? null : this.birthDate(request.birthDate, existing.type);

    let document: string | undefined;
    if (request.document !== undefined) {
      const checked = request.document.trim() ? this.documentValidator.validate(request.document) : { valid: true, normalized: '' };
      if (!checked.valid) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'CPF/CNPJ inválido.');
      const duplicate = checked.normalized ? await this.customerRepository.byDocument(checked.normalized) : null;
      if (duplicate && duplicate.id !== existing.id) throw new AppException(AppErrorCode.CUSTOMER_DOCUMENT_ALREADY_EXISTS, 'Já existe um cliente cadastrado com este documento.', HttpStatus.CONFLICT);
      document = checked.normalized;
    }
    // Corrigir ou remover documento não exige recriar o cadastro.
    try {
      await this.customerRepository.update(request.id, {
        document,
        name: request.name,
        phone: request.phone,
        birthDate,
        careMessagesEnabled: request.careMessagesEnabled,
        careConsentAt: request.careMessagesEnabled && !existing.careMessagesEnabled ? new Date() : undefined,
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

  async getById(id: string): Promise<{ customer: CustomerResponse }> {
    const customer = await this.customerRepository.byId(id);
    if (!customer) {
      throw new AppException(AppErrorCode.CUSTOMER_NOT_FOUND, 'Cliente não encontrado.', HttpStatus.NOT_FOUND);
    }

    return { customer: this.toResponse(customer) };
  }

  async list(request: CustomerListRequest): Promise<PaginationData<CustomerListItemResponse>> {
    const { items, total } = await this.customerRepository.listByTenant(request.offset, request.limit, request.search);

    return {
      items: items.map((customer) => this.toResponse(customer)),
      total,
      offset: request.offset,
      limit: request.limit,
      hasMore: request.offset + items.length < total,
    };
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
    };
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
