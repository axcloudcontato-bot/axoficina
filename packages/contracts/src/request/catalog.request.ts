import type { CareServiceKey } from '../customer-care';
import type { CatalogItemType, CatalogUnit } from '../response/catalog.response';

export interface CreateCatalogItemRequest {
  type: CatalogItemType;
  name: string;
  category?: string;
  unitPriceCents: number;
  // Ignored unless the user may see financial data.
  costCents?: number | null;
  code?: string;
  brand?: string;
  unit?: CatalogUnit;
  supplierId?: string | null;
  // Services only: time a job usually takes, and the care it schedules for the customer.
  standardMinutes?: number | null;
  careServiceKey?: CareServiceKey | null;
  // Parts and products only.
  trackStock?: boolean;
  minStock?: number | null;
}
export interface UpdateCatalogItemRequest extends CreateCatalogItemRequest { id: string }
export interface DeleteCatalogItemRequest { id: string }

// PURCHASE adds to the balance; ADJUSTMENT sets it to the counted quantity.
export interface AdjustStockRequest { id: string; kind: 'PURCHASE' | 'ADJUSTMENT'; quantity: number; note?: string }

export interface ImportCatalogRow {
  type: CatalogItemType;
  name: string;
  category?: string;
  unitPriceCents: number;
  costCents?: number | null;
  code?: string;
  brand?: string;
  unit?: CatalogUnit;
}
export interface ImportCatalogRequest { rows: ImportCatalogRow[] }

export interface SaveCatalogPackageRequest { id?: string; name: string; items: Array<{ catalogItemId: string; quantity: number }> }
export interface DeleteCatalogPackageRequest { id: string }
