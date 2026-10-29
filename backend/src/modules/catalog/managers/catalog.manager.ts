import { HttpStatus, Injectable } from '@nestjs/common';
import type { CatalogItemResponse, CatalogItemsResponse, CreateCatalogItemRequest, SeedCatalogResponse, UpdateCatalogItemRequest } from '@oficina/contracts';
import { AppErrorCode } from '../../../shared/errors/app-error-code';
import { AppException } from '../../../shared/errors/app-exception';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import { DEFAULT_CATALOG } from '../default-catalog';
import { CatalogRepository } from '../repositories/catalog.repository';

@Injectable()
export class CatalogManager {
  constructor(private readonly repository: CatalogRepository, private readonly audit: AuditLogService) {}

  async list(): Promise<CatalogItemsResponse> {
    return { items: (await this.repository.list()).map(toResponse) };
  }

  async create(user: AuthenticatedUser, request: CreateCatalogItemRequest): Promise<{ item: CatalogItemResponse }> {
    const input = clean(request);
    if (await this.repository.findByName(input.type, input.name)) throw duplicate();
    return { item: toResponse(await this.repository.create(user.tenantId, input)) };
  }

  async update(_user: AuthenticatedUser, request: UpdateCatalogItemRequest): Promise<{ item: CatalogItemResponse }> {
    if (!(await this.repository.byId(request.id))) throw notFound();
    const input = clean(request);
    const same = await this.repository.findByName(input.type, input.name);
    if (same && same.id !== request.id) throw duplicate();
    return { item: toResponse(await this.repository.update(request.id, input)) };
  }

  async remove(user: AuthenticatedUser, id: string): Promise<{ success: true }> {
    if (!(await this.repository.byId(id))) throw notFound();
    await this.repository.remove(id);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'catalog.item_deleted', entity: 'catalog_item', entityId: id, metadata: {} });
    return { success: true };
  }

  // Idempotente: só cria o que a oficina ainda não tem (mesmo tipo e nome).
  async seedDefaults(user: AuthenticatedUser): Promise<SeedCatalogResponse> {
    const existing = new Set((await this.repository.list()).map((item) => `${item.type}:${item.name.toLowerCase()}`));
    const missing = DEFAULT_CATALOG.filter((item) => !existing.has(`${item.type}:${item.name.toLowerCase()}`)).map((item) => ({ ...item, unitPriceCents: 0 }));
    if (missing.length) await this.repository.createMany(user.tenantId, missing);
    return { created: missing.length, items: (await this.repository.list()).map(toResponse) };
  }
}

function clean(request: CreateCatalogItemRequest) {
  return { type: request.type, name: request.name.trim(), category: request.category?.trim() || null, unitPriceCents: request.unitPriceCents };
}
function toResponse(item: { id: string; type: string; name: string; category: string | null; unitPriceCents: number }): CatalogItemResponse {
  return { id: item.id, type: item.type as CatalogItemResponse['type'], name: item.name, category: item.category ?? undefined, unitPriceCents: item.unitPriceCents };
}
const duplicate = () => new AppException(AppErrorCode.VALIDATION_ERROR, 'Já existe um item com este nome e tipo no catálogo.', HttpStatus.BAD_REQUEST);
const notFound = () => new AppException(AppErrorCode.VALIDATION_ERROR, 'Item do catálogo não encontrado.', HttpStatus.NOT_FOUND);
