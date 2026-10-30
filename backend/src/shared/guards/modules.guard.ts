import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULES, PLANS, type ModuleKey } from '@oficina/contracts';
import type { Request } from 'express';
import { EntitlementsService } from '../plan/entitlements.service';
import { REQUIRES_MODULE_KEY } from '../decorators/requires-module.decorator';
import type { AuthenticatedUser } from './jwt-auth.guard';

@Injectable()
export class ModulesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly entitlements: EntitlementsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<ModuleKey | undefined>(REQUIRES_MODULE_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;
    const user = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>().user;
    if (!user) return true; // public routes are not sold by plan
    const { modules } = await this.entitlements.forTenant(user.tenantId);
    if (modules.includes(required)) return true;
    const info = MODULES[required];
    throw new ForbiddenException(`${info.label} não faz parte do plano da sua oficina. Disponível a partir do plano ${PLANS[info.minPlan].name}.`);
  }
}
