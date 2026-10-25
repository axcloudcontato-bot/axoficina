import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../shared/decorators/public.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { CustomerMessageManager } from '../managers/customer-message.manager';
import { AnswerCustomerMessageDto, ConfirmCustomerMessageDispatchDto, CreateCustomerMessageDto, CustomerMessageTokenDto, ListCustomerMessagesDto } from '../dto/customer-message.dto';

@Controller('api/v1')
export class CustomerMessagesController {
  constructor(private readonly manager: CustomerMessageManager) {}

  @Post('service-orders/customer-messages')
  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC')
  @Permissions('service_orders.manage', 'service_orders.prices')
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateCustomerMessageDto) { return this.manager.create(user, input); }

  @Post('service-orders/customer-messages/confirm-dispatch')
  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC')
  @Permissions('service_orders.manage', 'service_orders.prices')
  @HttpCode(HttpStatus.OK)
  confirmDispatch(@CurrentUser() user: AuthenticatedUser, @Body() input: ConfirmCustomerMessageDispatchDto) { return this.manager.confirmDispatch(user, input.id); }

  @Get('service-orders/customer-messages')
  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC')
  @Permissions('service_orders.view', 'service_orders.prices')
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListCustomerMessagesDto) { return this.manager.list(query.serviceOrderId); }

  @Public()
  @Get('public/customer-message')
  @Header('Cache-Control', 'no-store')
  get(@Query() query: CustomerMessageTokenDto) { return this.manager.getPublic(query.token); }

  @Public()
  @Post('public/customer-message/answer')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  answer(@Body() input: AnswerCustomerMessageDto) { return this.manager.answer(input.token, input.selectedOption); }
}
