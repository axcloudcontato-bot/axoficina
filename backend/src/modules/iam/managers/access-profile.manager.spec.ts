import { HttpStatus } from '@nestjs/common';
import { AccessProfileManager } from './access-profile.manager';

const actor = { userId: 'admin-1', tenantId: 't1', role: 'ADMIN' as const, roleId: 'role-admin' };

function build(others: number) {
  const permissions: Record<string, string[]> = { 'role-admin': ['profiles.manage'], 'role-mechanic': ['service_orders.view'] };
  const roles = {
    byId: jest.fn(async (id: string) => ({ id, tenantId: null, name: id, isSystem: true })),
    permissionKeys: jest.fn(async (id: string) => permissions[id] ?? []),
    listForTenant: jest.fn(async () => [{ id: 'role-admin' }, { id: 'role-mechanic' }]),
    activeUserCount: jest.fn(async () => others),
  };
  const users = { byId: jest.fn(async (id: string) => ({ id, tenantId: 't1', roleId: 'role-admin' })), update: jest.fn() };
  const audit = { record: jest.fn() };
  return { manager: new AccessProfileManager(roles as never, users as never, audit as never), roles, users, audit };
}

describe('AccessProfileManager.assign', () => {
  it('refuses to leave the workshop without anyone who administers the profiles', async () => {
    const { manager, users } = build(0);
    await expect(manager.assign(actor, { userId: 'admin-1', profileId: 'role-mechanic' })).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    expect(users.update).not.toHaveBeenCalled();
  });

  it('changes the profile when someone else still administers them, and leaves a record', async () => {
    const { manager, users, audit } = build(1);
    await expect(manager.assign(actor, { userId: 'admin-1', profileId: 'role-mechanic' })).resolves.toEqual({ success: true });
    expect(users.update).toHaveBeenCalledWith('admin-1', { roleId: 'role-mechanic' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'access_profile.assigned', entityId: 'admin-1' }));
  });

  it('does not count administrators when the new profile keeps that access', async () => {
    const { manager, roles } = build(0);
    await expect(manager.assign(actor, { userId: 'admin-1', profileId: 'role-admin' })).resolves.toEqual({ success: true });
    expect(roles.activeUserCount).not.toHaveBeenCalled();
  });
});
