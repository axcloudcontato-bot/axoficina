import type { CareServiceKey } from '../customer-care';

export const CATALOG_ITEM_TYPES = ['PART', 'PRODUCT', 'LABOR'] as const;
export type CatalogItemType = (typeof CATALOG_ITEM_TYPES)[number];

// No catálogo, LABOR aparece como "Serviço".
export const CATALOG_ITEM_TYPE_LABELS: Record<CatalogItemType, string> = {
  PART: 'Peça',
  PRODUCT: 'Produto',
  LABOR: 'Serviço',
};

export const CATALOG_UNITS = ['un', 'par', 'jogo', 'kit', 'L', 'kg', 'm', 'h'] as const;
export type CatalogUnit = (typeof CATALOG_UNITS)[number];

export interface CatalogItemResponse {
  id: string;
  type: CatalogItemType;
  name: string;
  category?: string;
  unitPriceCents: number;
  // Only sent to people allowed to see financial data.
  costCents?: number;
  code?: string;
  brand?: string;
  unit: CatalogUnit;
  supplierId?: string;
  // Services only.
  standardMinutes?: number;
  careServiceKey?: CareServiceKey;
}

export interface CatalogItemsResponse { items: CatalogItemResponse[] }
export interface SeedCatalogResponse { created: number; items: CatalogItemResponse[] }
