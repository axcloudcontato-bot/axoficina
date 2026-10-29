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
  // Parts and products only. The balance and minimum are meaningful when trackStock is on.
  trackStock: boolean;
  stockQuantity: number;
  minStock?: number;
}

export interface CatalogItemsResponse { items: CatalogItemResponse[] }
export interface SeedCatalogResponse { created: number; items: CatalogItemResponse[] }

export interface CatalogPackageLine { catalogItemId: string; quantity: number }
export interface CatalogPackageResponse { id: string; name: string; items: CatalogPackageLine[] }
export interface CatalogPackagesResponse { packages: CatalogPackageResponse[] }

export interface ImportCatalogResponse { created: number; updated: number }

export const CATALOG_REPORT_DAYS = [30, 90, 180, 365] as const;
export interface CatalogReportRow {
  // The catalog entry, or the typed description for lines that were never linked to one.
  key: string;
  catalogItemId?: string;
  type: CatalogItemType;
  name: string;
  quantity: number;
  orders: number;
  revenueCents: number;
  // Only for people allowed to see financial data, and only when every sold unit had a known cost.
  costCents?: number;
  marginCents?: number;
}
export interface CatalogReportResponse { days: number; rows: CatalogReportRow[] }
