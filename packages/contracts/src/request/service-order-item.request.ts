import type { ServiceOrderItemType } from '../response/service-order-item.response';
import type { CareServiceKey } from '../customer-care';

export interface CreateServiceOrderItemRequest {
  careServiceKey?: CareServiceKey;
  serviceOrderId: string;
  type: ServiceOrderItemType;
  description: string;
  quantity: number;
  unitPriceCents: number;
  // Required when the order is already delivered or cancelled.
  editReason?: string;
}

export interface UpdateServiceOrderItemRequest {
  careServiceKey?: CareServiceKey | null;
  id: string;
  type?: ServiceOrderItemType;
  description?: string;
  quantity?: number;
  unitPriceCents?: number;
  editReason?: string;
}

export interface DeleteServiceOrderItemRequest {
  id: string;
  editReason?: string;
}
