import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post, StreamableFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RequiresModule } from '../../shared/decorators/requires-module.decorator';
import { PlanLimit } from '../../shared/decorators/plan-limit.decorator';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { WhatsAppChatManager } from './whatsapp-chat.manager';
import { SendWhatsAppChatMessageDto, WhatsAppChatJidParams, WhatsAppChatMediaParams } from './whatsapp-chat.dto';

@Controller('api/v1/whatsapp-chat')
@RequiresModule('whatsapp')
@Roles('ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC')
export class WhatsAppChatController {
  constructor(private readonly manager: WhatsAppChatManager) {}

  @Get('conversations') @Permissions('customers.view') @Header('Cache-Control', 'no-store')
  conversations(@CurrentUser() user: AuthenticatedUser) { return this.manager.conversations(user.tenantId); }

  @Get('conversations/:jid/messages') @Permissions('customers.view') @Header('Cache-Control', 'no-store')
  messages(@CurrentUser() user: AuthenticatedUser, @Param() params: WhatsAppChatJidParams) { return this.manager.messages(user.tenantId, params.jid); }

  @PlanLimit('write') @Post('conversations/:jid/messages') @Permissions('customers.manage') @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  send(@CurrentUser() user: AuthenticatedUser, @Param() params: WhatsAppChatJidParams, @Body() body: SendWhatsAppChatMessageDto) {
    return this.manager.send(user.tenantId, params.jid, body.text);
  }

  @Get('media/:file') @Permissions('customers.view') @Header('Cache-Control', 'private, max-age=3600')
  async media(@CurrentUser() user: AuthenticatedUser, @Param() params: WhatsAppChatMediaParams) {
    const file = await this.manager.media(user.tenantId, params.file);
    return new StreamableFile(file.body, { type: file.contentType, disposition: `inline; filename="${params.file}"` });
  }
}
