export const SERVICE_ORDER_ITEM_TYPES = ['PART', 'LABOR'] as const;

export type ServiceOrderItemType = (typeof SERVICE_ORDER_ITEM_TYPES)[number];

export interface ServiceOrderItemResponse {
  careServiceKey?: CareServiceKey;
  id: string;
  serviceOrderId: string;
  type: ServiceOrderItemType;
  description: string;
  quantity: number;
  unitPriceCents: number;
  // quantity * unitPriceCents — sempre calculado, nunca armazenado (ver
  // plano itens-e-preco-da-os.md).
  lineTotalCents: number;
  createdAt: string;
}
import type { CareServiceKey } from '../customer-care';
