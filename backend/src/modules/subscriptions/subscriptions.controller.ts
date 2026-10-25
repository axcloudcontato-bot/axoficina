import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { SaasAdminGuard, SaasAdminService } from './saas-admin.service';
import { SubscriptionListDto, UpdateSubscriptionDto } from './subscriptions.dto';
import { SubscriptionsManager } from './subscriptions.manager';

@Controller('api/v1/admin')
export class SubscriptionsController {
  constructor(private readonly manager: SubscriptionsManager, private readonly admins: SaasAdminService) {}

  @Get('access') @Header('Cache-Control', 'no-store')
  access(@CurrentUser() user: AuthenticatedUser) { return { allowed: this.admins.isAdmin(user.userId) }; }

  @Get('subscriptions') @UseGuards(SaasAdminGuard) @Header('Cache-Control', 'no-store')
  list(@Query() query: SubscriptionListDto) { return this.manager.list(query); }

  @Patch('subscriptions/:id') @UseGuards(SaasAdminGuard)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateSubscriptionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manager.update(id, input, user);
  }
}
