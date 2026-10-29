import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { MAINTENANCE_ALERT_CONTACT_OUTCOMES, MAINTENANCE_ALERT_DISMISS_REASONS, MAINTENANCE_ALERT_FILTERS, MAINTENANCE_ALERT_SNOOZE_DAYS } from '@oficina/contracts';
import type { DismissMaintenanceAlertRequest, MaintenanceAlertContactsRequest, MaintenanceAlertListRequest, RecordMaintenanceAlertContactRequest, ReopenMaintenanceAlertRequest, ResolveMaintenanceAlertRequest, SnoozeMaintenanceAlertRequest } from '@oficina/contracts';

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 20;

export class MaintenanceAlertListDto implements MaintenanceAlertListRequest {
  @IsOptional()
  @IsIn(MAINTENANCE_ALERT_FILTERS, { message: 'status must be a valid status' })
  status?: MaintenanceAlertListRequest['status'];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  minMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  maxMonths?: number;

  @IsOptional()
  @IsIn(['NEVER', 'CONTACTED'])
  contact?: MaintenanceAlertListRequest['contact'];

  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit: number = DEFAULT_LIST_LIMIT;
}

export class ResolveMaintenanceAlertDto implements ResolveMaintenanceAlertRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;
}

export class SnoozeMaintenanceAlertDto implements SnoozeMaintenanceAlertRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;

  @IsIn(MAINTENANCE_ALERT_SNOOZE_DAYS, { message: 'days must be 30, 60 or 90' })
  days!: SnoozeMaintenanceAlertRequest['days'];
}

export class DismissMaintenanceAlertDto implements DismissMaintenanceAlertRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;

  @IsIn(MAINTENANCE_ALERT_DISMISS_REASONS, { message: 'reason must be a valid reason' })
  reason!: DismissMaintenanceAlertRequest['reason'];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class ReopenMaintenanceAlertDto implements ReopenMaintenanceAlertRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;
}

export class RecordMaintenanceAlertContactDto implements RecordMaintenanceAlertContactRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;

  @IsIn(MAINTENANCE_ALERT_CONTACT_OUTCOMES, { message: 'outcome must be a valid outcome' })
  outcome!: RecordMaintenanceAlertContactRequest['outcome'];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class MaintenanceAlertContactsDto implements MaintenanceAlertContactsRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;
}
