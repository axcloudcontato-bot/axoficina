export const SERVICE_ORDER_ITEM_TYPES = ['PART', 'PRODUCT', 'LABOR'] as const;

export type ServiceOrderItemType = (typeof SERVICE_ORDER_ITEM_TYPES)[number];

// Rótulos de telas, impressão e mensagens. Só LABOR conta como serviço;
// peça e produto somam como material.
export const SERVICE_ORDER_ITEM_TYPE_LABELS: Record<ServiceOrderItemType, string> = {
  PART: 'Peça',
  PRODUCT: 'Produto',
  LABOR: 'Mão de obra',
};

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
