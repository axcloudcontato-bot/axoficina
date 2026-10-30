import { Controller, Get, Header } from '@nestjs/common';
import type { EntitlementsResponse } from '@oficina/contracts';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../guards/jwt-auth.guard';
import { EntitlementsService } from './entitlements.service';

@Controller('api/v1/plan')
export class PlanController {
  constructor(private readonly entitlements: EntitlementsService) {}

  // Every signed-in person: the menu uses it to show what the plan includes.
  @Get() @Header('Cache-Control', 'no-store')
  current(@CurrentUser() user: AuthenticatedUser): Promise<EntitlementsResponse> {
    return this.entitlements.forTenant(user.tenantId);
  }
}
