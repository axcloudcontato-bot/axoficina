import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LEGAL_VERSION, MIN_PASSWORD_LENGTH } from '@oficina/contracts';
import type {
  AcceptInviteRequest,
  AuthResponse,
  InviteUserRequest,
  InviteUserResponse,
  ManageUserAccessRequest,
  PaginationData,
  UserListItemResponse,
  UserListRequest,
  UserRole,
} from '@oficina/contracts';
import type { Role as RoleEntity, User as UserEntity } from '@oficina/database';
import { AppErrorCode } from '../../../shared/errors/app-error-code';
import { AppException } from '../../../shared/errors/app-exception';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { TenantMailerService } from '../../settings/services/tenant-mailer.service';
import { PasswordService } from '../services/password.service';
import { TokenService } from '../services/token.service';
import { RoleRepository } from '../repositories/role.repository';
import { TenantRepository } from '../repositories/tenant.repository';
import { UserRepository } from '../repositories/user.repository';

const DEFAULT_INVITE_TOKEN_TTL_SECONDS = 604800; // 7 dias
const DEFAULT_FRONTEND_URL = 'http://localhost:3000';

@Injectable()
export class UserManager {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    private readonly tenantRepository: TenantRepository,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
    private readonly mailer: TenantMailerService,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  async invite(actingUser: AuthenticatedUser, request: InviteUserRequest): Promise<InviteUserResponse> {
    // e-mail é único globalmente (não por tenant) — ver schema.prisma.
    const existingUser = await this.userRepository.byEmail(request.email);
    if (existingUser) {
      throw new AppException(AppErrorCode.EMAIL_ALREADY_EXISTS, 'Já existe uma conta com este e-mail.', HttpStatus.CONFLICT);
    }

    const role = await this.roleRepository.byName(request.role);
    if (!role) {
      throw new AppException(AppErrorCode.ROLE_NOT_FOUND, 'Papel inválido.', HttpStatus.BAD_REQUEST);
    }

    const ttlSeconds = this.config.get<number>('INVITE_TOKEN_TTL_SECONDS', DEFAULT_INVITE_TOKEN_TTL_SECONDS);
    const opaque = this.tokenService.generateOpaqueToken(ttlSeconds);

    const user = await this.userRepository.insert({
      tenantId: actingUser.tenantId,
      email: request.email,
      name: request.name,
      roleId: role.id,
      status: 'invited',
      inviteTokenHash: opaque.tokenHash,
      inviteExpiresAt: opaque.expiresAt,
    });

    await this.auditLog.record({
      tenantId: actingUser.tenantId,
      userId: actingUser.userId,
      action: 'user.invited',
      entity: 'user',
      entityId: user.id,
      metadata: { email: user.email, role: role.name },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL', DEFAULT_FRONTEND_URL);
    const inviteLink = `${frontendUrl}/invite/${opaque.token}`;

    const emailSent = await this.sendInviteEmail(actingUser.tenantId, user, inviteLink);

    return {
      user: this.toUserResponse(user, role),
      inviteLink,
      emailSent,
    };
  }

  // Tentativa best-effort: se o tenant não configurou SMTP (ou o envio
  // falhar), o convite já foi criado e o link acima continua sendo o
  // fallback manual — não faz sentido derrubar o convite por isso.
  private async sendInviteEmail(tenantId: string, invitedUser: UserEntity, inviteLink: string): Promise<boolean> {
    const tenant = await this.tenantRepository.byId(tenantId);
    if (!tenant?.smtpEnabled) {
      return false;
    }

    try {
      await this.mailer.send(tenantId, {
        to: invitedUser.email,
        subject: `Convite para acessar a ${tenant.name}`,
        text: `Você foi convidado(a) para acessar a ${tenant.name}. Acesse o link para criar sua senha e ativar sua conta: ${inviteLink}\n\nEste link expira em 7 dias.`,
        html: `<p>Você foi convidado(a) para acessar a <strong>${escapeHtml(tenant.name)}</strong>.</p><p>Acesse o link abaixo para criar sua senha e ativar sua conta:</p><p><a href="${inviteLink}">${inviteLink}</a></p><p>Este link expira em 7 dias.</p>`,
      });
      return true;
    } catch {
      // Falha de SMTP (host incorreto, credenciais etc.) não deve impedir a
      // criação do convite — quem convidou ainda tem o link para enviar manualmente.
      return false;
    }
  }

  async acceptInvite(request: AcceptInviteRequest): Promise<AuthResponse> {
    if (request.acceptedTerms !== true || request.legalVersion !== LEGAL_VERSION) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Leia e aceite os documentos atuais para ativar a conta.');
    }
    const tokenHash = this.tokenService.hashToken(request.inviteToken);
    const user = await this.userRepository.byInviteTokenHash(tokenHash);

    if (!user) {
      throw new AppException(AppErrorCode.INVITE_TOKEN_INVALID, 'Convite inválido.', HttpStatus.BAD_REQUEST);
    }

    if (user.status !== 'invited') {
      throw new AppException(AppErrorCode.INVITE_ALREADY_ACCEPTED, 'Este convite já foi utilizado.', HttpStatus.BAD_REQUEST);
    }

    if (user.inviteExpiresAt && user.inviteExpiresAt.getTime() < Date.now()) {
      throw new AppException(AppErrorCode.INVITE_TOKEN_EXPIRED, 'Este convite expirou.', HttpStatus.BAD_REQUEST);
    }

    if (request.password.length < MIN_PASSWORD_LENGTH) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    const passwordHash = await this.passwordService.hash(request.password);
    await this.userRepository.update(user.id, {
      passwordHash,
      status: 'active',
      inviteTokenHash: null,
      inviteExpiresAt: null,
      legalVersion: LEGAL_VERSION,
      legalAcceptedAt: new Date(),
    });

    const role = await this.roleRepository.byId(user.roleId);
    if (!role) {
      throw new AppException(AppErrorCode.ROLE_NOT_FOUND, 'Papel do usuário não encontrado.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const permissions = await (this.roleRepository.permissionKeys?.(role.id) ?? Promise.resolve([])) as import('@oficina/contracts').PermissionKey[];
    const accessToken = await this.tokenService.signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: (role.baseRole ?? role.name) as UserRole,
      roleId: role.id,
      permissions,
    });
    const opaque = this.tokenService.generateRefreshToken();

    await this.auditLog.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'user.invite_accepted',
      entity: 'user',
      entityId: user.id,
      metadata: { legalVersion: LEGAL_VERSION },
    });

    return {
      accessToken,
      refreshToken: opaque.token,
      user: this.toUserResponse({ ...user, status: 'active' }, role, permissions),
    };
  }

  async list(request: UserListRequest, actingUser?: AuthenticatedUser): Promise<PaginationData<UserListItemResponse>> {
    const roles = actingUser ? await this.roleRepository.listForTenant(actingUser.tenantId) : await this.roleRepository.all();
    const roleByName = new Map(roles.map((role) => [role.name, role]));
    const roleFilterId = request.filters?.role ? roleByName.get(request.filters.role)?.id : undefined;

    const { items, total } = await this.userRepository.listByTenant(request.offset, request.limit, {
      status: request.filters?.status,
      roleId: roleFilterId,
    });

    const roleById = new Map(roles.map((role) => [role.id, role]));

    return {
      items: items.map((user) => {
        const role = roleById.get(user.roleId);
        if (!role) {
          throw new AppException(
            AppErrorCode.ROLE_NOT_FOUND,
            `Usuário ${user.id} referencia um papel inexistente.`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
        return this.toUserResponse(user, role);
      }),
      total,
      offset: request.offset,
      limit: request.limit,
      hasMore: request.offset + items.length < total,
    };
  }

  async disable(actingUser: AuthenticatedUser, request: ManageUserAccessRequest): Promise<{ success: true }> {
    const user = await this.getManageableUser(actingUser, request.id);
    await this.userRepository.disableAndRevokeSessions(user.id);
    await this.auditLog.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'user.disabled', entity: 'user', entityId: user.id, metadata: {} });
    return { success: true };
  }

  async delete(actingUser: AuthenticatedUser, request: ManageUserAccessRequest): Promise<{ success: true }> {
    const user = await this.getManageableUser(actingUser, request.id);
    await this.userRepository.softDeleteAndRevokeSessions(user.id);
    await this.auditLog.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'user.deleted', entity: 'user', entityId: user.id, metadata: {} });
    return { success: true };
  }

  private async getManageableUser(actingUser: AuthenticatedUser, id: string): Promise<UserEntity> {
    if (id === actingUser.userId) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Você não pode bloquear ou excluir sua própria conta.', HttpStatus.BAD_REQUEST);
    }
    const user = await this.userRepository.byId(id);
    if (!user || user.tenantId !== actingUser.tenantId) {
      throw new AppException(AppErrorCode.USER_NOT_FOUND, 'Funcionário não encontrado.', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  private toUserResponse(user: UserEntity, role: RoleEntity, permissions: import('@oficina/contracts').PermissionKey[] = []): UserListItemResponse {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: (role.baseRole ?? role.name) as UserRole,
      profileId: role.id,
      profileName: role.name,
      permissions,
      status: user.status as UserListItemResponse['status'],
      createdAt: user.createdAt.toISOString(),
    };
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!);
}
