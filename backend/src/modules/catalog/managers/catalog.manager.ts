import { HttpStatus, Injectable } from '@nestjs/common';
import type { AdjustStockRequest, CatalogItemResponse, CatalogItemsResponse, CatalogPackageResponse, CatalogPackagesResponse, CatalogReportResponse, CatalogReportRow, CatalogUnit, CreateCatalogItemRequest, ImportCatalogRequest, ImportCatalogResponse, SaveCatalogPackageRequest, SeedCatalogResponse, UpdateCatalogItemRequest } from '@oficina/contracts';
import type { CatalogItem } from '@oficina/database';
import { AppErrorCode } from '../../../shared/errors/app-error-code';
import { AppException } from '../../../shared/errors/app-exception';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import { DEFAULT_CATALOG } from '../default-catalog';
import { CatalogRepository, type CatalogInput } from '../repositories/catalog.repository';

// What the person asking may see: cost is financial data, separate from the price list.
export interface CatalogViewer { canSeeCost: boolean }
const NO_COST: CatalogViewer = { canSeeCost: false };

@Injectable()
export class CatalogManager {
  constructor(private readonly repository: CatalogRepository, private readonly audit: AuditLogService) {}

  async list(viewer: CatalogViewer = NO_COST): Promise<CatalogItemsResponse> {
    return { items: (await this.repository.list()).map((item) => toResponse(item, viewer)) };
  }

  async create(user: AuthenticatedUser, request: CreateCatalogItemRequest, viewer: CatalogViewer = NO_COST): Promise<{ item: CatalogItemResponse }> {
    const input = clean(request, viewer.canSeeCost ? undefined : null);
    if (await this.repository.findByName(input.type, input.name)) throw duplicate();
    await this.checkSupplier(input.supplierId);
    const created = await this.repository.create(user.tenantId, input);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'catalog.item_created', entity: 'catalog_item', entityId: created.id, metadata: { itemAction: 'create', amountCents: created.unitPriceCents } });
    return { item: toResponse(created, viewer) };
  }

  async update(user: AuthenticatedUser, request: UpdateCatalogItemRequest, viewer: CatalogViewer = NO_COST): Promise<{ item: CatalogItemResponse }> {
    const previous = await this.repository.byId(request.id);
    if (!previous) throw notFound();
    // Without access to cost, the stored cost is kept as it was.
    const input = clean(request, viewer.canSeeCost ? undefined : previous.costCents);
    const same = await this.repository.findByName(input.type, input.name);
    if (same && same.id !== request.id) throw duplicate();
    await this.checkSupplier(input.supplierId);
    const updated = await this.repository.update(request.id, input);
    // Who changed a price, and from how much to how much, is worth keeping: it ends up in every quote.
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'catalog.item_updated', entity: 'catalog_item', entityId: updated.id, metadata: { itemAction: 'update', previousAmountCents: previous.unitPriceCents, amountCents: updated.unitPriceCents } });
    return { item: toResponse(updated, viewer) };
  }

  async remove(user: AuthenticatedUser, id: string): Promise<{ success: true }> {
    if (!(await this.repository.byId(id))) throw notFound();
    await this.repository.remove(id);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'catalog.item_deleted', entity: 'catalog_item', entityId: id, metadata: {} });
    return { success: true };
  }

  // Idempotente: só cria o que a oficina ainda não tem (mesmo tipo e nome).
  async seedDefaults(user: AuthenticatedUser, viewer: CatalogViewer = NO_COST): Promise<SeedCatalogResponse> {
    const existing = new Set((await this.repository.list()).map((item) => `${item.type}:${item.name.toLowerCase()}`));
    const missing = DEFAULT_CATALOG.filter((item) => !existing.has(`${item.type}:${item.name.toLowerCase()}`)).map((item) => ({ ...item, careServiceKey: item.careServiceKey ?? null, unitPriceCents: 0 }));
    if (missing.length) await this.repository.createMany(user.tenantId, missing);
    return { created: missing.length, items: (await this.repository.list()).map((item) => toResponse(item, viewer)) };
  }

  async adjustStock(user: AuthenticatedUser, request: AdjustStockRequest, viewer: CatalogViewer = NO_COST): Promise<{ item: CatalogItemResponse }> {
    const item = await this.repository.byId(request.id);
    if (!item) throw notFound();
    if (!item.trackStock) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Ative o controle de estoque deste item antes de lançar movimentos.', HttpStatus.BAD_REQUEST);
    if (request.kind === 'PURCHASE' && request.quantity <= 0) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Informe uma quantidade maior que zero para a entrada.', HttpStatus.BAD_REQUEST);
    const updated = await this.repository.adjustStock(user.tenantId, request.id, user.userId, request.kind, request.quantity, request.note?.trim() || null);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'catalog.stock_adjusted', entity: 'catalog_item', entityId: updated.id, metadata: { itemAction: 'update' } });
    return { item: toResponse(updated, viewer) };
  }

  // Spreadsheet import: matches on type + name. New items are created; existing ones take the
  // price (and cost, for finance viewers) and whatever identification the sheet carries.
  async importRows(user: AuthenticatedUser, request: ImportCatalogRequest, viewer: CatalogViewer = NO_COST): Promise<ImportCatalogResponse> {
    const byKey = new Map<string, ImportCatalogRequest['rows'][number]>();
    for (const row of request.rows) byKey.set(`${row.type}:${row.name.trim().toLowerCase()}`, { ...row, name: row.name.trim() });
    const existing = new Map((await this.repository.list()).map((item) => [`${item.type}:${item.name.toLowerCase()}`, item]));
    const create: CatalogInput[] = [];
    const update: Array<{ id: string; data: Partial<CatalogInput> }> = [];
    for (const [key, row] of byKey) {
      const found = existing.get(key);
      if (!found) { create.push(clean(row, viewer.canSeeCost ? undefined : null)); continue; }
      update.push({ id: found.id, data: {
        unitPriceCents: row.unitPriceCents,
        ...(viewer.canSeeCost && row.costCents != null ? { costCents: row.costCents } : {}),
        ...(row.category?.trim() ? { category: row.category.trim() } : {}),
        ...(row.code?.trim() ? { code: row.code.trim() } : {}),
        ...(row.brand?.trim() ? { brand: row.brand.trim() } : {}),
        ...(row.unit ? { unit: row.unit } : {}),
      } });
    }
    await this.repository.importRows(user.tenantId, create, update);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'catalog.imported', entity: 'catalog_item', entityId: user.tenantId, metadata: { itemAction: 'create' } });
    return { created: create.length, updated: update.length };
  }

  async listPackages(): Promise<CatalogPackagesResponse> {
    const packages = await this.repository.listPackages();
    const lines = packages.length ? await this.repository.packageLines(packages.map((pack) => pack.id)) : [];
    return { packages: packages.map((pack) => toPackage(pack, lines)) };
  }

  async savePackage(user: AuthenticatedUser, request: SaveCatalogPackageRequest): Promise<{ package: CatalogPackageResponse }> {
    const name = request.name.trim();
    if (request.id && !(await this.repository.packageById(request.id))) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Pacote não encontrado.', HttpStatus.NOT_FOUND);
    const same = await this.repository.packageByName(name);
    if (same && same.id !== request.id) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Já existe um pacote com este nome.', HttpStatus.BAD_REQUEST);
    // The same item twice becomes one line with the quantities added.
    const merged = new Map<string, number>();
    for (const line of request.items) merged.set(line.catalogItemId, Math.round(((merged.get(line.catalogItemId) ?? 0) + line.quantity) * 100) / 100);
    const known = await this.repository.existingItemIds([...merged.keys()]);
    if ([...merged.keys()].some((id) => !known.has(id))) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Algum item do pacote não existe mais no catálogo.', HttpStatus.BAD_REQUEST);
    const items = [...merged].map(([catalogItemId, quantity]) => ({ catalogItemId, quantity }));
    const saved = await this.repository.savePackage(user.tenantId, request.id, name, items);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: request.id ? 'catalog.package_updated' : 'catalog.package_created', entity: 'catalog_package', entityId: saved.id, metadata: { itemAction: request.id ? 'update' : 'create' } });
    return { package: { id: saved.id, name: saved.name, items } };
  }

  async removePackage(user: AuthenticatedUser, id: string): Promise<{ success: true }> {
    if (!(await this.repository.packageById(id))) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Pacote não encontrado.', HttpStatus.NOT_FOUND);
    await this.repository.removePackage(id);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'catalog.package_deleted', entity: 'catalog_package', entityId: id, metadata: { itemAction: 'delete' } });
    return { success: true };
  }

  // Best sellers and margin over delivered orders (line value before the order discount).
  async report(user: AuthenticatedUser, days: number, viewer: CatalogViewer = NO_COST, now = new Date()): Promise<CatalogReportResponse> {
    const lines = await this.repository.reportLines(user.tenantId, new Date(now.getTime() - days * 86_400_000));
    const groups = new Map<string, CatalogReportRow & { orderIds: Set<string>; costKnown: boolean; cost: number }>();
    for (const line of lines) {
      const key = line.catalogItemId ?? `${line.type}:${line.description.trim().toLowerCase()}`;
      const quantity = Number(line.quantity);
      const group = groups.get(key) ?? { key, catalogItemId: line.catalogItemId ?? undefined, type: line.type as CatalogReportRow['type'], name: line.description, quantity: 0, orders: 0, revenueCents: 0, orderIds: new Set<string>(), costKnown: true, cost: 0 };
      group.quantity = Math.round((group.quantity + quantity) * 100) / 100;
      group.revenueCents += Math.round(quantity * line.unitPriceCents);
      group.orderIds.add(line.serviceOrderId);
      if (line.costCents === null) group.costKnown = false; else group.cost += Math.round(quantity * line.costCents);
      groups.set(key, group);
    }
    const rows = [...groups.values()].map(({ orderIds, costKnown, cost, ...row }) => ({
      ...row, orders: orderIds.size,
      ...(viewer.canSeeCost && costKnown ? { costCents: cost, marginCents: row.revenueCents - cost } : {}),
    })).sort((a, b) => b.revenueCents - a.revenueCents);
    return { days, rows };
  }

  private async checkSupplier(supplierId: string | null) {
    if (supplierId && !(await this.repository.supplierExists(supplierId))) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Fornecedor não encontrado.', HttpStatus.BAD_REQUEST);
    }
  }
}

// `cost`: undefined = take it from the request, anything else overrides it (null when the user may not set it).
function clean(request: CreateCatalogItemRequest, cost?: number | null): CatalogInput {
  const service = request.type === 'LABOR';
  return {
    type: request.type, name: request.name.trim(), category: request.category?.trim() || null, unitPriceCents: request.unitPriceCents,
    costCents: cost === undefined ? request.costCents ?? null : cost,
    code: request.code?.trim() || null, brand: request.brand?.trim() || null, unit: request.unit ?? (service ? 'h' : 'un'),
    supplierId: service ? null : request.supplierId ?? null,
    // Time and the care a service schedules only make sense for services.
    standardMinutes: service ? request.standardMinutes ?? null : null,
    careServiceKey: service ? request.careServiceKey ?? null : null,
    // Services have no shelf: stock control is for parts and products.
    trackStock: service ? false : request.trackStock ?? false,
    minStock: !service && request.trackStock ? request.minStock ?? null : null,
  };
}
function toResponse(item: CatalogItem, viewer: CatalogViewer): CatalogItemResponse {
  return {
    id: item.id, type: item.type as CatalogItemResponse['type'], name: item.name, category: item.category ?? undefined, unitPriceCents: item.unitPriceCents,
    ...(viewer.canSeeCost && item.costCents !== null ? { costCents: item.costCents } : {}),
    code: item.code ?? undefined, brand: item.brand ?? undefined, unit: item.unit as CatalogUnit,
    supplierId: item.supplierId ?? undefined, standardMinutes: item.standardMinutes ?? undefined,
    careServiceKey: (item.careServiceKey ?? undefined) as CatalogItemResponse['careServiceKey'],
    trackStock: item.trackStock, stockQuantity: Number(item.stockQuantity), minStock: item.minStock === null ? undefined : Number(item.minStock),
  };
}
function toPackage(pack: { id: string; name: string }, lines: Array<{ packageId: string; catalogItemId: string; quantity: unknown }>): CatalogPackageResponse {
  return { id: pack.id, name: pack.name, items: lines.filter((line) => line.packageId === pack.id).map((line) => ({ catalogItemId: line.catalogItemId, quantity: Number(line.quantity) })) };
}
const duplicate = () => new AppException(AppErrorCode.VALIDATION_ERROR, 'Já existe um item com este nome e tipo no catálogo.', HttpStatus.BAD_REQUEST);
const notFound = () => new AppException(AppErrorCode.VALIDATION_ERROR, 'Item do catálogo não encontrado.', HttpStatus.NOT_FOUND);
