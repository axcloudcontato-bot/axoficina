import { HttpStatus, Injectable } from '@nestjs/common';
import type { CatalogItemResponse, CatalogItemsResponse, CatalogUnit, CreateCatalogItemRequest, SeedCatalogResponse, UpdateCatalogItemRequest } from '@oficina/contracts';
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
  };
}
function toResponse(item: CatalogItem, viewer: CatalogViewer): CatalogItemResponse {
  return {
    id: item.id, type: item.type as CatalogItemResponse['type'], name: item.name, category: item.category ?? undefined, unitPriceCents: item.unitPriceCents,
    ...(viewer.canSeeCost && item.costCents !== null ? { costCents: item.costCents } : {}),
    code: item.code ?? undefined, brand: item.brand ?? undefined, unit: item.unit as CatalogUnit,
    supplierId: item.supplierId ?? undefined, standardMinutes: item.standardMinutes ?? undefined,
    careServiceKey: (item.careServiceKey ?? undefined) as CatalogItemResponse['careServiceKey'],
  };
}
const duplicate = () => new AppException(AppErrorCode.VALIDATION_ERROR, 'Já existe um item com este nome e tipo no catálogo.', HttpStatus.BAD_REQUEST);
const notFound = () => new AppException(AppErrorCode.VALIDATION_ERROR, 'Item do catálogo não encontrado.', HttpStatus.NOT_FOUND);
