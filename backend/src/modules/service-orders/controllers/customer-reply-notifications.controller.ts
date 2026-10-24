import { Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { CustomerReplyNotificationRepository } from '../repositories/customer-reply-notification.repository';

class ListRepliesQuery { @IsOptional() @IsUUID() cursor?: string; }
class ReplyParams { @IsUUID() id!: string; }

@Controller('api/v1/customer-reply-notifications')
@Roles('ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC')
@Permissions('service_orders.view', 'service_orders.prices')
export class CustomerReplyNotificationsController {
  constructor(private readonly notifications: CustomerReplyNotificationRepository) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListRepliesQuery) {
    return this.notifications.list(user, query.cursor);
  }

  @Post(':id/read')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  markRead(@CurrentUser() user: AuthenticatedUser, @Param() params: ReplyParams) {
    return this.notifications.markRead(user, params.id);
  }
}
