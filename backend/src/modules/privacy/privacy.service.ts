import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@oficina/database';
import type { PrivacyRequest } from '@oficina/database';
import type { CreatePrivacyRequest, PrivacyRequestResponse } from '@oficina/contracts';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { PasswordService } from '../iam/services/password.service';
import { RoleRepository } from '../iam/repositories/role.repository';
import type { ResolvePrivacyRequestDto } from './privacy.dto';

const FINAL_STATUSES = ['COMPLETED'];
@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService, private readonly roles: RoleRepository) {}

  async create(user: AuthenticatedUser, input: CreatePrivacyRequest) {
    if (input.customerId) {
      await this.requireAdmin(user, ['customers.manage']);
      if (['REFUND', 'CANCELLATION'].includes(input.type)) throw new BadRequestException('Pedidos comerciais devem ser vinculados à conta contratante.');
      const customer = await this.prisma.client.customer.findFirst({ where: { id: input.customerId, tenantId: user.tenantId } });
      if (!customer) throw new NotFoundException('Cliente não encontrado nesta oficina.');
    }
    // 15 dias é meta de acompanhamento para os demais pedidos, não extensão
    // do prazo legal de acesso nem prazo geral de eliminação da LGPD.
    const dueAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const request = await this.prisma.client.privacyRequest.create({ data: {
      tenantId: user.tenantId, userId: user.userId, customerId: input.customerId,
      type: input.type, details: input.details?.trim() || null, dueAt,
    } });
    return { request: this.toResponse(request) };
  }

  async list(user: AuthenticatedUser, all = false) {
    if (all) await this.requireAdmin(user, ['settings.manage']);
    const items = await this.prisma.client.privacyRequest.findMany({
      where: { tenantId: user.tenantId, ...(all ? {} : { userId: user.userId }) },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    return { items: items.map((item) => this.toResponse(item)) };
  }

  async resolve(user: AuthenticatedUser, input: ResolvePrivacyRequestDto) {
    await this.requireAdmin(user, ['settings.manage']);
    const request = await this.prisma.client.privacyRequest.findFirst({ where: { id: input.id, tenantId: user.tenantId } });
    if (!request) throw new NotFoundException('Solicitação não encontrada.');
    if (FINAL_STATUSES.includes(request.status)) throw new ConflictException('Esta solicitação já foi encerrada.');
    if (input.status === 'RETAINED' && (!input.retentionUntil || Date.parse(input.retentionUntil) <= Date.now())) {
      throw new BadRequestException('Informe a base legal, os dados conservados na resposta e uma data futura para revisão da retenção.');
    }
    // Evita confundir uma decisão administrativa com exclusão realizada.
    if (request.type === 'DELETION' && input.status === 'COMPLETED') {
      throw new BadRequestException('Use a execução de exclusão para cadastro isolado. Para registros vinculados, documente a análise e a retenção com data de revisão.');
    }
    return this.prisma.transaction(async (tx) => {
      const changed = await tx.privacyRequest.updateMany({ where: { id: input.id, tenantId: user.tenantId, status: request.status }, data: {
        status: input.status, response: input.response.trim(), resolvedBy: user.userId,
        resolvedAt: input.status === 'IN_REVIEW' ? null : new Date(),
        retentionUntil: input.status === 'RETAINED' ? new Date(input.retentionUntil!) : null,
      } });
      if (!changed.count) throw new ConflictException('A solicitação foi atualizada. Recarregue a lista.');
      await tx.auditLog.create({ data: { tenantId: user.tenantId, userId: user.userId, action: 'privacy.request_reviewed', entity: 'privacy_request', entityId: request.id, metadata: { status: input.status } } });
      return { success: true };
    });
  }

  async exportSelf(user: AuthenticatedUser) {
    const account = await this.prisma.client.user.findFirst({ where: { id: user.userId, tenantId: user.tenantId, deletedAt: null }, select: {
      id: true, name: true, email: true, status: true, createdAt: true, legalVersion: true, legalAcceptedAt: true,
    } });
    if (!account) throw new NotFoundException('Conta não encontrada.');
    return { exportedAt: new Date().toISOString(), scope: 'Dados cadastrais da sua conta. Para declaração completa, utilize uma solicitação de acesso.', account };
  }

  async exportCustomer(user: AuthenticatedUser, id: string): Promise<{ exportedAt: string; scope: string; customer: Record<string, unknown> }> {
    await this.requireAdmin(user, ['customers.manage']);
    const customer = await this.prisma.client.customer.findFirst({ where: { id, tenantId: user.tenantId }, select: {
      id: true, type: true, document: true, name: true, email: true, phone: true, address: true,
      rg: true, stateRegistration: true, preferredContactChannel: true, preferredContactTime: true, notifyServiceOrderUpdates: true, createdAt: true,
    } });
    if (!customer) throw new NotFoundException('Cliente não encontrado nesta oficina.');
    // Notas internas e contatos de terceiros exigem revisão antes da entrega.
    return { exportedAt: new Date().toISOString(), scope: 'Dados cadastrais do cliente. Histórico, anexos, observações e dados de terceiros exigem revisão no atendimento do pedido completo.', customer };
  }

  async eraseCustomer(user: AuthenticatedUser, requestId: string, password: string) {
    await this.requireAdmin(user, ['customers.manage', 'settings.manage']);
    // Reautenticação para a operação irreversível. Senha nunca entra no log.
    const actor = await this.prisma.client.user.findFirst({ where: { id: user.userId, tenantId: user.tenantId, status: 'active', deletedAt: null }, select: { passwordHash: true } });
    if (!actor?.passwordHash || !(await this.passwords.verify(password, actor.passwordHash))) throw new ForbiddenException('Confirme sua senha atual para apagar os dados.');
    // Todas as leituras e alterações têm tenant explícito. Isolamento serializável
    // mantém verificação de referências e apagamento na mesma transação.
    try {
      return await this.prisma.client.$transaction(async (tx) => {
        const request = await tx.privacyRequest.findFirst({ where: { id: requestId, tenantId: user.tenantId, type: 'DELETION', status: { in: ['OPEN', 'IN_REVIEW'] } } });
        if (!request?.customerId) throw new BadRequestException('É necessário um pedido de exclusão aberto para um cliente desta oficina.');
        const customerId = request.customerId;
        const where = { customerId, tenantId: user.tenantId };
        const references = await Promise.all([
          tx.vehicle.count({ where }), tx.serviceOrder.count({ where }),
          tx.appointment.count({ where }), tx.financialEntry.count({ where }), tx.maintenanceAlert.count({ where }),
        ]);
        if (references.some((count) => count > 0)) throw new ConflictException('Há veículos, serviços, agendamentos ou registros financeiros vinculados, inclusive arquivados. Revise obrigações legais, anexos, cópias e integrações antes de executar a exclusão assistida. O pedido permanece aberto.');
        await tx.serviceOrderStatusNotification.deleteMany({ where });
        const changed = await tx.customer.updateMany({ where: { id: customerId, tenantId: user.tenantId }, data: {
          name: 'Cadastro com dados apagados', document: '', phone: '', email: null,
          address: Prisma.DbNull, notes: null, rg: null, stateRegistration: null,
          secondaryContactName: null, secondaryContactPhone: null, secondaryContactRelation: null,
          preferredContactChannel: null, preferredContactTime: null, notifyServiceOrderUpdates: false, deletedAt: new Date(),
        } });
        if (!changed.count) throw new NotFoundException('Cliente não encontrado nesta oficina.');
        // Remove cópias de documento em auditorias legadas e texto livre dos pedidos.
        await tx.auditLog.updateMany({ where: { tenantId: user.tenantId, entity: 'customer', entityId: customerId }, data: { metadata: {} } });
        await tx.privacyRequest.updateMany({ where: { tenantId: user.tenantId, customerId }, data: { details: null, response: null } });
        const response = 'Campos pessoais do cadastro isolado apagados na base ativa, incluindo metadados de auditoria do cadastro. Identificadores técnicos permanecem para rastreabilidade. Cópias exportadas, backups e serviços externos exigem verificação pelo responsável; esta operação não certifica a eliminação dessas cópias.';
        await tx.privacyRequest.updateMany({ where: { id: requestId, tenantId: user.tenantId }, data: { status: 'COMPLETED', response, resolvedAt: new Date(), resolvedBy: user.userId } });
        await tx.auditLog.create({ data: { tenantId: user.tenantId, userId: user.userId, action: 'privacy.customer_erased', entity: 'customer', entityId: customerId, metadata: { requestId } } });
        return { success: true, message: response };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ConflictException('Houve alteração concorrente. Revise o cadastro e tente novamente.');
      throw error;
    }
  }

  async eraseAccount(user: AuthenticatedUser, requestId: string, password: string) {
    const actor = await this.prisma.client.user.findFirst({ where: { id: user.userId, tenantId: user.tenantId, status: 'active', deletedAt: null }, select: { passwordHash: true } });
    if (!actor?.passwordHash || !(await this.passwords.verify(password, actor.passwordHash))) throw new ForbiddenException('Confirme sua senha atual para apagar a conta.');
    try {
      return await this.prisma.client.$transaction(async (tx) => {
        const request = await tx.privacyRequest.findFirst({ where: { id: requestId, tenantId: user.tenantId, userId: user.userId, customerId: null, type: 'DELETION', status: { in: ['OPEN', 'IN_REVIEW'] } } });
        if (!request) throw new BadRequestException('Registre um pedido de exclusão para sua própria conta antes de continuar.');
        // A oficina precisa manter ao menos um administrador para exercer
        // seus direitos e os dos clientes. Não apaga o acervo da empresa.
        const adminRoles = await tx.role.findMany({ where: { OR: [{ tenantId: null }, { tenantId: user.tenantId }], baseRole: 'ADMIN', deletedAt: null }, select: { id: true } });
        const adminRoleIds = adminRoles.map((role) => role.id);
        const anotherAdmin = await tx.user.count({ where: { tenantId: user.tenantId, id: { not: user.userId }, status: 'active', deletedAt: null, roleId: { in: adminRoleIds } } });
        const account = await tx.user.findFirst({ where: { id: user.userId, tenantId: user.tenantId, deletedAt: null }, select: { roleId: true } });
        if (!account) throw new NotFoundException('Conta não encontrada.');
        if (adminRoleIds.includes(account.roleId) && !anotherAdmin) throw new ConflictException('Transfira a administração para outra conta ativa antes de excluir a sua. Para encerrar toda a oficina, solicite cancelamento e exclusão assistida ao fornecedor.');
        await tx.user.updateMany({ where: { id: user.userId, tenantId: user.tenantId }, data: {
          name: 'Conta com dados apagados', email: `${user.userId}@deleted.invalid`, passwordHash: null,
          inviteTokenHash: null, inviteExpiresAt: null, mfaSecret: null, mfaEnabled: false,
          status: 'disabled', deletedAt: new Date(),
        } });
        await tx.refreshToken.deleteMany({ where: { userId: user.userId } });
        await tx.auditLog.updateMany({ where: { tenantId: user.tenantId, OR: [{ userId: user.userId }, { entity: 'user', entityId: user.userId }] }, data: { metadata: {} } });
        await tx.privacyRequest.updateMany({ where: { tenantId: user.tenantId, userId: user.userId, customerId: null }, data: { details: null, response: null } });
        const response = 'Dados de identificação, credenciais e sessões da conta apagados na base ativa. Identificadores técnicos e registro de aceite permanecem para rastreabilidade e exercício regular de direitos, sujeitos a revisão da necessidade pelo controlador. Registros operacionais da oficina, documentos exportados, backups e serviços externos exigem análise separada.';
        await tx.privacyRequest.updateMany({ where: { id: requestId, tenantId: user.tenantId }, data: { status: 'COMPLETED', response, resolvedAt: new Date(), resolvedBy: user.userId } });
        await tx.auditLog.create({ data: { tenantId: user.tenantId, userId: user.userId, action: 'privacy.account_erased', entity: 'user', entityId: user.userId, metadata: { requestId } } });
        return { success: true, message: response };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ConflictException('Houve alteração concorrente. Recarregue e tente novamente.');
      throw error;
    }
  }

  private toResponse(item: PrivacyRequest): PrivacyRequestResponse {
    return { id: item.id, type: item.type as PrivacyRequestResponse['type'], status: item.status as PrivacyRequestResponse['status'], customerId: item.customerId ?? undefined, details: item.details ?? undefined, response: item.response ?? undefined, createdAt: item.createdAt.toISOString(), dueAt: item.dueAt.toISOString(), resolvedAt: item.resolvedAt?.toISOString(), retentionUntil: item.retentionUntil?.toISOString() };
  }

  private async requireAdmin(user: AuthenticatedUser, permissions: string[]) {
    const account = await this.prisma.client.user.findFirst({ where: { id: user.userId, tenantId: user.tenantId, status: 'active', deletedAt: null }, select: { roleId: true } });
    const role = account ? await this.roles.byId(account.roleId) : null;
    const currentPermissions = role ? await this.roles.permissionKeys(role.id) : [];
    if (!role || role.baseRole !== 'ADMIN' || (role.tenantId !== null && role.tenantId !== user.tenantId) || !permissions.every((key) => currentPermissions.includes(key))) throw new ForbiddenException('Somente um administrador com as permissões atuais pode executar esta ação.');
  }
}
