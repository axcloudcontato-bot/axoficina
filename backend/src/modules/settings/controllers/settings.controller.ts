import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { SendEmailDto, TestEmailSettingsDto, UpdateCompanySettingsDto, UpdateAgendaHoursDto, UpdateEmailSettingsDto, UpdateLaborRateDto, UpdateOrderDefaultsDto, UpdateMaintenanceAlertMonthsDto, UpdatePhotoPolicyDto } from '../dto/settings.dto';
import { SettingsManager } from '../managers/settings.manager';

@Controller('api/v1/settings')
@Roles('ADMIN', 'MANAGER')
export class SettingsController {
  constructor(private readonly manager: SettingsManager) {}

  @Get() @Permissions('settings.view')
  get(@CurrentUser() user: AuthenticatedUser) { return this.manager.get(user); }

  @Get('branding') @Roles('ADMIN', 'MANAGER', 'MECHANIC', 'FRONT_DESK')
  branding(@CurrentUser() user: AuthenticatedUser) { return this.manager.getBranding(user); }

  @Post('onboarding/complete') @HttpCode(HttpStatus.OK) @Permissions('settings.manage')
  completeOnboarding(@CurrentUser() user: AuthenticatedUser) { return this.manager.completeOnboarding(user); }

  @Post('company') @HttpCode(HttpStatus.OK) @Permissions('settings.manage')
  updateCompany(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateCompanySettingsDto) { return this.manager.updateCompany(user, body); }

  @Post('labor-rate') @HttpCode(HttpStatus.OK) @Permissions('service_orders.prices')
  updateLaborRate(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateLaborRateDto) { return this.manager.updateLaborRate(user, body); }

  @Post('order-defaults') @HttpCode(HttpStatus.OK) @Permissions('settings.manage')
  updateOrderDefaults(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateOrderDefaultsDto) { return this.manager.updateOrderDefaults(user, body); }

  @Post('maintenance-alert-months') @HttpCode(HttpStatus.OK) @Permissions('settings.manage')
  updateMaintenanceAlertMonths(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateMaintenanceAlertMonthsDto) { return this.manager.updateMaintenanceAlertMonths(user, body); }

  @Post('agenda-hours') @HttpCode(HttpStatus.OK) @Permissions('settings.manage')
  updateAgendaHours(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateAgendaHoursDto) { return this.manager.updateAgendaHours(user, body); }

  @Post('photo-policy') @HttpCode(HttpStatus.OK) @Permissions('settings.manage')
  updatePhotoPolicy(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdatePhotoPolicyDto) { return this.manager.updatePhotoPolicy(user, body); }

  @Post('email') @HttpCode(HttpStatus.OK) @Permissions('settings.manage')
  updateEmail(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateEmailSettingsDto) { return this.manager.updateEmail(user, body); }

  @Post('email/test') @HttpCode(HttpStatus.OK) @Permissions('settings.manage')
  testEmail(@CurrentUser() user: AuthenticatedUser, @Body() body: TestEmailSettingsDto) { return this.manager.sendTest(user, body.recipient); }

  @Post('email/send') @HttpCode(HttpStatus.OK) @Roles('ADMIN', 'MANAGER', 'MECHANIC', 'FRONT_DESK') @Permissions('service_orders.manage')
  sendEmail(@CurrentUser() user: AuthenticatedUser, @Body() body: SendEmailDto) { return this.manager.sendMessage(user, body); }
}
