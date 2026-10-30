import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { BILLING_CYCLES, PLAN_CODES } from '@oficina/contracts';
import type { BillingCycle, CheckoutRequest, PlanCode } from '@oficina/contracts';
import { IsIn } from 'class-validator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { BillingService } from './billing.service';

export class CheckoutDto implements CheckoutRequest {
  @IsIn(PLAN_CODES) plan!: PlanCode;
  @IsIn(BILLING_CYCLES) cycle!: BillingCycle;
}

// Contracting, changing and cancelling the plan belongs to the workshop's administrator.
@Controller('api/v1/billing')
@Roles('ADMIN')
@Permissions('settings.manage')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get() @Header('Cache-Control', 'no-store')
  status(@CurrentUser() user: AuthenticatedUser) { return this.billing.status(user); }

  @Get('invoices') @Header('Cache-Control', 'no-store')
  invoices(@CurrentUser() user: AuthenticatedUser) { return this.billing.invoices(user); }

  @Post('checkout') @HttpCode(HttpStatus.OK)
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() body: CheckoutDto) { return this.billing.checkout(user, body); }

  @Post('portal') @HttpCode(HttpStatus.OK)
  portal(@CurrentUser() user: AuthenticatedUser) { return this.billing.portal(user); }

  @Post('cancel') @HttpCode(HttpStatus.OK)
  async cancel(@CurrentUser() user: AuthenticatedUser) { await this.billing.cancel(user); return { canceled: true }; }
}
