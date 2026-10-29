import type { CatalogItemType } from '../response/catalog.response';

export interface CreateCatalogItemRequest {
  type: CatalogItemType;
  name: string;
  category?: string;
  unitPriceCents: number;
}
export interface UpdateCatalogItemRequest extends CreateCatalogItemRequest { id: string }
export interface DeleteCatalogItemRequest { id: string }
