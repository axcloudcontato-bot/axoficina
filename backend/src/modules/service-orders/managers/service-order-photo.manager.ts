import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ServiceOrderPhotoResponse, UploadServiceOrderPhotoRequest } from '@oficina/contracts';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import { ServiceOrderRepository } from '../repositories/service-order.repository';
import { ServiceOrderItemRepository } from '../repositories/service-order-item.repository';
import { ServiceOrderPhotoRepository } from '../repositories/service-order-photo.repository';
import { ServiceOrderPhotoStorageService } from '../services/service-order-photo-storage.service';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ANGLE_CATEGORIES = new Set(['ENTRY', 'EXIT']);
const ITEM_CATEGORIES = new Set(['ISSUE', 'RESOLVED']);

@Injectable()
export class ServiceOrderPhotoManager {
  constructor(
    private readonly orders: ServiceOrderRepository,
    private readonly items: ServiceOrderItemRepository,
    private readonly photos: ServiceOrderPhotoRepository,
    private readonly storage: ServiceOrderPhotoStorageService,
    private readonly audit: AuditLogService,
  ) {}

  async list(serviceOrderId: string): Promise<{ photos: ServiceOrderPhotoResponse[] }> {
    await this.requireOrder(serviceOrderId);
    return { photos: (await this.photos.list(serviceOrderId)).map(mapPhoto) };
  }

  async upload(user: AuthenticatedUser, input: UploadServiceOrderPhotoRequest, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Selecione uma foto.');
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) throw new BadRequestException('A foto deve ser JPEG, PNG ou WebP.');
    if (!hasValidSignature(file.mimetype, file.buffer)) throw new BadRequestException('O conteúdo do arquivo não corresponde a uma imagem válida.');
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException('A foto deve ter no máximo 8 MiB.');
    await this.requireOrder(input.serviceOrderId);

    // "Não pode ser qualquer foto" (spec fotos-os.md): ENTRY/EXIT seguem o
    // padrão fixo de ângulo, ISSUE/RESOLVED ficam amarradas a um item real
    // desta OS — nunca uma foto solta sem contexto.
    if (ANGLE_CATEGORIES.has(input.category)) {
      if (!input.angle) throw new BadRequestException('Selecione o ângulo da foto (frente, traseira, lateral, estepe ou painel).');
      if (input.serviceOrderItemId) throw new BadRequestException('Fotos de entrada/saída não são vinculadas a um item.');
    } else if (ITEM_CATEGORIES.has(input.category)) {
      if (!input.serviceOrderItemId) throw new BadRequestException('Selecione a peça ou serviço que esta foto documenta.');
      if (input.angle) throw new BadRequestException('Fotos de item não usam ângulo.');
      const item = await this.items.byId(input.serviceOrderItemId);
      if (!item || item.serviceOrderId !== input.serviceOrderId) throw new BadRequestException('Item não encontrado nesta ordem de serviço.');
    }

    const storageKey = await this.storage.save(user.tenantId, input.serviceOrderId, file);
    try {
      const photo = await this.photos.insert({
        tenantId: user.tenantId,
        serviceOrderId: input.serviceOrderId,
        category: input.category,
        angle: input.angle,
        serviceOrderItemId: input.serviceOrderItemId,
        caption: input.caption?.trim() || undefined,
        storageKey,
        originalName: file.originalname.slice(0, 250),
        mimeType: file.mimetype,
        sizeBytes: file.size,
      });
      await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'service_order.photo_added', entity: 'service_order', entityId: input.serviceOrderId, metadata: { photoId: photo.id, category: input.category } });
      return { photo: mapPhoto(photo) };
    } catch (error) {
      await this.storage.delete(storageKey);
      throw error;
    }
  }

  async content(id: string) {
    const photo = await this.photos.byId(id);
    if (!photo) throw new NotFoundException('Foto não encontrada.');
    await this.requireOrder(photo.serviceOrderId);
    return { buffer: await this.storage.read(photo.storageKey), mimeType: photo.mimeType, originalName: photo.originalName };
  }

  async delete(user: AuthenticatedUser, id: string) {
    const photo = await this.photos.byId(id);
    if (!photo) throw new NotFoundException('Foto não encontrada.');
    await this.requireOrder(photo.serviceOrderId);
    const result = await this.photos.softDelete(id);
    if (result.count === 0) throw new NotFoundException('Foto não encontrada.');
    await this.storage.delete(photo.storageKey);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'service_order.photo_deleted', entity: 'service_order', entityId: photo.serviceOrderId, metadata: { photoId: id } });
    return { success: true as const };
  }

  private async requireOrder(id: string) {
    const order = await this.orders.byId(id);
    if (!order) throw new NotFoundException('Ordem de serviço não encontrada.');
    return order;
  }
}

function mapPhoto(photo: {
  id: string;
  serviceOrderId: string;
  category: string;
  angle: string | null;
  serviceOrderItemId: string | null;
  caption: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}): ServiceOrderPhotoResponse {
  return {
    id: photo.id,
    serviceOrderId: photo.serviceOrderId,
    category: photo.category as ServiceOrderPhotoResponse['category'],
    angle: (photo.angle as ServiceOrderPhotoResponse['angle']) ?? undefined,
    serviceOrderItemId: photo.serviceOrderItemId ?? undefined,
    caption: photo.caption ?? undefined,
    originalName: photo.originalName,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    createdAt: photo.createdAt.toISOString(),
  };
}

function hasValidSignature(mimeType: string, buffer: Buffer): boolean {
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}
