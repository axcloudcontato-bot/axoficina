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
}
export interface UpdateCatalogItemRequest extends CreateCatalogItemRequest { id: string }
export interface DeleteCatalogItemRequest { id: string }
