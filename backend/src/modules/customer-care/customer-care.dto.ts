import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { CARE_CAMPAIGN_KEYS, CARE_DELIVERY_FILTERS, CARE_PLAN_FILTERS, CARE_SERVICE_KEYS, MAINTENANCE_ALERT_CONTACT_OUTCOMES, type CareDeliveriesRequest, type CareDeliveryFilter, type CareTestSendRequest, type RecordCarePlanContactRequest, type CareCampaignKey, type CarePlanFilter, type CareServiceKey, type CarePlansRequest, type ResolveCareDeliveryRequest } from '@oficina/contracts';

class CareCampaignDto {
  @IsIn(CARE_CAMPAIGN_KEYS) key!: CareCampaignKey;
  @IsString() @MaxLength(100) name!: string;
  @IsString() @MaxLength(20) emoji!: string;
  @IsString() @MaxLength(300) description!: string;
  @IsBoolean() enabled!: boolean;
  @IsInt() @Min(1) @Max(120) intervalMonths!: number;
  @ValidateIf((_o, v) => v !== null) @IsInt() @Min(500) @Max(200000) intervalKm!: number | null;
  @IsInt() @Min(0) @Max(30) leadDays!: number;
  @IsString() @MinLength(20) @MaxLength(1600) message!: string;
}
export class UpdateCareSettingsDto {
  @IsBoolean() enabled!: boolean;
  @IsIn(['WHATSAPP', 'EMAIL']) channel!: 'WHATSAPP' | 'EMAIL';
  @IsIn(['America/Sao_Paulo', 'America/Manaus', 'America/Recife', 'America/Fortaleza', 'America/Belem', 'America/Cuiaba', 'America/Porto_Velho', 'America/Rio_Branco']) timeZone!: string;
  @IsInt() @Min(8) @Max(17) sendHour!: number;
  @IsBoolean() weekdaysOnly!: boolean;
  @IsInt() @Min(3) @Max(90) minGapDays!: number;
  @IsInt() @Min(1) @Max(500) dailyLimit!: number;
  @IsArray() @ArrayMinSize(13) @ArrayMaxSize(13) @ValidateNested({ each: true }) @Type(() => CareCampaignDto) campaigns!: CareCampaignDto[];
}
export class RecordCareServiceDto {
  @IsUUID('4') vehicleId!: string;
  @IsIn(CARE_SERVICE_KEYS) serviceKey!: CareServiceKey;
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) completedAt!: string;
  @IsOptional() @IsInt() @Min(0) @Max(9999999) mileage?: number;
  @IsOptional() @IsInt() @Min(1) @Max(120) intervalMonths?: number;
  @IsOptional() @IsInt() @Min(500) @Max(200000) intervalKm?: number | null;
}
export class CarePreviewDto {
  @IsIn(CARE_CAMPAIGN_KEYS) campaignKey!: CareCampaignKey;
  @IsOptional() @IsUUID('4') customerId?: string;
  @IsOptional() @IsUUID('4') vehicleId?: string;
  @IsOptional() @IsString() @MinLength(20) @MaxLength(1600) message?: string;
}
export class CareIdDto { @IsUUID('4') id!: string }
export class CareUnsubscribeDto { @IsString() @Matches(/^[a-f0-9]{64}$/) token!: string }
export class ResolveCareDeliveryDto implements ResolveCareDeliveryRequest {
  @IsUUID('4') id!: string;
  @IsIn(['DELIVERED', 'NOT_DELIVERED']) outcome!: ResolveCareDeliveryRequest['outcome'];
}
export class CarePlansDto implements CarePlansRequest {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000000) offset: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 50;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(CARE_PLAN_FILTERS) filter?: CarePlanFilter;
  @IsOptional() @IsIn(['GRANTED', 'NOT_GRANTED']) consent?: CarePlansRequest['consent'];
}
export class RecordCarePlanContactDto implements RecordCarePlanContactRequest {
  @IsUUID('4') id!: string;
  @IsIn(MAINTENANCE_ALERT_CONTACT_OUTCOMES) outcome!: RecordCarePlanContactRequest['outcome'];
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
export class CareDeliveriesDto implements CareDeliveriesRequest {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000000) offset: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 30;
  @IsOptional() @IsIn(CARE_DELIVERY_FILTERS) status?: CareDeliveryFilter;
  @IsOptional() @IsIn(CARE_CAMPAIGN_KEYS) campaignKey?: CareCampaignKey;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
}
export class CareTestSendDto implements CareTestSendRequest {
  @IsIn(CARE_CAMPAIGN_KEYS) campaignKey!: CareCampaignKey;
  @IsOptional() @IsString() @MinLength(20) @MaxLength(1600) message?: string;
  @IsString() @MaxLength(30) phone!: string;
}
