import type { ServiceOrderItemType } from '../response/service-order-item.response';
import type { CareServiceKey } from '../customer-care';

export interface CreateServiceOrderItemRequest {
  careServiceKey?: CareServiceKey;
  serviceOrderId: string;
  type: ServiceOrderItemType;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface UpdateServiceOrderItemRequest {
  careServiceKey?: CareServiceKey | null;
  id: string;
  type?: ServiceOrderItemType;
  description?: string;
  quantity?: number;
  unitPriceCents?: number;
}

export interface DeleteServiceOrderItemRequest {
  id: string;
}
