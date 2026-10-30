import { Controller, Get, Header } from '@nestjs/common';
import type { PlanStatusResponse } from '@oficina/contracts';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../guards/jwt-auth.guard';
import { EntitlementsService } from './entitlements.service';
import { PlanUsageService } from './plan-usage.service';

@Controller('api/v1/plan')
export class PlanController {
  constructor(private readonly entitlements: EntitlementsService, private readonly usage: PlanUsageService) {}

  // Every signed-in person: the menu shows what the plan includes, the banners show how much of it is used.
  @Get() @Header('Cache-Control', 'no-store')
  async current(@CurrentUser() user: AuthenticatedUser): Promise<PlanStatusResponse> {
    const [entitlements, usage] = await Promise.all([this.entitlements.forTenant(user.tenantId), this.usage.usage(user.tenantId)]);
    return { ...entitlements, usage };
  }
}
