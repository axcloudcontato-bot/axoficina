import type { CatalogItemResponse } from '@oficina/contracts';

// At or below the minimum, or sold down to zero when no minimum was set.
export function isLowStock(item: Pick<CatalogItemResponse, 'trackStock' | 'stockQuantity' | 'minStock'>): boolean {
  if (!item.trackStock) return false;
  return item.stockQuantity <= (item.minStock ?? 0);
}

export const formatStock = (quantity: number) => quantity.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
