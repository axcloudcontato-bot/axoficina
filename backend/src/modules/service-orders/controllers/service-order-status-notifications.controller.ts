import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Equals, IsInt, IsUUID, Max, Min } from 'class-validator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { ServiceOrderStatusNotificationService } from '../services/service-order-status-notification.service';

export class ListServiceOrderStatusNotificationsDto {
  @IsUUID() serviceOrderId!: string;
  @IsInt() @Min(0) offset = 0;
  @IsInt() @Min(1) @Max(100) limit = 20;
}
export class RetryServiceOrderStatusNotificationDto {
  @IsUUID() id!: string;
  @Equals(true) confirmResend!: true;
}
@Controller('api/v1/service-orders/status-notifications')
export class ServiceOrderStatusNotificationsController {
  constructor(private readonly notifications: ServiceOrderStatusNotificationService) {}
  @Post('list') @HttpCode(HttpStatus.OK) @Permissions('service_orders.view')
  list(@Body() body: ListServiceOrderStatusNotificationsDto) { return this.notifications.list(body); }
  @Post('retry') @HttpCode(HttpStatus.OK) @Permissions('service_orders.manage')
  retry(@CurrentUser() user: AuthenticatedUser, @Body() body: RetryServiceOrderStatusNotificationDto) { return this.notifications.retry(user, body.id); }
}
