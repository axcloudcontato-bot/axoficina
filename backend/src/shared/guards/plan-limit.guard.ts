import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { LimitKind } from '@oficina/contracts';
import type { Request } from 'express';
import { PLAN_LIMIT_KEY } from '../decorators/plan-limit.decorator';
import { PlanUsageService } from '../plan/plan-usage.service';
import type { AuthenticatedUser } from './jwt-auth.guard';

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly usage: PlanUsageService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const kind = this.reflector.getAllAndOverride<LimitKind | 'write' | undefined>(PLAN_LIMIT_KEY, [context.getHandler(), context.getClass()]);
    if (!kind) return true;
    const user = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>().user;
    if (!user) return true;
    await this.usage.assertCanAdd(user.tenantId, kind);
    return true;
  }
}
