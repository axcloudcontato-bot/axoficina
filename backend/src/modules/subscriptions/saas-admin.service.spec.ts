import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SaasAdminGuard, SaasAdminService } from './saas-admin.service';

describe('SaaS global authorization', () => {
  const context = (user?: { userId: string; role: string }) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;

  it('denies all users when no platform administrator is configured', () => {
    const guard = new SaasAdminGuard(new SaasAdminService(new ConfigService({})));
    expect(() => guard.canActivate(context({ userId: 'tenant-admin', role: 'ADMIN' }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context())).toThrow(ForbiddenException);
  });

  it('matches exact configured user IDs and does not trust tenant roles', () => {
    const service = new SaasAdminService(new ConfigService({ SAAS_ADMIN_USER_IDS: ' account-a , account-b, ' }));
    const guard = new SaasAdminGuard(service);
    expect(guard.canActivate(context({ userId: 'account-a', role: 'ADMIN' }))).toBe(true);
    expect(guard.canActivate(context({ userId: 'account-b', role: 'MANAGER' }))).toBe(true);
    expect(() => guard.canActivate(context({ userId: 'account', role: 'ADMIN' }))).toThrow(ForbiddenException);
  });
});
