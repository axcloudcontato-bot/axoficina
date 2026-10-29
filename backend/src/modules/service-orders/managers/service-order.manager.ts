import { HttpStatus, Injectable } from '@nestjs/common';
import {
  SERVICE_ORDER_PHOTO_ANGLES,
  type CreateServiceOrderItemRequest,
  type ConfigureServiceOrderPaymentRequest,
  type ConfirmServiceOrderInstallmentRequest,
  type ConfirmServiceOrderReceiptRequest,
  type DeleteServiceOrderReceiptRequest,
  type CreateServiceOrderRequest,
  type DashboardBusinessSummaryResponse,
  type DashboardTodayResponse,
  type PhotoPolicy,
  type DashboardTodayWorkloadResponse,
  type DashboardWaitingResponse,
  type ServiceOrderItemResponse,
  type ServiceOrderInstallmentResponse,
  type ServiceOrderPhotoAngle,
  type ServiceOrderReceiptResponse,
  type ServiceOrderListRequest,
  type ServiceOrderListResponse,
  type ServiceOrderResponse,
  type ServiceOrderStatusHistoryItemResponse,
  type TechnicianProductivityRequest,
  type TechnicianProductivityResponse,
  type TransitionServiceOrderRequest,
  type UpdateServiceOrderItemRequest,
  type UpdateServiceOrderRequest,
} from '@oficina/contracts';
import type {
  Customer as CustomerEntity,
  ServiceOrder as ServiceOrderEntity,
  ServiceOrderItem as ServiceOrderItemEntity,
  ServiceOrderInstallment as ServiceOrderInstallmentEntity,
  ServiceOrderReceipt as ServiceOrderReceiptEntity,
  ServiceOrderStatusHistory as ServiceOrderStatusHistoryEntity,
  User as UserEntity,
  Vehicle as VehicleEntity,
} from '@oficina/database';
import { AppErrorCode } from '../../../shared/errors/app-error-code';
import { AppException } from '../../../shared/errors/app-exception';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { CustomerRepository } from '../../customers/repositories/customer.repository';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { UserRepository } from '../../iam/repositories/user.repository';
import { TenantRepository } from '../../iam/repositories/tenant.repository';
import { ServiceOrderRepository } from '../repositories/service-order.repository';
import { ServiceOrderStatusHistoryRepository } from '../repositories/service-order-status-history.repository';
import { ServiceOrderItemRepository } from '../repositories/service-order-item.repository';
import { ServiceOrderReceiptRepository } from '../repositories/service-order-receipt.repository';
import { ServiceOrderPhotoRepository } from '../repositories/service-order-photo.repository';
import { SERVICE_ORDER_CLOSING_STATUSES, SERVICE_ORDER_TRANSITIONS } from './service-order-state-machine';
// MaintenanceAlertRepository vem de MaintenanceAlertsModule, que
// ServiceOrdersModule importa via `forwardRef()` (o import é recíproco —
// MaintenanceAlertsModule também importa ServiceOrdersModule via
// `forwardRef()` — ver comentário em service-orders.module.ts e Gotchas do
// plano motor-manutencao-preventiva.md).
import { MaintenanceAlertRepository } from '../../maintenance-alerts/repositories/maintenance-alert.repository';
import { quoteRevision, quoteSnapshot, quoteSnapshotRevision, quotesMatch } from '../services/customer-message-quote';
import type { CustomerMessageQuote } from '@oficina/contracts';
import { CustomerMessageRepository } from '../repositories/customer-message.repository';
import { ServiceOrderStatusNotificationRepository } from '../repositories/service-order-status-notification.repository';
import { CustomerCarePlansService } from '../../customer-care/customer-care-plans.service';

const PHOTO_ANGLE_LABELS: Record<ServiceOrderPhotoAngle, string> = {
  FRONT: 'frente',
  REAR: 'traseira',
  LEFT_SIDE: 'lateral esquerda',
  RIGHT_SIDE: 'lateral direita',
  SPARE_TIRE: 'estepe/porta-malas',
  DASHBOARD: 'painel (km)',
};

// Net amount of an order: items minus its discount (never below zero).
const netTotal = (grossCents: number, discountCents = 0) => Math.max(0, grossCents - Math.min(discountCents, grossCents));

// A quote unanswered for 2 days, or a finished car left in the yard for 3, is worth a call.
const APPROVAL_STALE_DAYS = 2;
const READY_STALE_DAYS = 3;

@Injectable()
export class ServiceOrderManager {
  constructor(
    private readonly serviceOrderRepository: ServiceOrderRepository,
    private readonly statusHistoryRepository: ServiceOrderStatusHistoryRepository,
    private readonly itemRepository: ServiceOrderItemRepository,
    private readonly receiptRepository: ServiceOrderReceiptRepository,
    private readonly vehicleRepository: VehicleRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly userRepository: UserRepository,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly maintenanceAlertRepository: MaintenanceAlertRepository,
    private readonly photoRepository: ServiceOrderPhotoRepository,
    private readonly customerMessageRepository?: CustomerMessageRepository,
    private readonly statusNotifications?: ServiceOrderStatusNotificationRepository,
    private readonly carePlans?: CustomerCarePlansService,
    private readonly tenantRepository?: TenantRepository,
  ) {}

  async create(actingUser: AuthenticatedUser, request: CreateServiceOrderRequest): Promise<{ serviceOrder: ServiceOrderResponse }> {
    const vehicle = await this.vehicleRepository.byId(request.vehicleId);
    if (!vehicle) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_VEHICLE_NOT_FOUND, 'Veículo informado não encontrado.', HttpStatus.BAD_REQUEST);
    }

    let technician: UserEntity | null = null;
    if (request.technicianId) {
      technician = await this.userRepository.byId(request.technicianId);
      if (!technician || technician.status !== 'active') {
        throw new AppException(AppErrorCode.SERVICE_ORDER_TECHNICIAN_NOT_FOUND, 'Técnico informado não encontrado ou está desabilitado.', HttpStatus.BAD_REQUEST);
      }
    }

    const openedAt = new Date();
    const serviceOrder = await this.prisma.transaction(async (tx) => {
      const created = await this.serviceOrderRepository.insert(
        {
          tenantId: actingUser.tenantId,
          customerId: vehicle.customerId,
          vehicleId: vehicle.id,
          technicianId: request.technicianId,
          checklist: request.checklist,
          diagnosis: request.diagnosis,
          entryMileage: request.entryMileage,
          customerComplaint: request.customerComplaint,
          receptionNotes: request.receptionNotes,
          recommendedService: request.recommendedService,
          expectedDeliveryAt: request.expectedDeliveryAt === null ? null : request.expectedDeliveryAt ? new Date(request.expectedDeliveryAt) : undefined,
          paymentMethod: request.paymentMethod,
          paymentInstallments: request.paymentMethod === 'CREDIT_CARD' ? request.paymentInstallments : null,
          openedAt,
        },
        tx,
      );

      const event = await this.statusHistoryRepository.insert(
        {
          serviceOrderId: created.id,
          fromStatus: null,
          toStatus: 'OPEN',
          changedBy: actingUser.userId,
          changedAt: openedAt,
        },
        tx,
      );

      await this.statusNotifications?.record(tx, created, { id: event.id, fromStatus: null, toStatus: 'OPEN', changedAt: openedAt });

      return created;
    });

    const customer = await this.customerRepository.byId(vehicle.customerId);

    await this.auditLog.record({
      tenantId: actingUser.tenantId,
      userId: actingUser.userId,
      action: 'service_order.created',
      entity: 'service_order',
      entityId: serviceOrder.id,
      metadata: { vehicleId: vehicle.id, status: serviceOrder.status },
    });

    // OS recém-criada nunca tem itens ainda — evita uma query desnecessária
    // (diferente de update/transition/delete, que operam numa OS que já pode
    // ter itens lançados).
    return { serviceOrder: this.toResponse(serviceOrder, vehicle, customer, technician, { items: [], totalAmountCentsOverride: 0 }) };
  }

  async update(actingUser: AuthenticatedUser, request: UpdateServiceOrderRequest): Promise<{ serviceOrder: ServiceOrderResponse }> {
    const existing = await this.serviceOrderRepository.byId(request.id);
    if (!existing) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_NOT_FOUND, 'Ordem de serviço não encontrada.', HttpStatus.NOT_FOUND);
    }

    if (request.technicianId) {
      const technician = await this.userRepository.byId(request.technicianId);
      if (!technician || technician.status !== 'active') {
        throw new AppException(AppErrorCode.SERVICE_ORDER_TECHNICIAN_NOT_FOUND, 'Técnico informado não encontrado ou está desabilitado.', HttpStatus.BAD_REQUEST);
      }
    }

    if (request.discountCents !== undefined && request.discountCents !== existing.discountCents) {
      if (['DELIVERED', 'CANCELLED'].includes(existing.status)) {
        throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Não é possível alterar o desconto de uma OS encerrada.', HttpStatus.BAD_REQUEST);
      }
      const gross = await this.computeTotalAmountCents(existing.id);
      if (request.discountCents > gross) {
        throw new AppException(AppErrorCode.VALIDATION_ERROR, 'O desconto não pode ser maior que o total dos itens.', HttpStatus.BAD_REQUEST);
      }
      const received = (await this.receiptRepository.byServiceOrderId(existing.id)).reduce((sum, receipt) => sum + receipt.amountCents, 0);
      if (gross - request.discountCents < received) {
        throw new AppException(AppErrorCode.VALIDATION_ERROR, 'O desconto deixaria o total abaixo do que já foi recebido.', HttpStatus.BAD_REQUEST);
      }
    }
    const exitMileage = request.exitMileage === undefined ? existing.exitMileage : request.exitMileage;
    const entryMileage = request.entryMileage === undefined ? existing.entryMileage : request.entryMileage;
    if (exitMileage != null && entryMileage != null && exitMileage < entryMileage) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'A quilometragem de saída não pode ser menor que a de entrada.', HttpStatus.BAD_REQUEST);
    }

    await this.serviceOrderRepository.update(request.id, {
      technicianId: request.technicianId,
      discountCents: request.discountCents,
      warrantyDays: request.warrantyDays,
      exitMileage: request.exitMileage,
      checklist: request.checklist,
      diagnosis: request.diagnosis,
      entryMileage: request.entryMileage,
      customerComplaint: request.customerComplaint,
      receptionNotes: request.receptionNotes,
      recommendedService: request.recommendedService,
      expectedDeliveryAt: request.expectedDeliveryAt === null ? null : request.expectedDeliveryAt ? new Date(request.expectedDeliveryAt) : undefined,
      paymentMethod: request.paymentMethod,
      paymentInstallments: request.paymentMethod === undefined
        ? undefined
        : request.paymentMethod === 'CREDIT_CARD'
          ? request.paymentInstallments
          : null,
    });

    const updated = await this.serviceOrderRepository.byId(request.id);
    if (!updated) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_NOT_FOUND, 'Ordem de serviço não encontrada.', HttpStatus.NOT_FOUND);
    }

    // Sem throw se veículo/cliente/técnico não existirem mais: a mutação já
    // foi persistida (linha acima) — mesmo fallback null-safe da Feature 4
    // (VehicleManager.update).
    const [vehicle, technician] = await Promise.all([
      this.vehicleRepository.byId(updated.vehicleId),
      updated.technicianId ? this.userRepository.byId(updated.technicianId) : Promise.resolve(null),
    ]);
    const customer = await this.customerRepository.byId(updated.customerId);
    const totalAmountCents = await this.computeTotalAmountCents(updated.id);

    await this.auditLog.record({
      tenantId: actingUser.tenantId,
      userId: actingUser.userId,
      action: 'service_order.updated',
      entity: 'service_order',
      entityId: updated.id,
      metadata: request.discountCents !== undefined && request.discountCents !== existing.discountCents ? { itemAction: 'discount', previousAmountCents: existing.discountCents, amountCents: request.discountCents } : {},
    });

    return { serviceOrder: this.toResponse(updated, vehicle, customer, technician, { totalAmountCentsOverride: totalAmountCents }) };
  }

  async transition(actingUser: AuthenticatedUser, request: TransitionServiceOrderRequest): Promise<{ serviceOrder: ServiceOrderResponse }> {
    const existing = await this.serviceOrderRepository.byId(request.id);
    if (!existing) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_NOT_FOUND, 'Ordem de serviço não encontrada.', HttpStatus.NOT_FOUND);
    }

    const fromStatus = existing.status as ServiceOrderEntity['status'] as keyof typeof SERVICE_ORDER_TRANSITIONS;
    const allowedTargets = SERVICE_ORDER_TRANSITIONS[fromStatus] ?? [];
    if (!allowedTargets.includes(request.toStatus)) {
      throw new AppException(
        AppErrorCode.SERVICE_ORDER_INVALID_STATUS_TRANSITION,
        `Não é possível mudar o status de ${fromStatus} para ${request.toStatus}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Evidência fotográfica obrigatória (spec fotos-os.md): os mesmos 6
    // ângulos padrão na ENTRY (ao sair de OPEN — primeiro registro de como o
    // veículo chegou) e na EXIT (ao concluir — como ele saiu, antes da
    // entrega), mais 1 foto de antes (ISSUE) e depois (RESOLVED) por peça/
    // serviço lançado na OS. CANCELLED fica isento de tudo isso — é um
    // caminho de aborto, não de entrega.
    const cancelReason = request.toStatus === 'CANCELLED' ? request.reason?.trim() : undefined;
    if (request.toStatus === 'CANCELLED' && (!cancelReason || cancelReason.length < 5)) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Informe o motivo do cancelamento (mínimo 5 caracteres).', HttpStatus.BAD_REQUEST);
    }
    const photoPolicy = await this.photoPolicy(actingUser.tenantId);
    if (photoPolicy.entry && fromStatus === 'OPEN' && (request.toStatus === 'IN_PROGRESS' || request.toStatus === 'AWAITING_APPROVAL')) {
      const missing = await this.missingAngles(request.id, 'ENTRY');
      if (missing.length > 0) {
        throw new AppException(
          AppErrorCode.SERVICE_ORDER_MISSING_ENTRY_PHOTO,
          `Faltam fotos de entrada do veículo: ${missing.join(', ')}.`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    if (request.toStatus === 'COMPLETED') {
      const missingAngles = photoPolicy.exit ? await this.missingAngles(request.id, 'EXIT') : [];
      if (missingAngles.length > 0) {
        throw new AppException(
          AppErrorCode.SERVICE_ORDER_MISSING_EXIT_PHOTO,
          `Faltam fotos de saída do veículo: ${missingAngles.join(', ')}.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const incompleteItems = photoPolicy.items ? await this.incompleteItemPhotos(request.id) : [];
      if (incompleteItems.length > 0) {
        throw new AppException(
          AppErrorCode.SERVICE_ORDER_MISSING_ITEM_PHOTOS,
          `Faltam fotos de antes/depois para: ${incompleteItems.join(', ')}.`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const changedAt = new Date();
    let authorizationMetadata: Record<string, string> = {};
    if (request.toStatus === 'IN_PROGRESS' && ['OPEN', 'AWAITING_APPROVAL'].includes(fromStatus) && request.authorization) {
      const current = quoteSnapshot((await this.getById(request.id)).serviceOrder);
      if (request.authorization === 'CUSTOMER_MESSAGE') {
        const approval = await this.customerMessageRepository?.latestQuote(request.id);
        if (!approval?.answeredAt || approval.selectedOption !== 0 || !approval.quoteSnapshot || !quotesMatch(approval.quoteSnapshot as unknown as CustomerMessageQuote, current)) {
          throw new AppException(AppErrorCode.VALIDATION_ERROR, 'O orçamento atual ainda não tem uma aprovação válida do cliente. Confira a resposta ou confirme a autorização presencial.');
        }
        authorizationMetadata = { authorization: 'CUSTOMER_MESSAGE', customerMessageId: approval.id, quoteRevision: quoteSnapshotRevision(current) };
      } else authorizationMetadata = { authorization: 'MANUAL', quoteRevision: quoteSnapshotRevision(current) };
    }
    const closedAt = SERVICE_ORDER_CLOSING_STATUSES.includes(request.toStatus) ? changedAt : undefined;

    await this.prisma.transaction(async (tx) => {
      const result = await this.serviceOrderRepository.transition(tx, request.id, fromStatus, request.toStatus, closedAt);
      if (result.count === 0) {
        // Perdeu a corrida: outra requisição mudou o status entre a
        // validação acima e esta escrita (ver Edge Case 5 da spec).
        throw new AppException(
          AppErrorCode.SERVICE_ORDER_INVALID_STATUS_TRANSITION,
          'O status da ordem de serviço mudou antes desta transição ser aplicada. Recarregue e tente novamente.',
          HttpStatus.CONFLICT,
        );
      }

      const event = await this.statusHistoryRepository.insert(
        {
          serviceOrderId: request.id,
          fromStatus,
          toStatus: request.toStatus,
          changedBy: actingUser.userId,
          changedAt,
        },
        tx,
      );
      await this.statusNotifications?.record(tx, existing, { id: event.id, fromStatus, toStatus: request.toStatus, changedAt });

      // Edge Case 4 (spec Motor de Manutenção Preventiva): a referência de
      // manutenção do veículo mudou — qualquer alerta OPEN anterior fica
      // obsoleto. Resolvido na mesma transação pra garantir atomicidade com
      // a mudança de status (TRANSACTIONS.md), não via fila assíncrona.
      if (request.toStatus === 'DELIVERED') {
        await this.maintenanceAlertRepository.resolveOpenByVehicleId(tx, existing.vehicleId, changedAt);
        await this.carePlans?.recordDelivered(tx, existing, changedAt);
      }
    });

    const updated = await this.serviceOrderRepository.byId(request.id);
    if (!updated) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_NOT_FOUND, 'Ordem de serviço não encontrada.', HttpStatus.NOT_FOUND);
    }

    const [vehicle, technician] = await Promise.all([
      this.vehicleRepository.byId(updated.vehicleId),
      updated.technicianId ? this.userRepository.byId(updated.technicianId) : Promise.resolve(null),
    ]);
    const customer = await this.customerRepository.byId(updated.customerId);
    const totalAmountCents = await this.computeTotalAmountCents(updated.id);

    await this.auditLog.record({
      tenantId: actingUser.tenantId,
      userId: actingUser.userId,
      action: 'service_order.transitioned',
      entity: 'service_order',
      entityId: updated.id,
      metadata: { fromStatus, toStatus: request.toStatus, ...authorizationMetadata, ...(cancelReason ? { reason: cancelReason } : {}) },
    });

    return { serviceOrder: this.toResponse(updated, vehicle, customer, technician, { totalAmountCentsOverride: totalAmountCents }) };
  }

  private async missingAngles(serviceOrderId: string, category: 'ENTRY' | 'EXIT'): Promise<string[]> {
    const covered = new Set(await this.photoRepository.distinctAngles(serviceOrderId, category));
    return SERVICE_ORDER_PHOTO_ANGLES.filter((angle) => !covered.has(angle)).map((angle) => PHOTO_ANGLE_LABELS[angle]);
  }

  // Each workshop decides which photo evidence it demands (Configurações > Empresa e marca).
  private async photoPolicy(tenantId: string): Promise<PhotoPolicy> {
    const tenant = await this.tenantRepository?.byId(tenantId);
    return { entry: tenant?.photoRequireEntry ?? true, exit: tenant?.photoRequireExit ?? true, items: tenant?.photoRequireItems ?? true };
  }

  async assertReadyForApproval(serviceOrderId: string) {
    const order = await this.serviceOrderRepository.byId(serviceOrderId);
    if (order && !(await this.photoPolicy(order.tenantId)).entry) return;
    const missing = await this.missingAngles(serviceOrderId, 'ENTRY');
    if (missing.length) throw new AppException(AppErrorCode.SERVICE_ORDER_MISSING_ENTRY_PHOTO, `Complete as fotos de entrada antes de solicitar a aprovação: ${missing.join(', ')}.`);
  }

  // Cada peça ativa da OS precisa de 1 foto ISSUE (o problema, antes)
  // e 1 RESOLVED (a solução, depois) vinculadas a ela. Serviço (mão de obra)
  // e produto não exigem foto — ver
  // ServiceOrderPhotoManager.upload, que já garante que toda foto ISSUE/
  // RESOLVED referencia um item real desta mesma OS.
  private async incompleteItemPhotos(serviceOrderId: string): Promise<string[]> {
    const [allItems, coverage] = await Promise.all([
      this.itemRepository.byServiceOrderId(serviceOrderId),
      this.photoRepository.itemCategoryCoverage(serviceOrderId),
    ]);
    const items = allItems.filter((item) => item.type === 'PART');
    if (items.length === 0) {
      return [];
    }
    const hasIssue = new Set(coverage.filter((row) => row.category === 'ISSUE').map((row) => row.serviceOrderItemId));
    const hasResolved = new Set(coverage.filter((row) => row.category === 'RESOLVED').map((row) => row.serviceOrderItemId));
    return items.filter((item) => !hasIssue.has(item.id) || !hasResolved.has(item.id)).map((item) => item.description);
  }

  async delete(actingUser: AuthenticatedUser, id: string): Promise<{ serviceOrder: ServiceOrderResponse }> {
    const existing = await this.serviceOrderRepository.byId(id);
    if (!existing) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_NOT_FOUND, 'Ordem de serviço não encontrada.', HttpStatus.NOT_FOUND);
    }

    // A delivered order or one that already took money is a financial record: it is cancelled, never erased.
    const [receipts, paidInstallment] = await Promise.all([
      this.receiptRepository.byServiceOrderId(id),
      this.prisma.client.serviceOrderInstallment.findFirst({ where: { serviceOrderId: id, status: 'PAID', deletedAt: null } }),
    ]);
    if (existing.status === 'DELIVERED' || receipts.length > 0 || paidInstallment) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Não é possível excluir uma OS entregue ou com recebimento registrado. Para encerrar sem valor, use Cancelar atendimento.', HttpStatus.CONFLICT);
    }

    const { count } = await this.serviceOrderRepository.softDelete(id);
    if (count === 0) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_NOT_FOUND, 'Ordem de serviço não encontrada.', HttpStatus.NOT_FOUND);
    }

    const [vehicle, technician] = await Promise.all([
      this.vehicleRepository.byId(existing.vehicleId),
      existing.technicianId ? this.userRepository.byId(existing.technicianId) : Promise.resolve(null),
    ]);
    const customer = await this.customerRepository.byId(existing.customerId);
    const totalAmountCents = await this.computeTotalAmountCents(existing.id);

    await this.auditLog.record({
      tenantId: actingUser.tenantId,
      userId: actingUser.userId,
      action: 'service_order.deleted',
      entity: 'service_order',
      entityId: id,
      metadata: {},
    });

    return { serviceOrder: this.toResponse(existing, vehicle, customer, technician, { totalAmountCentsOverride: totalAmountCents }) };
  }

  async getById(id: string): Promise<{ serviceOrder: ServiceOrderResponse }> {
    const serviceOrder = await this.serviceOrderRepository.byId(id);
    if (!serviceOrder) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_NOT_FOUND, 'Ordem de serviço não encontrada.', HttpStatus.NOT_FOUND);
    }

    const [vehicle, technician, history, items, receipts, installments] = await Promise.all([
      this.vehicleRepository.byId(serviceOrder.vehicleId),
      serviceOrder.technicianId ? this.userRepository.byId(serviceOrder.technicianId) : Promise.resolve(null),
      this.statusHistoryRepository.byServiceOrderId(id),
      this.itemRepository.byServiceOrderId(id),
      this.receiptRepository.byServiceOrderId(id),
      this.prisma.client.serviceOrderInstallment.findMany({ where: { serviceOrderId: id, deletedAt: null }, orderBy: { installmentNumber: 'asc' } }),
    ]);
    const customer = await this.customerRepository.byId(serviceOrder.customerId);

    return { serviceOrder: this.toResponse(serviceOrder, vehicle, customer, technician, { history, items, receipts, installments }) };
  }

  async list(request: ServiceOrderListRequest): Promise<ServiceOrderListResponse> {
    if (request.startDate && request.endDate && request.startDate > request.endDate) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'A data final deve ser igual ou posterior à data inicial.');
    }
    const trimmedSearch = request.search?.trim();
    let search: { orderNumber?: number; matchingCustomerIds: string[]; matchingVehicleIds: string[] } | undefined;
    if (trimmedSearch) {
      const [matchingCustomerIds, matchingVehicleIds] = await Promise.all([
        this.customerRepository.searchIdsByNameOrDocument(trimmedSearch),
        this.vehicleRepository.searchIdsByPlateOrModel(trimmedSearch),
      ]);
      const number = /^\d+$/.test(trimmedSearch) ? Number(trimmedSearch) : NaN;
      // CPF/CNPJ and phone searches can exceed the PostgreSQL Int range.
      const orderNumber = Number.isInteger(number) && number >= 0 && number <= 2_147_483_647 ? number : undefined;
      search = { orderNumber, matchingCustomerIds, matchingVehicleIds };
    }
    const { items, total, metrics } = await this.serviceOrderRepository.listByTenant(
      request.offset,
      request.limit,
      request.status,
      request.vehicleId,
      request.technicianId,
      request.customerId,
      search,
      ...(request.startDate || request.endDate || request.dateField || request.attention || request.includeMetrics
        ? [{ startDate: request.startDate, endDate: request.endDate, dateField: request.dateField, attention: request.attention, includeMetrics: request.includeMetrics }] : []),
    );

    return {
      items: await this.toListResponses(items),
      total,
      ...(metrics ? { metrics } : {}),
      offset: request.offset,
      limit: request.limit,
      hasMore: request.offset + items.length < total,
    };
  }

  private async toListResponses(items: Awaited<ReturnType<ServiceOrderRepository['attentionOrders']>>): Promise<ServiceOrderResponse[]> {
    const vehicleIds = [...new Set(items.map((item) => item.vehicleId))];
    const customerIds = [...new Set(items.map((item) => item.customerId))];
    const technicianIds = [...new Set(items.map((item) => item.technicianId).filter((id): id is string => !!id))];

    const [vehicles, customers, technicians, totalsByOrderId, receipts, statusSince] = await Promise.all([
      this.vehicleRepository.byIds(vehicleIds),
      this.customerRepository.byIds(customerIds),
      this.userRepository.byIds(technicianIds),
      this.itemRepository.sumTotalsByServiceOrderIds(items.map((serviceOrder) => serviceOrder.id)),
      this.receiptRepository.byServiceOrderIds(items.map((serviceOrder) => serviceOrder.id)),
      this.statusHistoryRepository.statusSince(items),
    ]);
    const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const technicianById = new Map(technicians.map((technician) => [technician.id, technician]));

    return items.map((serviceOrder) => ({
      ...this.toResponse(
        serviceOrder,
        vehicleById.get(serviceOrder.vehicleId) ?? null,
        customerById.get(serviceOrder.customerId) ?? null,
        serviceOrder.technicianId ? (technicianById.get(serviceOrder.technicianId) ?? null) : null,
        { totalAmountCentsOverride: totalsByOrderId.get(serviceOrder.id) ?? 0, receipts: receipts.filter((receipt) => receipt.serviceOrderId === serviceOrder.id) },
      ),
      statusSince: (statusSince.get(serviceOrder.id) ?? serviceOrder.openedAt).toISOString(),
    }));
  }

  async dashboardToday(viewer: { userId: string; canViewPrices: boolean }, today?: { startsAt: Date; endsAt: Date }, now = new Date()): Promise<DashboardTodayResponse> {
    const [{ metrics, attentionTotal }, attention, rows, users, approvalsSince, readySince, mine] = await Promise.all([
      this.serviceOrderRepository.todayMetrics(now, today),
      this.serviceOrderRepository.attentionOrders(now, 6),
      this.serviceOrderRepository.activeWorkloadRows(),
      this.userRepository.listByTenant(0, 500, { status: 'active' }),
      this.serviceOrderRepository.waitingSince('AWAITING_APPROVAL'),
      this.serviceOrderRepository.waitingSince('COMPLETED'),
      this.serviceOrderRepository.myOrders(viewer.userId, 6),
    ]);
    const buckets = new Map<string, DashboardTodayWorkloadResponse>();
    const bucket = (technicianId: string | null, name: string) => {
      const key = technicianId ?? 'unassigned';
      if (!buckets.has(key)) buckets.set(key, { ...(technicianId ? { technicianId } : {}), technicianName: name, notStarted: 0, inProgress: 0, waitingParts: 0 });
      return buckets.get(key)!;
    };
    users.items.forEach((user) => bucket(user.id, user.name));
    const names = new Map(users.items.map((user) => [user.id, user.name]));
    for (const row of rows) {
      const entry = bucket(row.technicianId, row.technicianId ? (names.get(row.technicianId) ?? 'Técnico removido') : 'Sem técnico');
      if (row.status === 'OPEN') entry.notStarted += 1; else if (row.status === 'IN_PROGRESS') entry.inProgress += 1; else entry.waitingParts += 1;
    }
    // Busiest first; people with nothing to do come last so the gap is visible.
    const workload = [...buckets.values()].sort((a, b) => (b.notStarted + b.inProgress + b.waitingParts) - (a.notStarted + a.inProgress + a.waitingParts) || a.technicianName.localeCompare(b.technicianName, 'pt-BR'));
    const [approvals, ready, mineItems] = await Promise.all([
      this.waitingSummary(approvalsSince, APPROVAL_STALE_DAYS, viewer.canViewPrices, now),
      this.waitingSummary(readySince, READY_STALE_DAYS, viewer.canViewPrices, now),
      this.toListResponses(mine.items),
    ]);
    return { metrics, attention: { total: attentionTotal, items: await this.toListResponses(attention) }, workload, waiting: { approvals, ready }, mine: { total: mine.total, items: mineItems } };
  }

  private async waitingSummary(rows: Array<{ id: string; since: Date; discountCents: number }>, staleDays: number, includeAmount: boolean, now: Date): Promise<DashboardWaitingResponse> {
    const days = rows.map((row) => Math.max(0, Math.floor((now.getTime() - row.since.getTime()) / 86_400_000)));
    const summary: DashboardWaitingResponse = { count: rows.length, stale: days.filter((value) => value >= staleDays).length, oldestDays: days.length ? Math.max(...days) : 0 };
    if (includeAmount && rows.length) { const totals = await this.itemRepository.sumTotalsByServiceOrderIds(rows.map((row) => row.id)); summary.amountCents = rows.reduce((sum, row) => sum + netTotal(totals.get(row.id) ?? 0, row.discountCents), 0); }
    return summary;
  }

  async businessSummary(now = new Date()): Promise<DashboardBusinessSummaryResponse> {
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const orders = await this.serviceOrderRepository.listForBusinessSummary(sixMonthsStart);
    const [grossTotalsByOrderId, financialItems, allReceipts, cashReceipts, technicians, vehicles, customers] = await Promise.all([
      this.itemRepository.sumTotalsByServiceOrderIds(orders.map((order) => order.id)),
      this.itemRepository.financialItemsByServiceOrderIds(orders.map((order) => order.id)),
      this.receiptRepository.byServiceOrderIds(orders.map((order) => order.id)),
      this.receiptRepository.receivedSince(sixMonthsStart),
      this.userRepository.byIds([...new Set(orders.map((order) => order.technicianId).filter((id): id is string => !!id))]),
      this.vehicleRepository.byIds([...new Set(orders.map((order) => order.vehicleId))]),
      this.customerRepository.byIds([...new Set(orders.map((order) => order.customerId))]),
    ]);
    const totalsByOrderId = new Map(orders.map((order) => [order.id, netTotal(grossTotalsByOrderId.get(order.id) ?? 0, order.discountCents)]));
    const technicianNames = new Map(technicians.map((technician) => [technician.id, technician.name]));
    const delivered = orders.filter((order) => order.status === 'DELIVERED' && order.closedAt);
    const currentDelivered = delivered.filter((order) => order.closedAt! >= currentMonthStart);
    const total = (selected: typeof orders) => selected.reduce((sum, order) => sum + (totalsByOrderId.get(order.id) ?? 0), 0);
    const activeStatuses = ['OPEN', 'AWAITING_APPROVAL', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED'];
    const active = orders.filter((order) => activeStatuses.includes(order.status));

    const monthlyRevenue = Array.from({ length: 6 }, (_, index) => {
      const start = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      return {
        month: start.toISOString().slice(0, 7),
        revenueCents: cashReceipts.filter((receipt) => receipt.receivedAt >= start && receipt.receivedAt < end).reduce((sum, receipt) => sum + receipt.amountCents, 0),
      };
    });
    const workload = new Map<string, number>();
    active.forEach((order) => workload.set(order.technicianId ?? 'unassigned', (workload.get(order.technicianId ?? 'unassigned') ?? 0) + 1));

    const currentReceipts = cashReceipts.filter((receipt) => receipt.receivedAt >= currentMonthStart);
    const previousReceipts = cashReceipts.filter((receipt) => receipt.receivedAt >= previousMonthStart && receipt.receivedAt < currentMonthStart);
    const monthRevenueCents = currentReceipts.reduce((sum, receipt) => sum + receipt.amountCents, 0);
    const receivedByOrderId = new Map<string, number>();
    allReceipts.forEach((receipt) => receivedByOrderId.set(receipt.serviceOrderId, (receivedByOrderId.get(receipt.serviceOrderId) ?? 0) + receipt.amountCents));
    const outstanding = (order: typeof orders[number]) => Math.max(0, (totalsByOrderId.get(order.id) ?? 0) - (receivedByOrderId.get(order.id) ?? 0));
    const currentDeliveredIds = new Set(currentDelivered.map((order) => order.id));
    const currentItems = financialItems.filter((item) => currentDeliveredIds.has(item.serviceOrderId));
    const revenueByType = (type: 'PART' | 'LABOR') => currentItems.filter((item) => (type === 'LABOR' ? item.type === 'LABOR' : item.type !== 'LABOR')).reduce((sum, item) => sum + item.lineTotalCents, 0);
    const serviceRanking = new Map<string, { count: number; revenueCents: number }>();
    currentItems.filter((item) => item.type === 'LABOR').forEach((item) => {
      const current = serviceRanking.get(item.description) ?? { count: 0, revenueCents: 0 };
      serviceRanking.set(item.description, { count: current.count + 1, revenueCents: current.revenueCents + item.lineTotalCents });
    });
    const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    return {
      monthRevenueCents,
      previousMonthRevenueCents: previousReceipts.reduce((sum, receipt) => sum + receipt.amountCents, 0),
      activePipelineCents: total(active),
      accountsReceivableCents: orders.reduce((sum, order) => sum + outstanding(order), 0),
      averageTicketCents: currentDelivered.length ? Math.round(monthRevenueCents / currentDelivered.length) : 0,
      overdueDeliveries: active.filter((order) => order.expectedDeliveryAt && order.expectedDeliveryAt < now).length,
      deliveredThisMonth: currentDelivered.length,
      receiptsThisMonth: currentReceipts.length,
      partsRevenueCents: revenueByType('PART'),
      laborRevenueCents: revenueByType('LABOR'),
      openOrders: active.length,
      completedAwaitingDeliveryCents: total(active.filter((order) => order.status === 'COMPLETED')),
      inProgressCents: total(active.filter((order) => order.status === 'IN_PROGRESS')),
      monthlyRevenue,
      technicianWorkload: [...workload.entries()].map(([technicianId, activeOrders]) => ({
        technicianId: technicianId === 'unassigned' ? undefined : technicianId,
        technicianName: technicianId === 'unassigned' ? 'Sem técnico' : technicianNames.get(technicianId) ?? 'Técnico removido',
        activeOrders,
      })).sort((left, right) => right.activeOrders - left.activeOrders),
      financialPipeline: orders
        .map((order) => {
          const vehicle = vehicleById.get(order.vehicleId);
          return {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status as 'OPEN' | 'AWAITING_APPROVAL' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'COMPLETED' | 'DELIVERED',
            customerName: customerById.get(order.customerId)?.name ?? 'Cliente removido',
            vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Veículo removido',
            vehiclePlate: vehicle?.plate ?? '—',
            amountCents: outstanding(order),
            expectedDeliveryAt: order.expectedDeliveryAt?.toISOString(),
          };
        })
        .filter((order) => order.amountCents > 0)
        .sort((left, right) => right.amountCents - left.amountCents)
        .slice(0, 8),
      topServices: [...serviceRanking.entries()]
        .map(([description, values]) => ({ description, ...values }))
        .sort((left, right) => right.revenueCents - left.revenueCents)
        .slice(0, 5),
    };
  }

  async technicianProductivity(request: TechnicianProductivityRequest): Promise<TechnicianProductivityResponse> {
    const startAt = new Date(request.startAt);
    const endAt = new Date(request.endAt);
    const [orders, activeUsers] = await Promise.all([
      this.serviceOrderRepository.listForProductivity(startAt, endAt),
      // Base da lista: todo técnico ativo aparece, mesmo com 0 OS no
      // período — é justamente isso que torna o relatório útil pra achar
      // quem está sem produção, não só ranquear quem já apareceu.
      this.userRepository.listByTenant(0, 500, { status: 'active' }),
    ]);
    const financialItems = await this.itemRepository.financialItemsByServiceOrderIds(orders.map((order) => order.id));
    const laborByOrderId = new Map<string, number>();
    financialItems.filter((item) => item.type === 'LABOR').forEach((item) => {
      laborByOrderId.set(item.serviceOrderId, (laborByOrderId.get(item.serviceOrderId) ?? 0) + item.lineTotalCents);
    });

    const delivered = orders.filter((order) => order.status === 'DELIVERED' && order.closedAt);
    const active = orders.filter((order) => order.status !== 'DELIVERED');

    const buckets = new Map<string, { completedCount: number; laborRevenueCents: number; totalHours: number; activeOrders: number }>();
    const bucketFor = (technicianId: string) => {
      if (!buckets.has(technicianId)) buckets.set(technicianId, { completedCount: 0, laborRevenueCents: 0, totalHours: 0, activeOrders: 0 });
      return buckets.get(technicianId)!;
    };
    delivered.forEach((order) => {
      if (!order.technicianId) return;
      const bucket = bucketFor(order.technicianId);
      bucket.completedCount += 1;
      bucket.laborRevenueCents += laborByOrderId.get(order.id) ?? 0;
      bucket.totalHours += (order.closedAt!.getTime() - order.openedAt.getTime()) / 3_600_000;
    });
    active.forEach((order) => {
      if (!order.technicianId) return;
      bucketFor(order.technicianId).activeOrders += 1;
    });

    const items = activeUsers.items.map((technician) => {
      const bucket = buckets.get(technician.id) ?? { completedCount: 0, laborRevenueCents: 0, totalHours: 0, activeOrders: 0 };
      return {
        technicianId: technician.id,
        technicianName: technician.name,
        completedCount: bucket.completedCount,
        laborRevenueCents: bucket.laborRevenueCents,
        avgCompletionHours: bucket.completedCount > 0 ? Math.round((bucket.totalHours / bucket.completedCount) * 10) / 10 : null,
        activeOrders: bucket.activeOrders,
      };
    }).sort((left, right) => right.laborRevenueCents - left.laborRevenueCents || right.completedCount - left.completedCount);

    return { startAt: request.startAt, endAt: request.endAt, items };
  }

  async addItem(request: CreateServiceOrderItemRequest, actingUser?: AuthenticatedUser): Promise<{ item: ServiceOrderItemResponse }> {
    const serviceOrder = await this.serviceOrderRepository.byId(request.serviceOrderId);
    if (!serviceOrder) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_NOT_FOUND, 'Ordem de serviço não encontrada.', HttpStatus.NOT_FOUND);
    }

    if (request.careServiceKey && ['DELIVERED', 'CANCELLED'].includes(serviceOrder.status)) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Para uma OS encerrada, registre o cuidado na central de relacionamento.');
    const closedReason = this.closedEditReason(serviceOrder.status, request.editReason);
    const previousTotal = closedReason ? await this.computeTotalAmountCents(serviceOrder.id) : 0;
    const created = await this.itemRepository.insert({
      serviceOrderId: request.serviceOrderId,
      type: request.type,
      description: request.description,
      quantity: request.quantity,
      unitPriceCents: request.unitPriceCents,
      careServiceKey: request.careServiceKey,
    });

    if (closedReason) await this.auditClosedItemChange(actingUser, serviceOrder, 'add', created.id, closedReason, previousTotal);
    return { item: this.toItemResponse(created) };
  }

  async updateItem(request: UpdateServiceOrderItemRequest, actingUser?: AuthenticatedUser): Promise<{ item: ServiceOrderItemResponse }> {
    const existing = await this.itemRepository.byId(request.id);
    if (!existing) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_ITEM_NOT_FOUND, 'Item da OS não encontrado.', HttpStatus.NOT_FOUND);
    }

    // Item não tem tenant_id próprio (ver schema.prisma) — o isolamento é
    // garantido checando se a OS dona é visível pro tenant atual, via
    // ServiceOrderRepository.byId() (tenant-scoped pela extensão Prisma).
    const owningOrder = await this.serviceOrderRepository.byId(existing.serviceOrderId);
    if (!owningOrder) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_ITEM_NOT_FOUND, 'Item da OS não encontrado.', HttpStatus.NOT_FOUND);
    }

    if (request.careServiceKey !== undefined && request.careServiceKey !== existing.careServiceKey && ['DELIVERED', 'CANCELLED'].includes(owningOrder.status)) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Para uma OS encerrada, registre o cuidado na central de relacionamento.');
    const closedReason = this.closedEditReason(owningOrder.status, request.editReason);
    const previousTotal = closedReason ? await this.computeTotalAmountCents(owningOrder.id) : 0;
    await this.itemRepository.update(request.id, {
      type: request.type,
      description: request.description,
      quantity: request.quantity,
      unitPriceCents: request.unitPriceCents,
      careServiceKey: request.careServiceKey,
    });

    const updated = await this.itemRepository.byId(request.id);
    if (!updated) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_ITEM_NOT_FOUND, 'Item da OS não encontrado.', HttpStatus.NOT_FOUND);
    }

    if (closedReason) await this.auditClosedItemChange(actingUser, owningOrder, 'update', request.id, closedReason, previousTotal);
    return { item: this.toItemResponse(updated) };
  }

  async deleteItem(id: string, actingUser?: AuthenticatedUser, editReason?: string): Promise<{ item: ServiceOrderItemResponse }> {
    const existing = await this.itemRepository.byId(id);
    if (!existing) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_ITEM_NOT_FOUND, 'Item da OS não encontrado.', HttpStatus.NOT_FOUND);
    }

    const owningOrder = await this.serviceOrderRepository.byId(existing.serviceOrderId);
    if (!owningOrder) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_ITEM_NOT_FOUND, 'Item da OS não encontrado.', HttpStatus.NOT_FOUND);
    }

    const closedReason = this.closedEditReason(owningOrder.status, editReason);
    const previousTotal = closedReason ? await this.computeTotalAmountCents(owningOrder.id) : 0;
    const { count } = await this.itemRepository.softDelete(id);
    if (count === 0) {
      throw new AppException(AppErrorCode.SERVICE_ORDER_ITEM_NOT_FOUND, 'Item da OS não encontrado.', HttpStatus.NOT_FOUND);
    }

    if (closedReason) await this.auditClosedItemChange(actingUser, owningOrder, 'delete', id, closedReason, previousTotal);
    return { item: this.toItemResponse(existing) };
  }

  // Prices of a delivered or cancelled order change money already counted: a reason is mandatory and audited.
  private closedEditReason(status: string, editReason?: string): string | undefined {
    if (!['DELIVERED', 'CANCELLED'].includes(status)) return undefined;
    const reason = editReason?.trim();
    if (!reason || reason.length < 5) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Informe o motivo da correção (mínimo 5 caracteres) para alterar os itens de uma OS encerrada.', HttpStatus.BAD_REQUEST);
    }
    return reason;
  }

  private async auditClosedItemChange(actingUser: AuthenticatedUser | undefined, order: { id: string; status: string; tenantId: string }, itemAction: 'add' | 'update' | 'delete', itemId: string, reason: string, previousAmountCents: number): Promise<void> {
    if (!actingUser) return;
    await this.auditLog.record({
      tenantId: actingUser.tenantId,
      userId: actingUser.userId,
      action: 'service_order.closed_items_changed',
      entity: 'service_order_item',
      entityId: itemId,
      metadata: { serviceOrderId: order.id, status: order.status, itemAction, reason, previousAmountCents, amountCents: await this.computeTotalAmountCents(order.id) },
    });
  }

  async configurePayment(actingUser: AuthenticatedUser, request: ConfigureServiceOrderPaymentRequest): Promise<{ serviceOrder: ServiceOrderResponse }> {
    const serviceOrder = await this.serviceOrderRepository.byId(request.serviceOrderId);
    if (!serviceOrder) throw new AppException(AppErrorCode.SERVICE_ORDER_NOT_FOUND, 'Ordem de serviço não encontrada.', HttpStatus.NOT_FOUND);
    const installmentCount = request.method === 'CREDIT_CARD' ? request.installments : 1;
    if (!request.anticipated && !request.firstDueAt) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Informe a data da primeira parcela.', HttpStatus.BAD_REQUEST);
    }
    const totalAmountCents = netTotal(await this.computeTotalAmountCents(serviceOrder.id), serviceOrder.discountCents);
    if (totalAmountCents <= 0) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Adicione peças ou serviços antes de configurar o pagamento.', HttpStatus.BAD_REQUEST);
    }

    await this.prisma.transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${serviceOrder.id}))`;
      const [paidInstallment, existingReceipt] = await Promise.all([
        tx.serviceOrderInstallment.findFirst({ where: { serviceOrderId: serviceOrder.id, status: 'PAID', deletedAt: null } }),
        tx.serviceOrderReceipt.findFirst({ where: { serviceOrderId: serviceOrder.id, deletedAt: null } }),
      ]);
      if (paidInstallment || existingReceipt) {
        throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Não é possível alterar uma condição que já possui recebimento confirmado.', HttpStatus.BAD_REQUEST);
      }
      await tx.serviceOrderInstallment.updateMany({ where: { serviceOrderId: serviceOrder.id, deletedAt: null }, data: { deletedAt: new Date() } });
      await tx.serviceOrder.updateMany({
        where: { id: serviceOrder.id, deletedAt: null },
        data: {
          paymentMethod: request.method,
          // service_orders_payment_installments_check só aceita valor não nulo
          // quando o método é CREDIT_CARD.
          paymentInstallments: request.method === 'CREDIT_CARD' ? installmentCount : null,
          paymentAnticipated: request.anticipated,
          paymentFirstDueAt: request.firstDueAt ? new Date(request.firstDueAt) : null,
        },
      });

      if (request.anticipated) {
        await tx.serviceOrderReceipt.create({ data: {
          tenantId: actingUser.tenantId,
          serviceOrderId: serviceOrder.id,
          method: request.method,
          amountCents: totalAmountCents,
          receivedAt: new Date(),
          confirmedBy: actingUser.userId,
          notes: `Recebimento antecipado${installmentCount > 1 ? ` · ${installmentCount}x` : ''}`,
        } });
        return;
      }

      const firstDueAt = new Date(request.firstDueAt!);
      const regularAmountCents = Math.floor(totalAmountCents / installmentCount);
      await tx.serviceOrderInstallment.createMany({
        data: Array.from({ length: installmentCount }, (_, index) => ({
          tenantId: actingUser.tenantId,
          serviceOrderId: serviceOrder.id,
          installmentNumber: index + 1,
          installmentCount,
          amountCents: index === installmentCount - 1
            ? totalAmountCents - regularAmountCents * (installmentCount - 1)
            : regularAmountCents,
          dueAt: addMonthsClamped(firstDueAt, index),
        })),
      });
    });

    await this.auditLog.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'service_order.payment_configured', entity: 'service_order', entityId: serviceOrder.id, metadata: { method: request.method, installments: installmentCount, anticipated: request.anticipated } });
    return this.getById(serviceOrder.id);
  }

  async confirmInstallment(actingUser: AuthenticatedUser, request: ConfirmServiceOrderInstallmentRequest): Promise<{ installment: ServiceOrderInstallmentResponse }> {
    const installment = await this.prisma.client.serviceOrderInstallment.findFirst({ where: { id: request.id, deletedAt: null } });
    if (!installment) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Parcela não encontrada.', HttpStatus.NOT_FOUND);
    const serviceOrder = await this.serviceOrderRepository.byId(installment.serviceOrderId);
    if (!serviceOrder) throw new AppException(AppErrorCode.SERVICE_ORDER_NOT_FOUND, 'Ordem de serviço não encontrada.', HttpStatus.NOT_FOUND);
    const updated = await this.prisma.transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${installment.serviceOrderId}))`;
      const current = await tx.serviceOrderInstallment.findFirst({ where: { id: installment.id, deletedAt: null } });
      if (!current || current.status === 'PAID') throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Esta parcela já foi recebida.', HttpStatus.BAD_REQUEST);
      const receipt = await tx.serviceOrderReceipt.create({ data: {
        tenantId: actingUser.tenantId,
        serviceOrderId: serviceOrder.id,
        method: serviceOrder.paymentMethod ?? 'CREDIT_CARD',
        amountCents: current.amountCents,
        receivedAt: new Date(),
        confirmedBy: actingUser.userId,
        notes: `Parcela ${current.installmentNumber}/${current.installmentCount}`,
      } });
      return tx.serviceOrderInstallment.update({
        where: { id: installment.id },
        data: { status: 'PAID', paidAt: new Date(), receiptId: receipt.id },
      });
    });
    await this.auditLog.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'service_order.installment_confirmed', entity: 'service_order_installment', entityId: updated.id, metadata: { serviceOrderId: serviceOrder.id, amountCents: updated.amountCents } });
    return { installment: this.toInstallmentResponse(updated) };
  }

  async listDueInstallments(limit: number): Promise<{ items: ServiceOrderInstallmentResponse[]; total: number }> {
    const alertUntil = new Date();
    alertUntil.setDate(alertUntil.getDate() + 3);
    const where = { status: 'PENDING', dueAt: { lte: alertUntil }, deletedAt: null };
    const [installments, total] = await Promise.all([
      this.prisma.client.serviceOrderInstallment.findMany({ where, orderBy: { dueAt: 'asc' }, take: limit }),
      this.prisma.client.serviceOrderInstallment.count({ where }),
    ]);
    const orderIds = [...new Set(installments.map((item) => item.serviceOrderId))];
    const orders = await this.prisma.client.serviceOrder.findMany({ where: { id: { in: orderIds }, deletedAt: null } });
    const customers = await this.customerRepository.byIds([...new Set(orders.map((order) => order.customerId))]);
    const vehicles = await this.vehicleRepository.byIds([...new Set(orders.map((order) => order.vehicleId))]);
    const orderMap = new Map(orders.map((order) => [order.id, order]));
    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
    const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
    return {
      total,
      items: installments.map((installment) => {
        const order = orderMap.get(installment.serviceOrderId);
        return {
          ...this.toInstallmentResponse(installment),
          orderNumber: order?.orderNumber,
          customerName: order ? customerMap.get(order.customerId)?.name : undefined,
          vehiclePlate: order ? vehicleMap.get(order.vehicleId)?.plate : undefined,
        };
      }),
    };
  }

  async confirmReceipt(actingUser: AuthenticatedUser, request: ConfirmServiceOrderReceiptRequest): Promise<{ receipt: ServiceOrderReceiptResponse }> {
    const serviceOrder = await this.serviceOrderRepository.byId(request.serviceOrderId);
    if (!serviceOrder) throw new AppException(AppErrorCode.SERVICE_ORDER_NOT_FOUND, 'Ordem de serviço não encontrada.', HttpStatus.NOT_FOUND);
    if (!serviceOrder.paymentMethod) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Defina primeiro a forma de pagamento combinada na OS.', HttpStatus.BAD_REQUEST);
    }
    const receipt = await this.prisma.transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${serviceOrder.id}))`;
      const [items, receipts] = await Promise.all([
        tx.serviceOrderItem.findMany({ where: { serviceOrderId: serviceOrder.id, deletedAt: null } }),
        tx.serviceOrderReceipt.findMany({ where: { serviceOrderId: serviceOrder.id, deletedAt: null } }),
      ]);
      const totalAmountCents = netTotal(items.reduce((sum, item) => sum + Math.round(item.quantity.toNumber() * item.unitPriceCents), 0), serviceOrder.discountCents);
      const received = receipts.reduce((sum, item) => sum + item.amountCents, 0);
      if (request.amountCents > totalAmountCents - received) {
        throw new AppException(AppErrorCode.SERVICE_ORDER_RECEIPT_EXCEEDS_BALANCE, 'O valor recebido é maior que o saldo pendente.', HttpStatus.BAD_REQUEST);
      }
      return tx.serviceOrderReceipt.create({ data: {
        tenantId: actingUser.tenantId,
        serviceOrderId: serviceOrder.id,
        method: request.method,
        amountCents: request.amountCents,
        receivedAt: request.receivedAt ? new Date(request.receivedAt) : new Date(),
        confirmedBy: actingUser.userId,
        notes: request.notes?.trim() || undefined,
      } });
    });
    await this.auditLog.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'service_order.receipt_confirmed', entity: 'service_order_receipt', entityId: receipt.id, metadata: { serviceOrderId: serviceOrder.id, amountCents: receipt.amountCents, method: receipt.method } });
    return { receipt: this.toReceiptResponse(receipt) };
  }

  async deleteReceipt(actingUser: AuthenticatedUser, request: DeleteServiceOrderReceiptRequest): Promise<{ success: true }> {
    const receipt = await this.receiptRepository.byId(request.id);
    if (!receipt) throw new AppException(AppErrorCode.SERVICE_ORDER_RECEIPT_NOT_FOUND, 'Recebimento não encontrado.', HttpStatus.NOT_FOUND);
    const serviceOrder = await this.serviceOrderRepository.byId(receipt.serviceOrderId);
    if (!serviceOrder) throw new AppException(AppErrorCode.SERVICE_ORDER_RECEIPT_NOT_FOUND, 'Recebimento não encontrado.', HttpStatus.NOT_FOUND);
    await this.receiptRepository.softDelete(receipt.id);
    await this.auditLog.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'service_order.receipt_reversed', entity: 'service_order_receipt', entityId: receipt.id, metadata: { serviceOrderId: serviceOrder.id, amountCents: receipt.amountCents } });
    return { success: true };
  }

  private async computeTotalAmountCents(serviceOrderId: string): Promise<number> {
    const items = await this.itemRepository.byServiceOrderId(serviceOrderId);
    return items.reduce((sum, item) => sum + this.toItemResponse(item).lineTotalCents, 0);
  }

  private toItemResponse(item: ServiceOrderItemEntity): ServiceOrderItemResponse {
    const quantity = item.quantity.toNumber();
    return {
      id: item.id,
      serviceOrderId: item.serviceOrderId,
      type: item.type as ServiceOrderItemResponse['type'],
      description: item.description,
      quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: Math.round(quantity * item.unitPriceCents),
      careServiceKey: item.careServiceKey as ServiceOrderItemResponse['careServiceKey'] ?? undefined,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private toResponse(
    serviceOrder: ServiceOrderEntity,
    vehicle: VehicleEntity | null,
    customer: CustomerEntity | null,
    technician: UserEntity | null,
    options?: {
      history?: ServiceOrderStatusHistoryEntity[];
      // `items` só populado por getById (mesmo padrão de `history`) — quando
      // presente, o total é somado a partir dele; senão usa
      // `totalAmountCentsOverride`, já calculado em lote/individualmente
      // pelo chamador (list/create/update/transition/delete). Nunca um
      // campo denormalizado (ver plano itens-e-preco-da-os.md).
      items?: ServiceOrderItemEntity[];
      receipts?: ServiceOrderReceiptEntity[];
      installments?: ServiceOrderInstallmentEntity[];
      totalAmountCentsOverride?: number;
    },
  ): ServiceOrderResponse {
    const itemResponses = options?.items?.map((item) => this.toItemResponse(item));
    const grossAmountCents = itemResponses
      ? itemResponses.reduce((sum, item) => sum + item.lineTotalCents, 0)
      : (options?.totalAmountCentsOverride ?? 0);
    const discountCents = Math.min(serviceOrder.discountCents ?? 0, grossAmountCents);
    const totalAmountCents = grossAmountCents - discountCents;
    const receiptResponses = options?.receipts?.map((receipt) => this.toReceiptResponse(receipt));
    const receivedAmountCents = receiptResponses?.reduce((sum, receipt) => sum + receipt.amountCents, 0) ?? 0;
    const outstandingAmountCents = Math.max(0, totalAmountCents - receivedAmountCents);

    return {
      id: serviceOrder.id,
      ...(itemResponses ? { quoteRevision: quoteRevision(itemResponses.map(({ id, description, type, quantity, unitPriceCents, lineTotalCents }) => ({ id, description, type, quantity, unitPriceCents, lineTotalCents })), discountCents) } : {}),
      tenantId: serviceOrder.tenantId,
      orderNumber: serviceOrder.orderNumber,
      customerId: serviceOrder.customerId,
      customerName: customer?.name ?? 'Cliente removido',
      customerPhone: customer?.phone ?? '—',
      vehicleId: serviceOrder.vehicleId,
      vehicleBrand: vehicle?.brand ?? '—',
      vehicleModel: vehicle?.model ?? '—',
      vehiclePlate: vehicle?.plate ?? 'Veículo removido',
      status: serviceOrder.status as ServiceOrderResponse['status'],
      checklist: (serviceOrder.checklist as Record<string, unknown> | null) ?? undefined,
      diagnosis: serviceOrder.diagnosis ?? undefined,
      entryMileage: serviceOrder.entryMileage ?? undefined,
      customerComplaint: serviceOrder.customerComplaint ?? undefined,
      receptionNotes: serviceOrder.receptionNotes ?? undefined,
      recommendedService: serviceOrder.recommendedService ?? undefined,
      expectedDeliveryAt: serviceOrder.expectedDeliveryAt?.toISOString(),
      paymentMethod: serviceOrder.paymentMethod as ServiceOrderResponse['paymentMethod'],
      paymentInstallments: serviceOrder.paymentInstallments ?? undefined,
      paymentAnticipated: serviceOrder.paymentAnticipated,
      paymentFirstDueAt: serviceOrder.paymentFirstDueAt?.toISOString(),
      technicianId: serviceOrder.technicianId ?? undefined,
      technicianName: technician?.name,
      openedAt: serviceOrder.openedAt.toISOString(),
      closedAt: serviceOrder.closedAt?.toISOString(),
      createdAt: serviceOrder.createdAt.toISOString(),
      statusHistory: options?.history?.map((item) => this.toHistoryItem(item)),
      totalAmountCents,
      discountCents,
      warrantyDays: serviceOrder.warrantyDays ?? undefined,
      exitMileage: serviceOrder.exitMileage ?? undefined,
      items: itemResponses,
      receipts: receiptResponses,
      installments: options?.installments?.map((installment) => this.toInstallmentResponse(installment)),
      receivedAmountCents,
      outstandingAmountCents,
      paymentStatus: receivedAmountCents === 0 ? 'AWAITING_PAYMENT' : outstandingAmountCents > 0 ? 'PARTIALLY_PAID' : 'PAID',
    };
  }

  private toReceiptResponse(receipt: ServiceOrderReceiptEntity): ServiceOrderReceiptResponse {
    return {
      id: receipt.id,
      serviceOrderId: receipt.serviceOrderId,
      method: receipt.method as ServiceOrderReceiptResponse['method'],
      amountCents: receipt.amountCents,
      receivedAt: receipt.receivedAt.toISOString(),
      confirmedBy: receipt.confirmedBy,
      notes: receipt.notes ?? undefined,
    };
  }

  private toInstallmentResponse(installment: ServiceOrderInstallmentEntity): ServiceOrderInstallmentResponse {
    return {
      id: installment.id,
      serviceOrderId: installment.serviceOrderId,
      installmentNumber: installment.installmentNumber,
      installmentCount: installment.installmentCount,
      amountCents: installment.amountCents,
      dueAt: installment.dueAt.toISOString(),
      status: installment.status as ServiceOrderInstallmentResponse['status'],
      paidAt: installment.paidAt?.toISOString(),
      receiptId: installment.receiptId ?? undefined,
    };
  }

  private toHistoryItem(item: ServiceOrderStatusHistoryEntity): ServiceOrderStatusHistoryItemResponse {
    return {
      id: item.id,
      fromStatus: (item.fromStatus as ServiceOrderStatusHistoryItemResponse['fromStatus']) ?? null,
      toStatus: item.toStatus as ServiceOrderStatusHistoryItemResponse['toStatus'],
      changedBy: item.changedBy,
      changedAt: item.changedAt.toISOString(),
    };
  }
}

function addMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}
