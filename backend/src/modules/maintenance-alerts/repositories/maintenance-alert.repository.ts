import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@oficina/database';
import type { MaintenanceAlertContactOutcome, MaintenanceAlertDismissReason, MaintenanceAlertFilter } from '@oficina/contracts';
import type { Prisma } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { careSettings } from '../../customer-care/care-policy';

export interface UpsertOpenMaintenanceAlertInput {
  tenantId: string;
  vehicleId: string;
  customerId: string;
  referenceDate: Date;
}

@Injectable()
export class MaintenanceAlertRepository {
  constructor(private readonly prisma: PrismaService) {}

  // `this.prisma.client` (tenant-scoped): usado por Controller/Manager
  // dentro de uma requisição autenticada.
  // OPEN shows what is due now; SNOOZED the open ones that were postponed; the other two are history.
  async listByTenant(offset: number, limit: number, filter: MaintenanceAlertFilter, now: Date = new Date(), search?: { vehicleIds: string[]; customerIds: string[] }, refine?: { referenceBefore?: Date; referenceAfter?: Date; alertIds?: { in?: string[]; notIn?: string[] } }) {
    const base: Prisma.MaintenanceAlertWhereInput =
      filter === 'OPEN' ? { status: 'OPEN', OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] }
        : filter === 'SNOOZED' ? { status: 'OPEN', snoozedUntil: { gt: now } }
          : { status: filter };
    const filters: Prisma.MaintenanceAlertWhereInput[] = [base];
    if (search) filters.push({ OR: [{ vehicleId: { in: search.vehicleIds } }, { customerId: { in: search.customerIds } }] });
    // The time since the last visit: referenceBefore = at least that long ago, referenceAfter = not longer ago than that.
    if (refine?.referenceBefore) filters.push({ referenceDate: { lte: refine.referenceBefore } });
    if (refine?.referenceAfter) filters.push({ referenceDate: { gt: refine.referenceAfter } });
    if (refine?.alertIds) filters.push({ id: refine.alertIds });
    const where: Prisma.MaintenanceAlertWhereInput = filters.length === 1 ? base : { AND: filters };
    const orderBy: Prisma.MaintenanceAlertOrderByWithRelationInput =
      filter === 'OPEN' ? { referenceDate: 'asc' } : filter === 'SNOOZED' ? { snoozedUntil: 'asc' } : { resolvedAt: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.client.maintenanceAlert.findMany({ where, orderBy, skip: offset, take: limit }),
      this.prisma.client.maintenanceAlert.count({ where }),
    ]);

    return { items, total };
  }

  async byId(id: string) {
    return this.prisma.client.maintenanceAlert.findFirst({ where: { id } });
  }

  // `updateMany` com `status: 'OPEN'` no WHERE (não só `id`) — idempotente:
  // resolver um alerta já RESOLVED não sobrescreve `resolvedAt`/`resolvedBy`
  // da primeira resolução (Edge Case 8 da spec).
  async resolve(id: string, resolvedBy: string, resolvedAt: Date) {
    return this.prisma.client.maintenanceAlert.updateMany({
      where: { id, status: 'OPEN' },
      data: { status: 'RESOLVED', resolvedAt, resolvedBy, snoozedUntil: null },
    });
  }

  async snooze(id: string, until: Date) {
    return this.prisma.client.maintenanceAlert.updateMany({ where: { id, status: 'OPEN' }, data: { snoozedUntil: until } });
  }

  async dismiss(id: string, dismissedBy: string, dismissedAt: Date, reason: MaintenanceAlertDismissReason, note: string | null) {
    return this.prisma.client.maintenanceAlert.updateMany({
      where: { id, status: 'OPEN' },
      data: { status: 'DISMISSED', resolvedAt: dismissedAt, resolvedBy: dismissedBy, dismissReason: reason, dismissNote: note, snoozedUntil: null },
    });
  }

  // Back to the list. Only what a person closed can be reopened: an alert the delivery of an order closed by itself is done.
  async reopen(id: string) {
    return this.prisma.client.maintenanceAlert.updateMany({
      where: { id, OR: [{ status: 'DISMISSED' }, { status: 'RESOLVED', resolvedBy: { not: null } }] },
      data: { status: 'OPEN', resolvedAt: null, resolvedBy: null, dismissReason: null, dismissNote: null, snoozedUntil: null },
    });
  }

  // Chamado de dentro da transação de ServiceOrderManager.transition (tx já
  // escopado — ver PrismaService.transaction). Resolve automaticamente
  // qualquer alerta OPEN do veículo quando uma OS chega a DELIVERED (Edge
  // Case 4 da spec: a referência mudou, o alerta antigo fica obsoleto).
  async resolveOpenByVehicleId(tx: PrismaClient, vehicleId: string, resolvedAt: Date) {
    return tx.maintenanceAlert.updateMany({
      where: { vehicleId, status: 'OPEN' },
      data: { status: 'RESOLVED', resolvedAt, snoozedUntil: null },
    });
  }

  // Sempre `unscoped`, chamado só por MaintenanceAlertScanProcessor (roda
  // fora do AsyncLocalStorage de uma requisição — mesmo padrão de
  // AuditLogRepository). `upsert` no índice único (vehicleId, referenceDate)
  // é o mecanismo de idempotência: rodar o job duas vezes seguidas nunca
  // duplica alerta, e `update: {}` nunca sobrescreve um alerta já RESOLVED
  // manualmente pro mesmo ciclo.
  async upsertOpenAlert(input: UpsertOpenMaintenanceAlertInput) {
    return this.prisma.unscoped.maintenanceAlert.upsert({
      where: {
        vehicleId_referenceDate: {
          vehicleId: input.vehicleId,
          referenceDate: input.referenceDate,
        },
      },
      create: {
        tenantId: input.tenantId,
        vehicleId: input.vehicleId,
        customerId: input.customerId,
        referenceDate: input.referenceDate,
        status: 'OPEN',
      },
      update: {},
    });
  }

  // Attempts to reach the customer.
  async addContact(tenantId: string, alertId: string, outcome: MaintenanceAlertContactOutcome, note: string | null, createdBy: string) {
    return this.prisma.client.maintenanceAlertContact.create({ data: { tenantId, alertId, outcome, note, createdBy } });
  }

  async contactsOf(alertId: string) {
    return this.prisma.client.maintenanceAlertContact.findMany({ where: { alertId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  // Newest first; the manager takes the first of each alert and counts the rest.
  async contactsForAlerts(alertIds: string[]) {
    if (alertIds.length === 0) return [];
    return this.prisma.client.maintenanceAlertContact.findMany({ where: { alertId: { in: alertIds } }, orderBy: { createdAt: 'desc' } });
  }

  async contactedAlertIds(): Promise<string[]> {
    const rows = await this.prisma.client.maintenanceAlertContact.findMany({ distinct: ['alertId'], select: { alertId: true } });
    return rows.map((row) => row.alertId);
  }

  async carePlansForVehicles(vehicleIds: string[]) {
    if (vehicleIds.length === 0) return [];
    return this.prisma.client.customerCarePlan.findMany({ where: { vehicleId: { in: vehicleIds } } });
  }

  // The workshop's care campaigns, with the intervals it chose in Cuidado com o cliente.
  async careCampaigns() {
    return careSettings(await this.prisma.client.customerCareSettings.findFirst()).campaigns;
  }
}
