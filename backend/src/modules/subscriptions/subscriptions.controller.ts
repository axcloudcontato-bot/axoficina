import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { AccountClosureService } from '../account-closure/account-closure.service';
import { AdminCloseDto, AdminPurgeDto } from '../account-closure/account-closure.dto';
import { SaasAdminGuard, SaasAdminService } from './saas-admin.service';
import { SubscriptionListDto, UpdateSubscriptionDto } from './subscriptions.dto';
import { SubscriptionsManager } from './subscriptions.manager';

@Controller('api/v1/admin')
export class SubscriptionsController {
  constructor(private readonly manager: SubscriptionsManager, private readonly admins: SaasAdminService, private readonly closure: AccountClosureService) {}

  @Get('access') @Header('Cache-Control', 'no-store')
  access(@CurrentUser() user: AuthenticatedUser) { return { allowed: this.admins.isAdmin(user.userId) }; }

  @Get('subscriptions') @UseGuards(SaasAdminGuard) @Header('Cache-Control', 'no-store')
  list(@Query() query: SubscriptionListDto) { return this.manager.list(query); }

  @Patch('subscriptions/:id') @UseGuards(SaasAdminGuard)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateSubscriptionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manager.update(id, input, user);
  }

  // Closing starts a 30-day wait: the access ends and the billing stops at once, the data is kept so it can be restored.
  @Post('subscriptions/:id/close') @HttpCode(HttpStatus.OK) @UseGuards(SaasAdminGuard)
  close(@Param('id', ParseUUIDPipe) id: string, @Body() body: AdminCloseDto, @CurrentUser() user: AuthenticatedUser) { return this.closure.closeAsManager(id, body.reason, user); }

  @Post('subscriptions/:id/restore') @HttpCode(HttpStatus.OK) @UseGuards(SaasAdminGuard)
  async restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { await this.closure.restore(id, user); return { restored: true }; }

  // Erases a closed workshop for good, before the 30 days end. The workshop's name has to be typed.
  @Post('subscriptions/:id/purge') @HttpCode(HttpStatus.OK) @UseGuards(SaasAdminGuard)
  async purge(@Param('id', ParseUUIDPipe) id: string, @Body() body: AdminPurgeDto) { await this.closure.purgeAsManager(id, body.confirmName); return { purged: true }; }
}
