export const SERVICE_ORDER_PHOTO_CATEGORIES = ['ENTRY', 'ISSUE', 'RESOLVED', 'EXIT'] as const;
export type ServiceOrderPhotoCategory = (typeof SERVICE_ORDER_PHOTO_CATEGORIES)[number];

// Padrão fixo: as mesmas 6 fotos na entrada e na saída do veículo, pra dar
// pra comparar direto o antes/depois. Só usado em ENTRY/EXIT.
export const SERVICE_ORDER_PHOTO_ANGLES = ['FRONT', 'REAR', 'LEFT_SIDE', 'RIGHT_SIDE', 'SPARE_TIRE', 'DASHBOARD'] as const;
export type ServiceOrderPhotoAngle = (typeof SERVICE_ORDER_PHOTO_ANGLES)[number];

export interface ServiceOrderPhotoResponse {
  id: string;
  serviceOrderId: string;
  category: ServiceOrderPhotoCategory;
  /** Só presente pra category ENTRY/EXIT. */
  angle?: ServiceOrderPhotoAngle;
  /** Só presente pra category ISSUE/RESOLVED — a peça/serviço que esta foto documenta. */
  serviceOrderItemId?: string;
  caption?: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}
