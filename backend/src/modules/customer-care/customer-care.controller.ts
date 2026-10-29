import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { CustomerCareService } from './customer-care.service';
import { CustomerCarePlansService } from './customer-care-plans.service';
import { CustomerCareAutomationService } from './customer-care-automation.service';
import { CustomerCareForecastService } from './customer-care-forecast.service';
import { CareIdDto, CarePreviewDto, CareUnsubscribeDto, RecordCareServiceDto, UpdateCareSettingsDto } from './customer-care.dto';

class CarePageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000000) planOffset: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000000) deliveryOffset: number = 0;
}
@Controller('api/v1/customer-care')
@Roles('ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC')
export class CustomerCareController {
  constructor(private readonly care: CustomerCareService, private readonly plans: CustomerCarePlansService, private readonly automation: CustomerCareAutomationService, private readonly forecast: CustomerCareForecastService) {}
  @Get() @Permissions('alerts.view')
  dashboard(@CurrentUser() user: AuthenticatedUser, @Query() query: CarePageDto) { return this.care.dashboard(user.tenantId, query.planOffset, query.deliveryOffset); }
  @Get('forecast') @Permissions('alerts.view')
  forecastContacts(@CurrentUser() user: AuthenticatedUser) { return this.forecast.forecast(user.tenantId); }
  @Post('settings') @HttpCode(200) @Permissions('settings.manage')
  settings(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateCareSettingsDto) { return this.care.update(user, body); }
  @Post('services') @HttpCode(200) @Permissions('alerts.manage')
  record(@CurrentUser() user: AuthenticatedUser, @Body() body: RecordCareServiceDto) { return this.plans.record(user, body); }
  @Post('preview') @HttpCode(200) @Permissions('alerts.view')
  preview(@CurrentUser() user: AuthenticatedUser, @Body() body: CarePreviewDto) { return this.care.preview(user.tenantId, body); }
  @Post('retry') @HttpCode(200) @Permissions('settings.manage')
  retry(@CurrentUser() user: AuthenticatedUser, @Body() body: CareIdDto) { return this.automation.retry(user.tenantId, body.id); }
}
@Controller('api/v1/customer-care/preferences')
export class CustomerCarePreferencesController {
  constructor(private readonly care: CustomerCareService) {}
  @Public() @Post('lookup') @HttpCode(200)
  info(@Body() body: CareUnsubscribeDto) { return this.care.unsubscribeInfo(body.token); }
  @Public() @Post('pause') @HttpCode(200)
  pause(@Body() body: CareUnsubscribeDto) { return this.care.unsubscribe(body.token); }
}
