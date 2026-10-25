import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { BILLING_CYCLES, SUBSCRIPTION_STATUSES } from '@oficina/contracts';
import type { BillingCycle, SubscriptionStatus, UpdateSubscriptionRequest } from '@oficina/contracts';

export class SubscriptionListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset = 0;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;

  @IsOptional() @IsString() @MaxLength(120)
  search?: string;

  @IsOptional() @IsIn(SUBSCRIPTION_STATUSES)
  status?: SubscriptionStatus;
}

export class UpdateSubscriptionDto implements UpdateSubscriptionRequest {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(80)
  plan!: string;

  @IsIn(SUBSCRIPTION_STATUSES)
  subscriptionStatus!: SubscriptionStatus;

  @IsInt() @Min(0) @Max(100_000_000)
  subscriptionAmountCents!: number;

  @IsIn(BILLING_CYCLES)
  subscriptionCycle!: BillingCycle;

  @IsOptional() @IsDateString({ strict: true })
  subscriptionDueAt!: string | null;

  @IsOptional() @IsString() @MaxLength(2000)
  subscriptionNotes!: string | null;

  @IsOptional() @IsDateString({ strict: true })
  expectedUpdatedAt!: string | null;
}
