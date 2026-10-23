import type { ServiceOrderPhotoAngle, ServiceOrderPhotoCategory } from '../response/service-order-photo.response';

export interface UploadServiceOrderPhotoRequest {
  serviceOrderId: string;
  category: ServiceOrderPhotoCategory;
  /** Obrigatório pra category ENTRY/EXIT; não aceito pra ISSUE/RESOLVED. */
  angle?: ServiceOrderPhotoAngle;
  /** Obrigatório pra category ISSUE/RESOLVED; não aceito pra ENTRY/EXIT. */
  serviceOrderItemId?: string;
  caption?: string;
}

export interface DeleteServiceOrderPhotoRequest {
  id: string;
}
