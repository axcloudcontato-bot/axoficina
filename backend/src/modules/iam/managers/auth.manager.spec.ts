import { LEGAL_VERSION } from '@oficina/contracts';
import { HttpStatus } from '@nestjs/common';
import { AuthManager } from './auth.manager';
import { AppException } from '../../../shared/errors/app-exception';
import type { DocumentValidationResult } from '../../../shared/documents/document-validator.service';

function buildManager() {
  const prisma = {
    transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({})),
  };
  const tenantRepository = {
    insert: jest.fn(),
    byId: jest.fn(),
    byDocument: jest.fn(),
  };
  const userRepository = {
    insert: jest.fn(),
    byId: jest.fn(),
    byEmail: jest.fn(),
    byEmailIncludingDeleted: jest.fn(),
    byInviteTokenHash: jest.fn(),
    update: jest.fn(),
    listByTenant: jest.fn(),
  };
  const refreshTokenRepository = {
    insert: jest.fn(),
    byTokenHash: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
  };
  const roleRepository = {
    byName: jest.fn(),
    byId: jest.fn(),
    all: jest.fn(),
  };
  const passwordService = {
    hash: jest.fn(async (plain: string) => `hashed:${plain}`),
    verify: jest.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
  };
  const tokenService = {
    signAccessToken: jest.fn(async () => 'access-token'),
    verifyAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(() => ({
      token: 'raw-refresh-token',
      tokenHash: 'hashed-refresh-token',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    })),
    generateOpaqueToken: jest.fn(),
    hashToken: jest.fn((token: string) => `hash(${token})`),
  };
  const documentValidator = {
    validate: jest.fn<DocumentValidationResult, [string]>(() => ({
      valid: true,
      type: 'CNPJ',
      normalized: '11444777000161',
    })),
  };
  const auditLog = { record: jest.fn() };

  const manager = new AuthManager(
    prisma as never,
    tenantRepository as never,
    userRepository as never,
    refreshTokenRepository as never,
    roleRepository as never,
    passwordService as never,
    tokenService as never,
    documentValidator as never,
    auditLog as never,
  );

  return {
    manager,
    prisma,
    tenantRepository,
    userRepository,
    refreshTokenRepository,
    roleRepository,
    passwordService,
    tokenService,
    documentValidator,
    auditLog,
  };
}

const ADMIN_ROLE = { id: 'role-admin', name: 'ADMIN', createdAt: new Date() };

const baseUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'admin@oficina.com',
  passwordHash: 'hashed:supersecret1',
  name: 'Admin',
  roleId: 'role-admin',
  status: 'active',
  inviteTokenHash: null,
  inviteExpiresAt: null,
  mfaEnabled: false,
  mfaSecret: null,
  createdAt: new Date(),
  updatedAt: null,
  deletedAt: null,
};

describe('AuthManager', () => {
  describe('signup', () => {
    it('rejects absent or stale legal acceptance before creating records', async () => {
      const deps = buildManager();
      const input = { tenantName: 'Test', tenantDocument: '11444777000161', adminName: 'Test', adminEmail: 'test@example.invalid', password: 'supersecret1', acceptedTerms: false, legalVersion: LEGAL_VERSION };
      await expect(deps.manager.signup(input)).rejects.toThrow(AppException);
      await expect(deps.manager.signup({ ...input, acceptedTerms: true, legalVersion: 'old' })).rejects.toThrow(AppException);
      expect(deps.prisma.transaction).not.toHaveBeenCalled();
    });
    it('creates a tenant + admin user and returns tokens', async () => {
      const deps = buildManager();
      deps.tenantRepository.byDocument.mockResolvedValue(null);
      deps.userRepository.byEmail.mockResolvedValue(null);
      deps.roleRepository.byName.mockResolvedValue(ADMIN_ROLE);
      deps.tenantRepository.insert.mockResolvedValue({
        id: 'tenant-1',
        name: 'Oficina do Zé',
        document: '11444777000161',
        plan: 'free',
        status: 'active',
        createdAt: new Date(),
        updatedAt: null,
        deletedAt: null,
      });
      deps.userRepository.insert.mockResolvedValue(baseUser);

      const result = await deps.manager.signup({ acceptedTerms: true, legalVersion: LEGAL_VERSION,
        tenantName: 'Oficina do Zé',
        tenantDocument: '11.444.777/0001-61',
        adminName: 'Admin',
        adminEmail: 'admin@oficina.com',
        password: 'supersecret1',
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('raw-refresh-token');
      expect(result.user.email).toBe('admin@oficina.com');
      expect(result.tenant.document).toBe('11444777000161');
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.signup' }));
    });

    it('rejects a password shorter than 8 characters', async () => {
      const deps = buildManager();
      await expect(
        deps.manager.signup({ acceptedTerms: true, legalVersion: LEGAL_VERSION,
          tenantName: 'X',
          tenantDocument: '11444777000161',
          adminName: 'Admin',
          adminEmail: 'a@a.com',
          password: 'short',
        }),
      ).rejects.toThrow(AppException);
    });

    it('rejects an invalid document', async () => {
      const deps = buildManager();
      deps.documentValidator.validate.mockReturnValue({ valid: false, type: null, normalized: '123' });

      await expect(
        deps.manager.signup({ acceptedTerms: true, legalVersion: LEGAL_VERSION,
          tenantName: 'X',
          tenantDocument: '123',
          adminName: 'Admin',
          adminEmail: 'a@a.com',
          password: 'supersecret1',
        }),
      ).rejects.toThrow(AppException);
    });

    it('rejects a duplicate tenant document with 409', async () => {
      const deps = buildManager();
      deps.tenantRepository.byDocument.mockResolvedValue({ id: 'existing-tenant' });

      await expect(
        deps.manager.signup({ acceptedTerms: true, legalVersion: LEGAL_VERSION,
          tenantName: 'X',
          tenantDocument: '11444777000161',
          adminName: 'Admin',
          adminEmail: 'a@a.com',
          password: 'supersecret1',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    });

    it('rejects a duplicate admin email with 409', async () => {
      const deps = buildManager();
      deps.tenantRepository.byDocument.mockResolvedValue(null);
      deps.userRepository.byEmail.mockResolvedValue(baseUser);

      await expect(
        deps.manager.signup({ acceptedTerms: true, legalVersion: LEGAL_VERSION,
          tenantName: 'X',
          tenantDocument: '11444777000161',
          adminName: 'Admin',
          adminEmail: 'admin@oficina.com',
          password: 'supersecret1',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    });

    it('fails loudly if the ADMIN role is missing (seed not run)', async () => {
      const deps = buildManager();
      deps.tenantRepository.byDocument.mockResolvedValue(null);
      deps.userRepository.byEmail.mockResolvedValue(null);
      deps.roleRepository.byName.mockResolvedValue(null);

      await expect(
        deps.manager.signup({ acceptedTerms: true, legalVersion: LEGAL_VERSION,
          tenantName: 'X',
          tenantDocument: '11444777000161',
          adminName: 'Admin',
          adminEmail: 'admin@oficina.com',
          password: 'supersecret1',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.INTERNAL_SERVER_ERROR });
    });
  });

  describe('login', () => {
    it('returns tokens for correct credentials', async () => {
      const deps = buildManager();
      deps.userRepository.byEmail.mockResolvedValue(baseUser);
      deps.roleRepository.byId.mockResolvedValue(ADMIN_ROLE);

      const result = await deps.manager.login({ email: 'admin@oficina.com', password: 'supersecret1' });

      expect(result.accessToken).toBe('access-token');
      expect(result.user.role).toBe('ADMIN');
    });

    it('rejects when the user does not exist', async () => {
      const deps = buildManager();
      deps.userRepository.byEmail.mockResolvedValue(null);

      await expect(deps.manager.login({ email: 'nobody@x.com', password: 'whatever1' })).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('rejects an incorrect password', async () => {
      const deps = buildManager();
      deps.userRepository.byEmail.mockResolvedValue(baseUser);

      await expect(
        deps.manager.login({ email: 'admin@oficina.com', password: 'wrong-password' }),
      ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
    });

    it('rejects a disabled user even with the correct password', async () => {
      const deps = buildManager();
      deps.userRepository.byEmail.mockResolvedValue({ ...baseUser, status: 'disabled' });

      await expect(
        deps.manager.login({ email: 'admin@oficina.com', password: 'supersecret1' }),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    });

    it('rejects a soft-deleted user with a distinct message (Edge Case 6)', async () => {
      const deps = buildManager();
      deps.userRepository.byEmail.mockResolvedValue(null);
      deps.userRepository.byEmailIncludingDeleted.mockResolvedValue({ ...baseUser, deletedAt: new Date() });

      await expect(
        deps.manager.login({ email: 'admin@oficina.com', password: 'supersecret1' }),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN, code: 'USER_DELETED' });
    });
  });

  describe('refresh', () => {
    const validToken = {
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: 'hash(good-token)',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: null,
      userAgent: null,
      ip: null,
      createdAt: new Date(),
    };

    it('rotates the refresh token on success', async () => {
      const deps = buildManager();
      deps.refreshTokenRepository.byTokenHash.mockResolvedValue(validToken);
      deps.userRepository.byId.mockResolvedValue(baseUser);
      deps.roleRepository.byId.mockResolvedValue(ADMIN_ROLE);

      const result = await deps.manager.refresh('good-token');

      expect(deps.refreshTokenRepository.revoke).toHaveBeenCalledWith('rt-1');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('raw-refresh-token');
    });

    it('rejects an unknown refresh token', async () => {
      const deps = buildManager();
      deps.refreshTokenRepository.byTokenHash.mockResolvedValue(null);

      await expect(deps.manager.refresh('unknown')).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
    });

    it('revokes the whole token family when a revoked token is reused', async () => {
      const deps = buildManager();
      deps.refreshTokenRepository.byTokenHash.mockResolvedValue({ ...validToken, revokedAt: new Date() });

      await expect(deps.manager.refresh('reused-token')).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
      expect(deps.refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('rejects an expired refresh token', async () => {
      const deps = buildManager();
      deps.refreshTokenRepository.byTokenHash.mockResolvedValue({
        ...validToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(deps.manager.refresh('expired-token')).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
    });

    it('rejects when the owning user is disabled', async () => {
      const deps = buildManager();
      deps.refreshTokenRepository.byTokenHash.mockResolvedValue(validToken);
      deps.userRepository.byId.mockResolvedValue({ ...baseUser, status: 'disabled' });

      await expect(deps.manager.refresh('good-token')).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
    });
  });

  describe('logout', () => {
    it('revokes an active refresh token and records the audit log', async () => {
      const deps = buildManager();
      deps.refreshTokenRepository.byTokenHash.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
      });
      deps.userRepository.byId.mockResolvedValue(baseUser);

      await deps.manager.logout({ refreshToken: 'good-token' });

      expect(deps.refreshTokenRepository.revoke).toHaveBeenCalledWith('rt-1');
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.logout' }));
    });

    it('is a no-op when the token does not exist', async () => {
      const deps = buildManager();
      deps.refreshTokenRepository.byTokenHash.mockResolvedValue(null);

      await deps.manager.logout({ refreshToken: 'unknown' });

      expect(deps.refreshTokenRepository.revoke).not.toHaveBeenCalled();
    });

    it('is a no-op when the token is already revoked', async () => {
      const deps = buildManager();
      deps.refreshTokenRepository.byTokenHash.mockResolvedValue({ id: 'rt-1', userId: 'user-1', revokedAt: new Date() });

      await deps.manager.logout({ refreshToken: 'already-revoked' });

      expect(deps.refreshTokenRepository.revoke).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const user = { id: 'u1', tenantId: 't1', email: 'ana@oficina.com', name: 'Ana', roleId: 'role-admin', status: 'active', passwordHash: 'hashed:senha-antiga' };

    it('checks the current password, signs other devices out and keeps this one signed in', async () => {
      const deps = buildManager();
      deps.userRepository.byId.mockResolvedValue(user);
      deps.roleRepository.byId.mockResolvedValue({ id: 'role-admin', name: 'ADMIN', baseRole: 'ADMIN' });
      await expect(deps.manager.changePassword('u1', 'senha-antiga', 'senha-nova-123')).resolves.toEqual({ accessToken: 'access-token', refreshToken: 'raw-refresh-token' });
      expect(deps.userRepository.update).toHaveBeenCalledWith('u1', expect.objectContaining({ passwordHash: 'hashed:senha-nova-123' }));
      expect(deps.refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith('u1');
    });

    it('refuses a wrong current password or the same password', async () => {
      const deps = buildManager();
      deps.userRepository.byId.mockResolvedValue(user);
      await expect(deps.manager.changePassword('u1', 'errada', 'senha-nova-123')).rejects.toThrow('A senha atual não confere');
      await expect(deps.manager.changePassword('u1', 'senha-antiga', 'senha-antiga')).rejects.toThrow('diferente da atual');
      expect(deps.userRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('sessions', () => {
    it('lists the open devices and marks the one asking', async () => {
      const deps = buildManager();
      (deps.refreshTokenRepository as unknown as { listActive: jest.Mock }).listActive = jest.fn().mockResolvedValue([
        { id: 's1', tokenHash: 'hash(mine)', userAgent: 'Chrome', createdAt: new Date('2026-10-30T12:00:00Z'), expiresAt: new Date('2026-11-06T12:00:00Z') },
        { id: 's2', tokenHash: 'hash(other)', userAgent: null, createdAt: new Date('2026-10-29T12:00:00Z'), expiresAt: new Date('2026-11-05T12:00:00Z') },
      ]);
      const result = await deps.manager.sessions('u1', 'mine');
      expect(result.items.map(item => [item.id, item.current, item.device])).toEqual([['s1', true, 'Chrome'], ['s2', false, null]]);
    });

    it('keeps the asking device when signing the others out', async () => {
      const deps = buildManager();
      const repo = deps.refreshTokenRepository as unknown as { revokeOthers: jest.Mock; listActive: jest.Mock };
      repo.revokeOthers = jest.fn(); repo.listActive = jest.fn().mockResolvedValue([]);
      deps.refreshTokenRepository.byTokenHash.mockResolvedValue({ id: 's1', userId: 'u1', revokedAt: null });
      await deps.manager.revokeOtherSessions('u1', 't1', 'mine');
      expect(repo.revokeOthers).toHaveBeenCalledWith('u1', 's1');
      deps.refreshTokenRepository.byTokenHash.mockResolvedValue({ id: 's9', userId: 'someone-else', revokedAt: null });
      await expect(deps.manager.revokeOtherSessions('u1', 't1', 'stolen')).rejects.toThrow('não foi reconhecida');
    });

    it('only revokes sessions of the person asking', async () => {
      const deps = buildManager();
      const repo = deps.refreshTokenRepository as unknown as { revokeOne: jest.Mock; listActive: jest.Mock };
      repo.listActive = jest.fn().mockResolvedValue([]);
      repo.revokeOne = jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
      await deps.manager.revokeSession('u1', 't1', 's1');
      expect(repo.revokeOne).toHaveBeenCalledWith('s1', 'u1');
      await expect(deps.manager.revokeSession('u1', 't1', 'not-mine')).rejects.toThrow('já estava desconectado');
    });
  });
});
