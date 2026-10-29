export const CATALOG_ITEM_TYPES = ['PART', 'PRODUCT', 'LABOR'] as const;
export type CatalogItemType = (typeof CATALOG_ITEM_TYPES)[number];

// No catálogo, LABOR aparece como "Serviço".
export const CATALOG_ITEM_TYPE_LABELS: Record<CatalogItemType, string> = {
  PART: 'Peça',
  PRODUCT: 'Produto',
  LABOR: 'Serviço',
};

export interface CatalogItemResponse {
  id: string;
  type: CatalogItemType;
  name: string;
  category?: string;
  unitPriceCents: number;
}

export interface CatalogItemsResponse { items: CatalogItemResponse[] }
export interface SeedCatalogResponse { created: number; items: CatalogItemResponse[] }
