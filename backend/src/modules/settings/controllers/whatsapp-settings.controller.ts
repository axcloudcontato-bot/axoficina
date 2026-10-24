import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { UpdateWhatsAppSettingsDto } from '../dto/whatsapp-settings.dto';
import { WaAkgService } from '../services/wa-akg.service';

@Controller('api/v1/settings/whatsapp')
@Roles('ADMIN', 'MANAGER')
export class WhatsAppSettingsController {
  constructor(private readonly wa: WaAkgService) {}

  @Get() @Permissions('settings.view')
  get(@CurrentUser() user: AuthenticatedUser) { return this.wa.getSettings(user.tenantId); }

  @Post() @HttpCode(HttpStatus.OK) @Permissions('settings.manage')
  update(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateWhatsAppSettingsDto) { return this.wa.update(user, body); }

  @Post('test') @HttpCode(HttpStatus.OK) @Permissions('settings.manage')
  test(@CurrentUser() user: AuthenticatedUser) { return this.wa.testConnection(user.tenantId); }

  @Post('webhook/test') @HttpCode(HttpStatus.OK) @Permissions('settings.manage')
  testWebhook(@CurrentUser() user: AuthenticatedUser) { return this.wa.testWebhook(user.tenantId); }
}
