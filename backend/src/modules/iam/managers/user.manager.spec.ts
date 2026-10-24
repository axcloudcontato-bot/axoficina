import { LEGAL_VERSION } from '@oficina/contracts';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserManager } from './user.manager';

const MECHANIC_ROLE = { id: 'role-mechanic', name: 'MECHANIC', createdAt: new Date() };
const ADMIN_ROLE = { id: 'role-admin', name: 'ADMIN', createdAt: new Date() };

const actingAdmin = { userId: 'admin-1', tenantId: 'tenant-1', role: 'ADMIN' as const };

function buildManager() {
  const userRepository = {
    insert: jest.fn(),
    byId: jest.fn(),
    byEmail: jest.fn(),
    byInviteTokenHash: jest.fn(),
    update: jest.fn(),
    disableAndRevokeSessions: jest.fn(),
    softDeleteAndRevokeSessions: jest.fn(),
    listByTenant: jest.fn(),
  };
  const roleRepository = {
    byName: jest.fn(),
    byId: jest.fn(),
    all: jest.fn(),
  };
  const tokenService = {
    signAccessToken: jest.fn(async () => 'access-token'),
    verifyAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(() => ({
      token: 'raw-refresh-token',
      tokenHash: 'hashed-refresh-token',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    })),
    generateOpaqueToken: jest.fn(() => ({
      token: 'raw-invite-token',
      tokenHash: 'hashed-invite-token',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    })),
    hashToken: jest.fn((token: string) => `hash(${token})`),
  };
  const passwordService = {
    hash: jest.fn(async (plain: string) => `hashed:${plain}`),
    verify: jest.fn(),
  };
  const auditLog = { record: jest.fn() };
  const config = new ConfigService();

  const manager = new UserManager(
    userRepository as never,
    roleRepository as never,
    tokenService as never,
    passwordService as never,
    auditLog as never,
    config,
  );

  return { manager, userRepository, roleRepository, tokenService, passwordService, auditLog };
}

const invitedUser = {
  id: 'user-2',
  tenantId: 'tenant-1',
  email: 'mecanico@oficina.com',
  passwordHash: null,
  name: 'Mecânico',
  roleId: 'role-mechanic',
  status: 'invited',
  inviteTokenHash: 'hash(raw-invite-token)',
  inviteExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
  mfaEnabled: false,
  mfaSecret: null,
  createdAt: new Date(),
  updatedAt: null,
  deletedAt: null,
};

describe('UserManager', () => {
  describe('employee access management', () => {
    it('blocks a user from the same tenant and revokes sessions', async () => {
      const deps = buildManager();
      deps.userRepository.byId.mockResolvedValue({ ...invitedUser, status: 'active' });

      await deps.manager.disable(actingAdmin, { id: invitedUser.id });

      expect(deps.userRepository.disableAndRevokeSessions).toHaveBeenCalledWith(invitedUser.id);
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.disabled' }));
    });

    it('soft-deletes a user from the same tenant and revokes sessions', async () => {
      const deps = buildManager();
      deps.userRepository.byId.mockResolvedValue({ ...invitedUser, status: 'active' });

      await deps.manager.delete(actingAdmin, { id: invitedUser.id });

      expect(deps.userRepository.softDeleteAndRevokeSessions).toHaveBeenCalledWith(invitedUser.id);
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.deleted' }));
    });

    it('does not allow an administrator to block their own account', async () => {
      const deps = buildManager();
      await expect(deps.manager.disable(actingAdmin, { id: actingAdmin.userId })).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  describe('invite', () => {
    it('creates an invited user and returns an invite link', async () => {
      const deps = buildManager();
      deps.userRepository.byEmail.mockResolvedValue(null);
      deps.roleRepository.byName.mockResolvedValue(MECHANIC_ROLE);
      deps.userRepository.insert.mockResolvedValue(invitedUser);

      const result = await deps.manager.invite(actingAdmin, {
        email: 'mecanico@oficina.com',
        name: 'Mecânico',
        role: 'MECHANIC',
      });

      expect(result.inviteLink).toContain('raw-invite-token');
      expect(result.user.status).toBe('invited');
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.invited' }));
    });

    it('rejects an email that already exists (global uniqueness)', async () => {
      const deps = buildManager();
      deps.userRepository.byEmail.mockResolvedValue(invitedUser);

      await expect(
        deps.manager.invite(actingAdmin, { email: 'mecanico@oficina.com', name: 'X', role: 'MECHANIC' }),
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    });

    it('rejects an unknown role', async () => {
      const deps = buildManager();
      deps.userRepository.byEmail.mockResolvedValue(null);
      deps.roleRepository.byName.mockResolvedValue(null);

      await expect(
        deps.manager.invite(actingAdmin, { email: 'x@x.com', name: 'X', role: 'MECHANIC' }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });
  });

  describe('acceptInvite', () => {
    it('activates the user and returns tokens', async () => {
      const deps = buildManager();
      deps.userRepository.byInviteTokenHash.mockResolvedValue(invitedUser);
      deps.roleRepository.byId.mockResolvedValue(MECHANIC_ROLE);

      const result = await deps.manager.acceptInvite({ acceptedTerms: true, legalVersion: LEGAL_VERSION, inviteToken: 'raw-invite-token', password: 'supersecret1' });

      expect(deps.userRepository.update).toHaveBeenCalledWith(
        'user-2',
        expect.objectContaining({ status: 'active', inviteTokenHash: null }),
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.user.status).toBe('active');
    });

    it('rejects an unknown invite token', async () => {
      const deps = buildManager();
      deps.userRepository.byInviteTokenHash.mockResolvedValue(null);

      await expect(deps.manager.acceptInvite({ acceptedTerms: true, legalVersion: LEGAL_VERSION, inviteToken: 'bad', password: 'supersecret1' })).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('rejects an already-accepted invite', async () => {
      const deps = buildManager();
      deps.userRepository.byInviteTokenHash.mockResolvedValue({ ...invitedUser, status: 'active' });

      await expect(
        deps.manager.acceptInvite({ acceptedTerms: true, legalVersion: LEGAL_VERSION, inviteToken: 'raw-invite-token', password: 'supersecret1' }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('rejects an expired invite', async () => {
      const deps = buildManager();
      deps.userRepository.byInviteTokenHash.mockResolvedValue({
        ...invitedUser,
        inviteExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        deps.manager.acceptInvite({ acceptedTerms: true, legalVersion: LEGAL_VERSION, inviteToken: 'raw-invite-token', password: 'supersecret1' }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('rejects a password shorter than 8 characters', async () => {
      const deps = buildManager();
      deps.userRepository.byInviteTokenHash.mockResolvedValue(invitedUser);

      await expect(
        deps.manager.acceptInvite({ acceptedTerms: true, legalVersion: LEGAL_VERSION, inviteToken: 'raw-invite-token', password: 'short' }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });
  });

  describe('list', () => {
    it('lists users scoped to the tenant via the repository call', async () => {
      const deps = buildManager();
      deps.roleRepository.all.mockResolvedValue([ADMIN_ROLE, MECHANIC_ROLE]);
      deps.userRepository.listByTenant.mockResolvedValue({
        items: [{ ...invitedUser, status: 'active' }],
        total: 1,
      });

      const result = await deps.manager.list({ offset: 0, limit: 100 });

      expect(deps.userRepository.listByTenant).toHaveBeenCalledWith(0, 100, { status: undefined, roleId: undefined });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].role).toBe('MECHANIC');
      expect(result.hasMore).toBe(false);
    });

    it('throws if a user references a role that no longer exists', async () => {
      const deps = buildManager();
      deps.roleRepository.all.mockResolvedValue([ADMIN_ROLE]);
      deps.userRepository.listByTenant.mockResolvedValue({ items: [invitedUser], total: 1 });

      await expect(deps.manager.list({ offset: 0, limit: 100 })).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
});
