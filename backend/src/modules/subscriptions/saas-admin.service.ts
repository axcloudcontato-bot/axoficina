import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';

@Injectable()
export class SaasAdminService {
  constructor(private readonly config: ConfigService) {}

  isAdmin(userId: string): boolean {
    // User IDs cannot be claimed through signup or tenant access profiles.
    return this.config.get<string>('SAAS_ADMIN_USER_IDS', '').split(',').map((id) => id.trim()).filter(Boolean).includes(userId);
  }
}

@Injectable()
export class SaasAdminGuard implements CanActivate {
  constructor(private readonly admins: SaasAdminService) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user || !this.admins.isAdmin(user.userId)) {
      throw new ForbiddenException('Acesso restrito à administração do SaaS.');
    }
    return true;
  }
}
