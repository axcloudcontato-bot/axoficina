import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { PermissionKey, UserRole } from '@oficina/contracts';
import { UserRepository } from '../../modules/iam/repositories/user.repository';
import { EntitlementsService } from '../plan/entitlements.service';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: UserRole;
  roleId?: string;
  permissions?: PermissionKey[];
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly users: UserRepository,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Token de acesso ausente.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token);
      const user = await this.users.byId(payload.userId);
      if (!user || user.tenantId !== payload.tenantId || user.status !== 'active') {
        throw new UnauthorizedException('Usuário bloqueado ou removido.');
      }
      // Closing a workshop ends every session of it at once, even the ones with a valid token.
      if ((await this.entitlements.forTenant(payload.tenantId)).closed) throw new UnauthorizedException('Esta conta foi encerrada.');
      (request as Request & { user: AuthenticatedUser }).user = payload;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Token de acesso inválido ou expirado.');
    }
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers['authorization'];
    if (!header) {
      return undefined;
    }
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
