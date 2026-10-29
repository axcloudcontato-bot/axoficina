import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  DismissMaintenanceAlertRequest,
  MaintenanceAlertContactOutcome,
  MaintenanceAlertContactResponse,
  MaintenanceAlertDismissReason,
  MaintenanceAlertListItemResponse,
  MaintenanceAlertListRequest,
  MaintenanceAlertResponse,
  PaginationData,
  RecordMaintenanceAlertContactRequest,
  SnoozeMaintenanceAlertRequest,
} from '@oficina/contracts';
import type { MaintenanceAlert as MaintenanceAlertEntity, User as UserEntity } from '@oficina/database';
import { AppErrorCode } from '../../../shared/errors/app-error-code';
import { AppException } from '../../../shared/errors/app-exception';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { addMonthsClamped } from '../../customer-care/care-policy';
import { UserRepository } from '../../iam/repositories/user.repository';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { CustomerRepository } from '../../customers/repositories/customer.repository';
import { MaintenanceAlertRepository } from '../repositories/maintenance-alert.repository';
import { monthsSince } from '../utils/months-since';
import { overdueCare } from '../utils/overdue-care';

const DEFAULT_LIST_STATUS = 'OPEN';

@Injectable()
export class MaintenanceAlertManager {
  constructor(
    private readonly maintenanceAlertRepository: MaintenanceAlertRepository,
    private readonly vehicleRepository: VehicleRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly userRepository: UserRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(request: MaintenanceAlertListRequest, now: Date = new Date()): Promise<PaginationData<MaintenanceAlertListItemResponse>> {
    const filter = request.status ?? DEFAULT_LIST_STATUS;
    const term = request.search?.trim();
    // The search finds the vehicles (plate, brand, model) and the owners (name, document) that match, and the alerts of those.
    const search = term
      ? { vehicleIds: await this.vehicleRepository.searchIdsByPlateOrModel(term), customerIds: await this.customerRepository.searchIdsByNameOrDocument(term) }
      : undefined;
    const refine = await this.refinement(request, now);
    // A contact filter that matches nobody is an empty page, not an unfiltered one.
    if (refine?.alertIds?.in && refine.alertIds.in.length === 0) return { items: [], total: 0, offset: request.offset, limit: request.limit, hasMore: false };

    const { items, total } = await this.maintenanceAlertRepository.listByTenant(request.offset, request.limit, filter, now, search, refine);

    return {
      items: await this.toResponses(items, now),
      total,
      offset: request.offset,
      limit: request.limit,
      hasMore: request.offset + items.length < total,
    };
  }

  // How long since the last visit, and whether anyone already tried to reach the customer.
  private async refinement(request: MaintenanceAlertListRequest, now: Date) {
    const refine: { referenceBefore?: Date; referenceAfter?: Date; alertIds?: { in?: string[]; notIn?: string[] } } = {};
    if (request.minMonths) refine.referenceBefore = addMonthsClamped(now, -request.minMonths);
    if (request.maxMonths) refine.referenceAfter = addMonthsClamped(now, -request.maxMonths);
    if (request.contact) {
      const contacted = await this.maintenanceAlertRepository.contactedAlertIds();
      refine.alertIds = request.contact === 'CONTACTED' ? { in: contacted } : { notIn: contacted };
    }
    return Object.keys(refine).length ? refine : undefined;
  }

  // The customer is not forgotten: the alert comes back by itself when the time is up, if the car is still due.
  async snooze(actingUser: AuthenticatedUser, request: SnoozeMaintenanceAlertRequest, now: Date = new Date()): Promise<{ alert: MaintenanceAlertResponse }> {
    const existing = await this.openAlert(request.id, 'adiados');
    const until = new Date(now.getTime() + request.days * 86_400_000);
    await this.maintenanceAlertRepository.snooze(existing.id, until);
    await this.audit(actingUser, 'maintenance_alert.snoozed', existing.id, {});
    return this.reloaded(existing.id, now);
  }

  // The customer leaves the list, and the reason stays, so nobody wonders why later.
  async dismiss(actingUser: AuthenticatedUser, request: DismissMaintenanceAlertRequest, now: Date = new Date()): Promise<{ alert: MaintenanceAlertResponse }> {
    const existing = await this.openAlert(request.id, 'dispensados');
    await this.maintenanceAlertRepository.dismiss(existing.id, actingUser.userId, now, request.reason, request.note?.trim() || null);
    await this.audit(actingUser, 'maintenance_alert.dismissed', existing.id, { reason: request.reason });
    return this.reloaded(existing.id, now);
  }

  async reopen(actingUser: AuthenticatedUser, id: string, now: Date = new Date()): Promise<{ alert: MaintenanceAlertResponse }> {
    const existing = await this.maintenanceAlertRepository.byId(id);
    if (!existing) throw new AppException(AppErrorCode.MAINTENANCE_ALERT_NOT_FOUND, 'Alerta de manutenção não encontrado.', HttpStatus.NOT_FOUND);
    const closedByPerson = existing.status === 'DISMISSED' || (existing.status === 'RESOLVED' && existing.resolvedBy !== null);
    if (!closedByPerson) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, existing.status === 'OPEN' ? 'Este alerta já está em aberto.' : 'Este alerta foi resolvido pela entrega de uma OS e não pode ser reaberto.', HttpStatus.BAD_REQUEST);
    }
    await this.maintenanceAlertRepository.reopen(id);
    await this.audit(actingUser, 'maintenance_alert.reopened', id, {});
    return this.reloaded(id, now);
  }

  async resolve(actingUser: AuthenticatedUser, id: string): Promise<{ alert: MaintenanceAlertResponse }> {
    const existing = await this.maintenanceAlertRepository.byId(id);
    if (!existing) {
      throw new AppException(AppErrorCode.MAINTENANCE_ALERT_NOT_FOUND, 'Alerta de manutenção não encontrado.', HttpStatus.NOT_FOUND);
    }

    // Idempotente (Edge Case 8 da spec): resolver um alerta já RESOLVED
    // retorna o estado atual sem re-escrever `resolvedAt`/`resolvedBy`.
    let updated = existing;
    if (existing.status === 'OPEN') {
      await this.maintenanceAlertRepository.resolve(id, actingUser.userId, new Date());
      updated = (await this.maintenanceAlertRepository.byId(id)) ?? existing;
    }

    if (existing.status === 'OPEN') await this.audit(actingUser, 'maintenance_alert.resolved', id, {});
    return this.reloaded(id, new Date(), updated);
  }

  // One more attempt to reach the customer. It does not close or postpone anything: the person decides that next.
  async recordContact(actingUser: AuthenticatedUser, request: RecordMaintenanceAlertContactRequest, now: Date = new Date()): Promise<{ alert: MaintenanceAlertResponse }> {
    const existing = await this.openAlert(request.id, 'contatados');
    await this.maintenanceAlertRepository.addContact(actingUser.tenantId, existing.id, request.outcome, request.note?.trim() || null, actingUser.userId);
    await this.audit(actingUser, 'maintenance_alert.contact_recorded', existing.id, {});
    return this.reloaded(existing.id, now);
  }

  async contacts(id: string): Promise<{ contacts: MaintenanceAlertContactResponse[] }> {
    if (!(await this.maintenanceAlertRepository.byId(id))) throw new AppException(AppErrorCode.MAINTENANCE_ALERT_NOT_FOUND, 'Alerta de manutenção não encontrado.', HttpStatus.NOT_FOUND);
    const rows = await this.maintenanceAlertRepository.contactsOf(id);
    const userIds = [...new Set(rows.map((row) => row.createdBy).filter((userId): userId is string => Boolean(userId)))];
    const users = userIds.length ? await this.userRepository.byIds(userIds) : [];
    const nameOf = new Map(users.map((user) => [user.id, user.name]));
    return {
      contacts: rows.map((row) => ({ id: row.id, outcome: row.outcome as MaintenanceAlertContactOutcome, at: row.createdAt.toISOString(), byName: row.createdBy ? nameOf.get(row.createdBy) : undefined, note: row.note ?? undefined })),
    };
  }

  private async openAlert(id: string, plural: string): Promise<MaintenanceAlertEntity> {
    const existing = await this.maintenanceAlertRepository.byId(id);
    if (!existing) throw new AppException(AppErrorCode.MAINTENANCE_ALERT_NOT_FOUND, 'Alerta de manutenção não encontrado.', HttpStatus.NOT_FOUND);
    if (existing.status !== 'OPEN') throw new AppException(AppErrorCode.VALIDATION_ERROR, `Só alertas em aberto podem ser ${plural}.`, HttpStatus.BAD_REQUEST);
    return existing;
  }

  private async reloaded(id: string, now: Date, fallback?: MaintenanceAlertEntity): Promise<{ alert: MaintenanceAlertResponse }> {
    const alert = (await this.maintenanceAlertRepository.byId(id)) ?? fallback;
    if (!alert) throw new AppException(AppErrorCode.MAINTENANCE_ALERT_NOT_FOUND, 'Alerta de manutenção não encontrado.', HttpStatus.NOT_FOUND);
    return { alert: (await this.toResponses([alert], now))[0] };
  }

  private audit(actingUser: AuthenticatedUser, action: string, id: string, metadata: Record<string, unknown>) {
    return this.auditLog.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action, entity: 'maintenance_alert', entityId: id, metadata });
  }

  // Everything around an alert is loaded in batches, never one query per row.
  private async toResponses(alerts: MaintenanceAlertEntity[], now: Date): Promise<MaintenanceAlertResponse[]> {
    if (alerts.length === 0) return [];
    const vehicleIds = [...new Set(alerts.map((alert) => alert.vehicleId))];
    const customerIds = [...new Set(alerts.map((alert) => alert.customerId))];
    const [vehicles, customers, plans, contacts, campaigns] = await Promise.all([
      this.vehicleRepository.byIds(vehicleIds),
      this.customerRepository.byIds(customerIds),
      this.maintenanceAlertRepository.carePlansForVehicles(vehicleIds),
      this.maintenanceAlertRepository.contactsForAlerts(alerts.map((alert) => alert.id)),
      this.maintenanceAlertRepository.careCampaigns(),
    ]);
    const userIds = [...new Set([...alerts.map((alert) => alert.resolvedBy), ...contacts.map((contact) => contact.createdBy)].filter((id): id is string => Boolean(id)))];
    const users = userIds.length ? await this.userRepository.byIds(userIds) : ([] as UserEntity[]);
    const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const userById = new Map(users.map((user) => [user.id, user]));

    return alerts.map((alert) => {
      const vehicle = vehicleById.get(alert.vehicleId) ?? null;
      const customer = customerById.get(alert.customerId) ?? null;
      const resolver = alert.resolvedBy ? userById.get(alert.resolvedBy) : undefined;
      const own = contacts.filter((contact) => contact.alertId === alert.id);
      const last = own[0];
      return {
        id: alert.id,
        tenantId: alert.tenantId,
        vehicleId: alert.vehicleId,
        vehicleBrand: vehicle?.brand ?? '—',
        vehicleModel: vehicle?.model ?? '—',
        vehiclePlate: vehicle?.plate ?? 'Veículo removido',
        customerId: alert.customerId,
        customerName: customer?.name ?? 'Cliente removido',
        referenceDate: alert.referenceDate.toISOString(),
        monthsOverdue: monthsSince(alert.referenceDate, now),
        status: alert.status as MaintenanceAlertResponse['status'],
        resolvedAt: alert.resolvedAt?.toISOString(),
        resolvedBy: alert.resolvedBy ?? undefined,
        resolvedByName: resolver?.name,
        snoozedUntil: alert.snoozedUntil && alert.snoozedUntil > now ? alert.snoozedUntil.toISOString() : undefined,
        dismissReason: (alert.dismissReason ?? undefined) as MaintenanceAlertDismissReason | undefined,
        dismissNote: alert.dismissNote ?? undefined,
        customerPhone: customer?.phone,
        customerCareEnabled: customer?.careMessagesEnabled ?? false,
        vehicleMileage: vehicle?.mileage ?? undefined,
        overdueCare: overdueCare(plans.filter((plan) => plan.vehicleId === alert.vehicleId), vehicle?.mileage ?? null, now, campaigns),
        contactCount: own.length,
        lastContact: last ? { outcome: last.outcome as MaintenanceAlertContactOutcome, at: last.createdAt.toISOString(), byName: last.createdBy ? userById.get(last.createdBy)?.name : undefined, note: last.note ?? undefined } : undefined,
      };
    });
  }
}
