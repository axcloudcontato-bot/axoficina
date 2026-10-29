import { IsBoolean, IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { APPOINTMENT_STATUSES } from '@oficina/contracts';
import type {
  AppointmentListRequest,
  CreateAppointmentRequest,
  NotifyAppointmentRequest,
  StartAppointmentRequest,
  TransitionAppointmentRequest,
  UpdateAppointmentRequest,
} from '@oficina/contracts';

export class CreateAppointmentDto implements CreateAppointmentRequest {
  @IsUUID('4') customerId!: string;
  @IsUUID('4') vehicleId!: string;
  @IsOptional() @IsUUID('4') technicianId?: string;
  @IsISO8601() startsAt!: string;
  @IsISO8601() endsAt!: string;
  @IsString() @IsNotEmpty() @MaxLength(300) serviceDescription!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsBoolean() confirmConflict?: boolean;
}

export class UpdateAppointmentDto extends CreateAppointmentDto implements UpdateAppointmentRequest {
  @IsUUID('4') id!: string;
}

export class AppointmentListDto implements AppointmentListRequest {
  @IsISO8601() startsAt!: string;
  @IsISO8601() endsAt!: string;
  @IsOptional() @IsUUID('4') technicianId?: string;
  @IsOptional() @IsIn(APPOINTMENT_STATUSES) status?: AppointmentListRequest['status'];
}

export class TransitionAppointmentDto implements TransitionAppointmentRequest {
  @IsUUID('4') id!: string;
  @IsIn(APPOINTMENT_STATUSES) toStatus!: TransitionAppointmentRequest['toStatus'];
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class StartAppointmentDto implements StartAppointmentRequest {
  @IsUUID('4') id!: string;
}

export class NotifyAppointmentDto implements NotifyAppointmentRequest {
  @IsUUID('4') id!: string;
}

export class RetryReminderDto {
  @IsUUID('4') id!: string;
}
