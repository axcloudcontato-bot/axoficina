import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { CARE_SERVICE_KEYS, SERVICE_ORDER_ITEM_TYPES } from '@oficina/contracts';
import type {
  CreateServiceOrderItemRequest,
  DeleteServiceOrderItemRequest,
  UpdateServiceOrderItemRequest,
} from '@oficina/contracts';

const MIN_QUANTITY = 0.01;

export class CreateServiceOrderItemDto implements CreateServiceOrderItemRequest {
  @IsOptional() @IsIn(CARE_SERVICE_KEYS)
  careServiceKey?: CreateServiceOrderItemRequest['careServiceKey'];
  @IsUUID('4', { message: 'service_order_id must be a valid id' })
  serviceOrderId!: string;

  @IsIn(SERVICE_ORDER_ITEM_TYPES, { message: 'type must be PART, PRODUCT or LABOR' })
  type!: CreateServiceOrderItemRequest['type'];

  @IsNotEmpty({ message: 'description is required' })
  description!: string;

  // maxDecimalPlaces: 2 casa a validação com a coluna NUMERIC(10,2) — Edge
  // Case 6 da spec ("quantidade fracionária com muitas casas decimais").
  // Sem isso o front-end poderia enviar 1.239 e só a coluna do banco
  // arredondaria silenciosamente, sem nenhum teste garantindo esse
  // comportamento.
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'quantity must have at most 2 decimal places' })
  @Min(MIN_QUANTITY, { message: 'quantity must be greater than zero' })
  quantity!: number;

  @IsInt({ message: 'unit_price_cents must be an integer' })
  @Min(0, { message: 'unit_price_cents cannot be negative' })
  unitPriceCents!: number;
}

export class UpdateServiceOrderItemDto implements UpdateServiceOrderItemRequest {
  @IsOptional() @IsIn(CARE_SERVICE_KEYS)
  careServiceKey?: UpdateServiceOrderItemRequest['careServiceKey'];
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;

  @IsOptional()
  @IsIn(SERVICE_ORDER_ITEM_TYPES, { message: 'type must be PART, PRODUCT or LABOR' })
  type?: UpdateServiceOrderItemRequest['type'];

  @IsOptional()
  @IsNotEmpty({ message: 'description cannot be empty' })
  description?: string;

  @IsOptional()
  // maxDecimalPlaces: 2 casa a validação com a coluna NUMERIC(10,2) — Edge
  // Case 6 da spec ("quantidade fracionária com muitas casas decimais").
  // Sem isso o front-end poderia enviar 1.239 e só a coluna do banco
  // arredondaria silenciosamente, sem nenhum teste garantindo esse
  // comportamento.
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'quantity must have at most 2 decimal places' })
  @Min(MIN_QUANTITY, { message: 'quantity must be greater than zero' })
  quantity?: number;

  @IsOptional()
  @IsInt({ message: 'unit_price_cents must be an integer' })
  @Min(0, { message: 'unit_price_cents cannot be negative' })
  unitPriceCents?: number;
}

export class DeleteServiceOrderItemDto implements DeleteServiceOrderItemRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;
}
