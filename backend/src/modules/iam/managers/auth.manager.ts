import { HttpStatus, Injectable } from '@nestjs/common';
import { LEGAL_VERSION, MIN_PASSWORD_LENGTH } from '@oficina/contracts';
import type { SessionResponse } from '@oficina/contracts';
import type {
  AuthResponse,
  LoginRequest,
  LogoutRequest,
  RefreshResponse,
  SignupResponse,
  UserResponse,
  UserRole,
} from '@oficina/contracts';
import type { Role as RoleEntity, User as UserEntity } from '@oficina/database';
import { AppErrorCode } from '../../../shared/errors/app-error-code';
import { AppException } from '../../../shared/errors/app-exception';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { DocumentValidatorService } from '../../../shared/documents/document-validator.service';
import { PasswordService } from '../services/password.service';
import { TokenService } from '../services/token.service';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { RoleRepository } from '../repositories/role.repository';
import { TenantRepository } from '../repositories/tenant.repository';
import { UserRepository } from '../repositories/user.repository';

const ADMIN_ROLE_NAME = 'ADMIN';

export interface SignupInput {
  acceptedTerms: boolean;
  legalVersion: string;
  tenantName: string;
  tenantDocument: string;
  adminName: string;
  adminEmail: string;
  password: string;
}

@Injectable()
export class AuthManager {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantRepository: TenantRepository,
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly roleRepository: RoleRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly documentValidator: DocumentValidatorService,
    private readonly auditLog: AuditLogService,
  ) {}

  async signup(input: SignupInput): Promise<SignupResponse> {
    if (input.acceptedTerms !== true || input.legalVersion !== LEGAL_VERSION) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Leia e aceite os Termos de uso e a ciência da Política de privacidade atuais.');
    }
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    const documentCheck = this.documentValidator.validate(input.tenantDocument);
    if (!documentCheck.valid) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'CPF/CNPJ inválido.');
    }

    const existingTenant = await this.tenantRepository.byDocument(documentCheck.normalized);
    if (existingTenant) {
      throw new AppException(AppErrorCode.DOCUMENT_ALREADY_EXISTS, 'Já existe uma oficina cadastrada com este documento.', HttpStatus.CONFLICT);
    }

    const existingUser = await this.userRepository.byEmail(input.adminEmail);
    if (existingUser) {
      throw new AppException(AppErrorCode.EMAIL_ALREADY_EXISTS, 'Já existe uma conta com este e-mail.', HttpStatus.CONFLICT);
    }

    const adminRole = await this.roleRepository.byName(ADMIN_ROLE_NAME);
    if (!adminRole) {
      throw new AppException(AppErrorCode.ROLE_NOT_FOUND, 'Papel ADMIN não encontrado — seed não foi executado.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const passwordHash = await this.passwordService.hash(input.password);

    const { tenant, user } = await this.prisma.transaction(async (tx) => {
      const tenant = await this.tenantRepository.insert(
        { name: input.tenantName, document: documentCheck.normalized },
        tx,
      );
      const user = await this.userRepository.insert(
        {
          tenantId: tenant.id,
          email: input.adminEmail,
          name: input.adminName,
          roleId: adminRole.id,
          status: 'active',
          passwordHash,
          legalVersion: LEGAL_VERSION,
          legalAcceptedAt: new Date(),
        },
        tx,
      );
      return { tenant, user };
    });

    const { accessToken, refreshToken, permissions } = await this.issueTokens(user, adminRole);

    await this.auditLog.record({
      tenantId: tenant.id,
      userId: user.id,
      action: 'auth.signup',
      entity: 'tenant',
      entityId: tenant.id,
      metadata: { legalVersion: LEGAL_VERSION },
    });

    return {
      accessToken,
      refreshToken,
      user: this.toUserResponse(user, adminRole, permissions),
      tenant: {
        id: tenant.id,
        name: tenant.name,
        document: tenant.document,
        plan: tenant.plan,
        status: tenant.status,
        createdAt: tenant.createdAt.toISOString(),
      },
    };
  }

  async login(input: LoginRequest, device?: string): Promise<AuthResponse> {
    const user = await this.userRepository.byEmail(input.email);
    if (!user || !user.passwordHash) {
      // Edge Case 6 da spec: soft-deleted deve ter mensagem distinta de
      // "e-mail ou senha inválidos" — mas só quando não existe nenhum
      // usuário ATIVO com esse e-mail (checado acima); como o e-mail pode
      // ser reciclado após soft delete, não dá pra assumir isso sempre que
      // a busca ativa falhar, então essa é uma checagem best-effort.
      const mostRecent = await this.userRepository.byEmailIncludingDeleted(input.email);
      if (mostRecent?.deletedAt) {
        throw new AppException(AppErrorCode.USER_DELETED, 'Esta conta foi desativada.', HttpStatus.FORBIDDEN);
      }
      throw new AppException(AppErrorCode.INVALID_CREDENTIALS, 'E-mail ou senha inválidos.', HttpStatus.UNAUTHORIZED);
    }

    if (user.status === 'disabled') {
      throw new AppException(AppErrorCode.USER_DISABLED, 'Esta conta está desabilitada.', HttpStatus.FORBIDDEN);
    }

    const passwordMatches = await this.passwordService.verify(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppException(AppErrorCode.INVALID_CREDENTIALS, 'E-mail ou senha inválidos.', HttpStatus.UNAUTHORIZED);
    }

    // The password was right, so saying why the access is closed does not help anyone guess it.
    if (!(await this.tenantRepository.byId(user.tenantId))) {
      throw new AppException(AppErrorCode.ACCOUNT_CLOSED, 'Esta oficina foi encerrada. Para restaurar a conta em até 30 dias do encerramento, fale com o suporte do Ofix.', HttpStatus.FORBIDDEN);
    }

    const role = await this.roleRepository.byId(user.roleId);
    if (!role) {
      throw new AppException(AppErrorCode.ROLE_NOT_FOUND, 'Papel do usuário não encontrado.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const { accessToken, refreshToken, permissions } = await this.issueTokens(user, role, device);
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    await this.auditLog.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'auth.login',
      entity: 'user',
      entityId: user.id,
      metadata: {},
    });

    return { accessToken, refreshToken, user: this.toUserResponse(user, role, permissions) };
  }

  async refresh(refreshToken: string, device?: string): Promise<RefreshResponse> {
    const tokenHash = this.tokenService.hashToken(refreshToken);
    const existing = await this.refreshTokenRepository.byTokenHash(tokenHash);

    if (!existing) {
      throw new AppException(AppErrorCode.REFRESH_TOKEN_INVALID, 'Refresh token inválido.', HttpStatus.UNAUTHORIZED);
    }

    if (existing.revokedAt) {
      // Token já rotacionado sendo reutilizado — sinal de possível token
      // roubado (Edge Case 2 da spec). Revoga toda a família por segurança.
      await this.refreshTokenRepository.revokeAllForUser(existing.userId);
      throw new AppException(AppErrorCode.REFRESH_TOKEN_INVALID, 'Refresh token inválido.', HttpStatus.UNAUTHORIZED);
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new AppException(AppErrorCode.REFRESH_TOKEN_INVALID, 'Refresh token expirado.', HttpStatus.UNAUTHORIZED);
    }

    const user = await this.userRepository.byId(existing.userId);
    if (!user || user.status === 'disabled' || !(await this.tenantRepository.byId(user.tenantId))) {
      throw new AppException(AppErrorCode.REFRESH_TOKEN_INVALID, 'Refresh token inválido.', HttpStatus.UNAUTHORIZED);
    }

    const role = await this.roleRepository.byId(user.roleId);
    if (!role) {
      throw new AppException(AppErrorCode.ROLE_NOT_FOUND, 'Papel do usuário não encontrado.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    await this.refreshTokenRepository.revoke(existing.id);
    // The renewed token stays the same device even when this request does not say which.
    const { accessToken, refreshToken: newRefreshToken } = await this.issueTokens(user, role, device ?? existing.userAgent ?? undefined);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, device?: string): Promise<RefreshResponse> {
    const user = await this.userRepository.byId(userId);
    if (!user || user.status !== 'active' || !user.passwordHash) throw new AppException(AppErrorCode.USER_NOT_FOUND, 'Usuário não encontrado.', HttpStatus.NOT_FOUND);
    if (!(await this.passwordService.verify(currentPassword, user.passwordHash))) throw new AppException(AppErrorCode.INVALID_CREDENTIALS, 'A senha atual não confere.', HttpStatus.BAD_REQUEST);
    if (newPassword.length < MIN_PASSWORD_LENGTH) throw new AppException(AppErrorCode.VALIDATION_ERROR, `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    if (newPassword === currentPassword) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'A nova senha precisa ser diferente da atual.');
    const role = await this.roleRepository.byId(user.roleId);
    if (!role) throw new AppException(AppErrorCode.ROLE_NOT_FOUND, 'Papel do usuário não encontrado.', HttpStatus.INTERNAL_SERVER_ERROR);
    await this.userRepository.update(user.id, { passwordHash: await this.passwordService.hash(newPassword), passwordResetTokenHash: null, passwordResetExpiresAt: null });
    await this.refreshTokenRepository.revokeAllForUser(user.id);
    const { accessToken, refreshToken } = await this.issueTokens(user, role, device);
    await this.auditLog.record({ tenantId: user.tenantId, userId: user.id, action: 'auth.password_changed', entity: 'user', entityId: user.id, metadata: {} });
    return { accessToken, refreshToken };
  }

  async sessions(userId: string, currentRefreshToken?: string): Promise<{ items: SessionResponse[] }> {
    const currentHash = currentRefreshToken ? this.tokenService.hashToken(currentRefreshToken) : null;
    const rows = await this.refreshTokenRepository.listActive(userId);
    return { items: rows.map(row => ({ id: row.id, device: row.userAgent, lastActiveAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString(), current: currentHash !== null && row.tokenHash === currentHash })) };
  }

  async revokeSession(userId: string, tenantId: string, id: string): Promise<{ items: SessionResponse[] }> {
    const result = await this.refreshTokenRepository.revokeOne(id, userId);
    if (!result.count) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Esse aparelho já estava desconectado.', HttpStatus.NOT_FOUND);
    await this.auditLog.record({ tenantId, userId, action: 'auth.session_revoked', entity: 'user', entityId: userId, metadata: {} });
    return this.sessions(userId);
  }

  // "Sair dos outros aparelhos": the device that asks stays signed in, identified by its own refresh token.
  async revokeOtherSessions(userId: string, tenantId: string, currentRefreshToken: string): Promise<{ items: SessionResponse[] }> {
    const current = await this.refreshTokenRepository.byTokenHash(this.tokenService.hashToken(currentRefreshToken));
    if (!current || current.userId !== userId || current.revokedAt) throw new AppException(AppErrorCode.REFRESH_TOKEN_INVALID, 'Sua sessão não foi reconhecida. Entre de novo.', HttpStatus.UNAUTHORIZED);
    await this.refreshTokenRepository.revokeOthers(userId, current.id);
    await this.auditLog.record({ tenantId, userId, action: 'auth.other_sessions_revoked', entity: 'user', entityId: userId, metadata: {} });
    return this.sessions(userId, currentRefreshToken);
  }

  async logout(input: LogoutRequest): Promise<void> {
    const tokenHash = this.tokenService.hashToken(input.refreshToken);
    const existing = await this.refreshTokenRepository.byTokenHash(tokenHash);

    if (!existing || existing.revokedAt) {
      return;
    }

    await this.refreshTokenRepository.revoke(existing.id);

    const user = await this.userRepository.byId(existing.userId);
    if (user) {
      await this.auditLog.record({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'auth.logout',
        entity: 'user',
        entityId: user.id,
        metadata: {},
      });
    }
  }

  private async issueTokens(user: UserEntity, role: RoleEntity, device?: string): Promise<{ accessToken: string; refreshToken: string; permissions: import('@oficina/contracts').PermissionKey[] }> {
    const permissions = await (this.roleRepository.permissionKeys?.(role.id) ?? Promise.resolve([])) as import('@oficina/contracts').PermissionKey[];
    const accessToken = await this.tokenService.signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: (role.baseRole ?? role.name) as UserRole,
      roleId: role.id,
      permissions,
    });

    const opaque = this.tokenService.generateRefreshToken();
    await this.refreshTokenRepository.insert({
      userId: user.id,
      tokenHash: opaque.tokenHash,
      expiresAt: opaque.expiresAt,
      // Only the browser's own description, never the address: enough to recognize the device, nothing to track.
      userAgent: device?.slice(0, 300),
    });

    return { accessToken, refreshToken: opaque.token, permissions };
  }

  private toUserResponse(user: UserEntity, role: RoleEntity, permissions: import('@oficina/contracts').PermissionKey[] = []): UserResponse {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: (role.baseRole ?? role.name) as UserRole,
      profileId: role.id,
      profileName: role.name,
      permissions,
      status: user.status as UserResponse['status'],
      createdAt: user.createdAt.toISOString(),
    };
  }
}
