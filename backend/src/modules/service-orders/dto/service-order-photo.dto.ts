import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SERVICE_ORDER_PHOTO_ANGLES, SERVICE_ORDER_PHOTO_CATEGORIES, type ServiceOrderPhotoAngle, type ServiceOrderPhotoCategory } from '@oficina/contracts';

export class ListServiceOrderPhotosDto {
  @IsUUID() serviceOrderId!: string;
}

export class GetServiceOrderPhotoDto {
  @IsUUID() id!: string;
}

export class UploadServiceOrderPhotoDto {
  @IsUUID() serviceOrderId!: string;
  @IsIn(SERVICE_ORDER_PHOTO_CATEGORIES) category!: ServiceOrderPhotoCategory;
  // A exigência cruzada (angle obrigatório só em ENTRY/EXIT, item só em
  // ISSUE/RESOLVED) é validada em ServiceOrderPhotoManager.upload — não dá
  // pra expressar "obrigatório condicional ao valor de outro campo" só com
  // decorators sem um validator customizado, e o manager já centraliza as
  // outras regras de negócio do upload (tipo/assinatura/tamanho do arquivo).
  @IsOptional() @IsIn(SERVICE_ORDER_PHOTO_ANGLES) angle?: ServiceOrderPhotoAngle;
  @IsOptional() @IsUUID() serviceOrderItemId?: string;
  @IsOptional() @IsString() @MaxLength(300) caption?: string;
}

export class DeleteServiceOrderPhotoDto {
  @IsUUID() id!: string;
}
