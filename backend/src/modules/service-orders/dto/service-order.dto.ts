import { ValidateIf, IsBoolean, IsIn, IsInt, IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { IDLE_REASONS, PAYMENT_METHODS, SERVICE_ORDER_STATUSES } from '@oficina/contracts';
import type {
  CopyProductivityTargetsRequest,
  ProductivityTrendRequest,
  MarkWarrantyReturnRequest,
  SetCommissionRuleRequest,
  StartIdleRequest,
  IdleReason,
  CorrectWorkSessionRequest,
  CreateServiceOrderRequest,
  DeleteServiceOrderRequest,
  ServiceOrderListRequest,
  TechnicianProductivityRequest,
  TechnicianProductivityOrdersRequest,
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
  @IsOptional() @IsInt() @Min(0) @Max(2_147_483_647) discountCents?: number;
  @IsOptional() @IsInt() @Min(0) @Max(3650) warrantyDays?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(2_147_483_647) exitMileage?: number | null;
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
  @IsOptional() @IsIn(['CUSTOMER_MESSAGE', 'MANUAL'])
  authorization?: TransitionServiceOrderRequest['authorization'];
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;

  @IsIn(SERVICE_ORDER_STATUSES, { message: 'to_status must be a valid status' })
  toStatus!: TransitionServiceOrderRequest['toStatus'];

  @IsOptional() @IsString() @MaxLength(300)
  reason?: string;
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
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @IsOptional() @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @IsOptional() @IsIn(['OPENED', 'CLOSED'])
  dateField?: ServiceOrderListRequest['dateField'];

  @IsOptional() @IsIn(['ACTIVE', 'OVERDUE', 'UNASSIGNED', 'PAYMENT_PENDING'])
  attention?: ServiceOrderListRequest['attention'];

  @IsOptional() @IsBoolean()
  includeMetrics?: boolean;

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

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

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

export class WorkSessionDto {
  @IsUUID('4') serviceOrderId!: string;
}

export class ProductivityTargetDto {
  @IsUUID('4') technicianId!: string;
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month!: string;
  @IsInt() @Min(0) @Max(100000) completedCount!: number;
  @IsInt() @Min(0) @Max(100000000000) laborRevenueCents!: number;
  @IsInt() @Min(0) @Max(1000000) workedMinutes!: number;
}

export class CorrectWorkSessionDto implements CorrectWorkSessionRequest {
  @IsUUID('4') sessionId!: string;
  @IsOptional() @IsISO8601() startedAt?: string;
  @IsOptional() @IsISO8601() endedAt?: string;
  @IsOptional() @IsBoolean() remove?: boolean;
  @IsString() @MaxLength(300) reason!: string;
}

export class MarkWarrantyReturnDto implements MarkWarrantyReturnRequest {
  @IsUUID('4') serviceOrderId!: string;
  @ValidateIf((_object, value) => value !== null) @IsUUID('4') originalOrderId!: string | null;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class SetCommissionRuleDto implements SetCommissionRuleRequest {
  @IsUUID('4') technicianId!: string;
  @IsInt() @Min(0) @Max(10000) laborPercentBp!: number;
  @IsInt() @Min(0) @Max(10000) bonusPercentBp!: number;
}

export class StartIdleDto implements StartIdleRequest {
  @IsIn(IDLE_REASONS) reason!: IdleReason;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class ProductivityTrendDto implements ProductivityTrendRequest {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month!: string;
}

export class CopyProductivityTargetsDto implements CopyProductivityTargetsRequest {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) fromMonth!: string;
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) toMonth!: string;
}

export class TechnicianProductivityOrdersDto implements TechnicianProductivityOrdersRequest {
  @IsISO8601() startAt!: string;
  @IsISO8601() endAt!: string;
  @IsUUID('4') technicianId!: string;
  @IsInt() @Min(0) offset!: number;
  @IsInt() @Min(1) @Max(50) limit!: number;
}

// The browser sends its own calendar day, so "today" follows the workshop clock
// instead of the server's timezone.
export class DashboardTodayDto {
  @IsOptional() @IsISO8601({ strict: true })
  startsAt?: string;

  @IsOptional() @IsISO8601({ strict: true })
  endsAt?: string;
}
