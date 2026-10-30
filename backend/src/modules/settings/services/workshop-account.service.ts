import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuditLogItem, AuditLogRequest, AuditLogResponse, DataExportDataset, WorkshopSubscriptionResponse } from '@oficina/contracts';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';

const CHUNK = 1000;
// A workshop that outgrows this should ask for a database export, not a spreadsheet.
const MAX_ROWS = 100_000;

// Spreadsheets run text that starts with these as a formula: a customer named "=HYPERLINK(...)" must not.
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
const csvLine = (cells: unknown[]) => cells.map(csvCell).join(';');
const day = (value: Date | null) => value ? value.toISOString().slice(0, 10) : '';
const reais = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

@Injectable()
export class WorkshopAccountService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}

  // The plan the workshop pays for. Internal notes and admin-only fields stay out.
  async subscription(user: AuthenticatedUser): Promise<WorkshopSubscriptionResponse> {
    const tenant = await this.prisma.unscoped.tenant.findFirst({ where: { id: user.tenantId, deletedAt: null }, select: { plan: true, subscriptionStatus: true, subscriptionAmountCents: true, subscriptionCycle: true, subscriptionDueAt: true, createdAt: true } });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    return { plan: tenant.plan, status: tenant.subscriptionStatus as WorkshopSubscriptionResponse['status'], amountCents: tenant.subscriptionAmountCents, cycle: tenant.subscriptionCycle as WorkshopSubscriptionResponse['cycle'], dueAt: tenant.subscriptionDueAt?.toISOString() ?? null, customerSince: tenant.createdAt.toISOString() };
  }

  // Who changed what and when, newest first. The metadata is already minimized when recorded.
  async history(request: AuditLogRequest, user: AuthenticatedUser): Promise<AuditLogResponse> {
    const where = {
      tenantId: user.tenantId,
      ...(request.actionPrefix ? { action: { startsWith: request.actionPrefix } } : {}),
      ...(request.userId ? { userId: request.userId } : {}),
      ...((request.from || request.to) ? { createdAt: { ...(request.from ? { gte: new Date(request.from) } : {}), ...(request.to ? { lt: new Date(request.to) } : {}) } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.client.auditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: request.offset, take: request.limit }),
      this.prisma.client.auditLog.count({ where }),
    ]);
    const ids = [...new Set(rows.map(row => row.userId).filter((id): id is string => Boolean(id)))];
    const users = ids.length ? await this.prisma.client.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const names = new Map(users.map(entry => [entry.id, entry.name]));
    const items: AuditLogItem[] = rows.map(row => ({ id: row.id, action: row.action, entity: row.entity, entityId: row.entityId, userId: row.userId, userName: row.userId ? names.get(row.userId) ?? 'Usuário removido' : null, metadata: (row.metadata ?? {}) as Record<string, string | number | boolean>, createdAt: row.createdAt.toISOString() }));
    return { items, total, offset: request.offset, limit: request.limit };
  }

  // The workshop's own records as a spreadsheet: portability for them and peace of mind about not being locked in.
  async export(dataset: DataExportDataset, user: AuthenticatedUser): Promise<{ filename: string; content: string }> {
    const lines: string[] = [];
    let count = 0;
    const header = (cells: string[]) => lines.push(csvLine(cells));
    const chunks = async <T extends { id: string }>(read: (cursor: string | undefined) => Promise<T[]>, write: (rows: T[]) => Promise<void>) => {
      let cursor: string | undefined;
      while (count < MAX_ROWS) {
        const rows = await read(cursor);
        if (!rows.length) break;
        await write(rows);
        count += rows.length;
        cursor = rows[rows.length - 1].id;
        if (rows.length < CHUNK) break;
      }
    };
    const page = (cursor: string | undefined) => ({ take: CHUNK, orderBy: { id: 'asc' as const }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    const client = this.prisma.client;

    if (dataset === 'customers') {
      header(['Nome', 'Tipo', 'CPF/CNPJ', 'E-mail', 'Telefone', 'Nascimento', 'Aceita lembretes', 'Endereço', 'Observações', 'Cadastro', 'Arquivado em']);
      await chunks((cursor) => client.customer.findMany(page(cursor)), async (rows) => { for (const row of rows) lines.push(csvLine([row.name, row.type === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física', row.document, row.email, row.phone, day(row.birthDate), row.careMessagesEnabled ? 'Sim' : 'Não', row.address && typeof row.address === 'object' ? Object.values(row.address as Record<string, unknown>).filter(Boolean).join(', ') : '', row.notes, day(row.createdAt), day(row.deletedAt)])); });
    } else if (dataset === 'vehicles') {
      header(['Cliente', 'Placa', 'Marca', 'Modelo', 'Ano', 'Cor', 'Combustível', 'Motor', 'Chassi', 'Quilometragem', 'Cadastro', 'Arquivado em']);
      await chunks((cursor) => client.vehicle.findMany(page(cursor)), async (rows) => {
        const owners = await client.customer.findMany({ where: { id: { in: [...new Set(rows.map(row => row.customerId))] } }, select: { id: true, name: true } });
        const names = new Map(owners.map(owner => [owner.id, owner.name]));
        for (const row of rows) lines.push(csvLine([names.get(row.customerId) ?? '', row.plate, row.brand, row.model, row.year, row.color, row.fuelType, row.engine, row.chassis, row.mileage, day(row.createdAt), day(row.deletedAt)]));
      });
    } else if (dataset === 'service-orders') {
      header(['OS', 'Situação', 'Cliente', 'Placa', 'Veículo', 'Abertura', 'Entrega prevista', 'Encerramento', 'Defeito relatado', 'Diagnóstico', 'Garantia (dias)', 'Desconto (R$)', 'Total (R$)', 'Forma de pagamento', 'Cancelada/excluída em']);
      await chunks((cursor) => client.serviceOrder.findMany(page(cursor)), async (rows) => {
        const ids = rows.map(row => row.id);
        const [customers, vehicles, items] = await Promise.all([
          client.customer.findMany({ where: { id: { in: [...new Set(rows.map(row => row.customerId))] } }, select: { id: true, name: true } }),
          client.vehicle.findMany({ where: { id: { in: [...new Set(rows.map(row => row.vehicleId))] } }, select: { id: true, plate: true, brand: true, model: true } }),
          client.serviceOrderItem.findMany({ where: { serviceOrderId: { in: ids }, deletedAt: null }, select: { serviceOrderId: true, quantity: true, unitPriceCents: true } }),
        ]);
        const customerNames = new Map(customers.map(entry => [entry.id, entry.name]));
        const vehicleById = new Map(vehicles.map(entry => [entry.id, entry]));
        const gross = new Map<string, number>();
        for (const item of items) gross.set(item.serviceOrderId, (gross.get(item.serviceOrderId) ?? 0) + Math.round(Number(item.quantity) * item.unitPriceCents));
        for (const row of rows) { const vehicle = vehicleById.get(row.vehicleId); lines.push(csvLine([row.orderNumber, row.status, customerNames.get(row.customerId) ?? '', vehicle?.plate ?? '', vehicle ? `${vehicle.brand} ${vehicle.model}` : '', day(row.openedAt), day(row.expectedDeliveryAt), day(row.closedAt), row.customerComplaint, row.diagnosis, row.warrantyDays, reais(row.discountCents), reais(Math.max(0, (gross.get(row.id) ?? 0) - row.discountCents)), row.paymentMethod, day(row.deletedAt)])); }
      });
    } else {
      header(['Tipo', 'Descrição', 'Categoria', 'Valor (R$)', 'Pago (R$)', 'Vencimento', 'Situação', 'Pago em', 'Observações', 'Lançado em', 'Excluído em']);
      await chunks((cursor) => client.financialEntry.findMany(page(cursor)), async (rows) => {
        const categories = await client.financialCategory.findMany({ where: { id: { in: [...new Set(rows.map(row => row.categoryId))] } }, select: { id: true, name: true } });
        const names = new Map(categories.map(entry => [entry.id, entry.name]));
        for (const row of rows) lines.push(csvLine([row.type === 'INCOME' ? 'Receita' : 'Despesa', row.description, names.get(row.categoryId) ?? '', reais(row.amountCents), reais(row.paidCents), day(row.dueAt), row.status, day(row.paidAt), row.notes, day(row.createdAt), day(row.deletedAt)]));
      });
    }

    const content = `﻿${lines.join('\r\n')}\r\n`;
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'settings.data_exported', entity: 'tenant', entityId: user.tenantId, metadata: { category: dataset, sizeBytes: Buffer.byteLength(content) } });
    return { filename: `${dataset}-${new Date().toISOString().slice(0, 10)}.csv`, content };
  }
}
