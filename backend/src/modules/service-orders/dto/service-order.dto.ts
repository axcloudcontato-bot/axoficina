import { IsIn, IsInt, IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { PAYMENT_METHODS, SERVICE_ORDER_STATUSES } from '@oficina/contracts';
import type {
  CreateServiceOrderRequest,
  DeleteServiceOrderRequest,
  ServiceOrderListRequest,
  TechnicianProductivityRequest,
  TransitionServiceOrderRequest,
  UpdateServiceOrderRequest,
} from '@oficina/contracts';

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 100;

export class CreateServiceOrderDto implements CreateServiceOrderRequest {
  @IsUUID('4', { message: 'vehicle_id must be a valid id' })
  vehicleId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'technician_id must be a valid id' })
  technicianId?: string;

  @IsOptional()
  @IsObject({ message: 'checklist must be a valid JSON object' })
  checklist?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional() @IsInt() @Min(0) entryMileage?: number | null;
  @IsOptional() @IsString() customerComplaint?: string | null;
  @IsOptional() @IsString() receptionNotes?: string | null;
  @IsOptional() @IsString() recommendedService?: string | null;
  @IsOptional() @IsISO8601() expectedDeliveryAt?: string | null;
  @IsOptional() @IsIn(PAYMENT_METHODS) paymentMethod?: CreateServiceOrderRequest['paymentMethod'];
  @IsOptional() @IsInt() @Min(1) @Max(24) paymentInstallments?: number | null;
}

export class UpdateServiceOrderDto implements UpdateServiceOrderRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;

  @IsOptional()
  @IsUUID('4', { message: 'technician_id must be a valid id' })
  technicianId?: string;

  @IsOptional()
  @IsObject({ message: 'checklist must be a valid JSON object' })
  checklist?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional() @IsInt() @Min(0) entryMileage?: number | null;
  @IsOptional() @IsString() customerComplaint?: string | null;
  @IsOptional() @IsString() receptionNotes?: string | null;
  @IsOptional() @IsString() recommendedService?: string | null;
  @IsOptional() @IsISO8601() expectedDeliveryAt?: string | null;
  @IsOptional() @IsIn(PAYMENT_METHODS) paymentMethod?: UpdateServiceOrderRequest['paymentMethod'];
  @IsOptional() @IsInt() @Min(1) @Max(24) paymentInstallments?: number | null;
}

export class TransitionServiceOrderDto implements TransitionServiceOrderRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;

  @IsIn(SERVICE_ORDER_STATUSES, { message: 'to_status must be a valid status' })
  toStatus!: TransitionServiceOrderRequest['toStatus'];
}

export class DeleteServiceOrderDto implements DeleteServiceOrderRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;
}

export class GetServiceOrderDto {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;
}

export class ServiceOrderListDto implements ServiceOrderListRequest {
  @IsOptional()
  @IsIn(SERVICE_ORDER_STATUSES, { message: 'status must be a valid status' })
  status?: ServiceOrderListRequest['status'];

  @IsOptional()
  @IsUUID('4', { message: 'vehicle_id must be a valid id' })
  vehicleId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'technician_id must be a valid id' })
  technicianId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'customer_id must be a valid id' })
  customerId?: string;

  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit: number = DEFAULT_LIST_LIMIT;
}

export class TechnicianProductivityDto implements TechnicianProductivityRequest {
  @IsISO8601() startAt!: string;
  @IsISO8601() endAt!: string;
}
