import { HttpStatus, Injectable } from '@nestjs/common';
import { PERMISSION_KEYS, type AccessProfileResponse, type AssignUserProfileRequest, type CreateAccessProfileRequest, type UpdateAccessProfileRequest } from '@oficina/contracts';
import { AppErrorCode } from '../../../shared/errors/app-error-code';
import { AppException } from '../../../shared/errors/app-exception';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { RoleRepository } from '../repositories/role.repository';
import { UserRepository } from '../repositories/user.repository';

const PROFILE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  FINANCE: 'Financeiro',
  FRONT_DESK: 'Recepção',
  MANAGER: 'Gestor',
  MECHANIC: 'Mecânico',
};

@Injectable()
export class AccessProfileManager {
  constructor(private readonly roles: RoleRepository, private readonly users: UserRepository, private readonly audit: AuditLogService) {}

  async list(actingUser: AuthenticatedUser): Promise<{ items: AccessProfileResponse[] }> {
    const roles = await this.roles.listForTenant(actingUser.tenantId);
    return { items: await Promise.all(roles.map(async (role) => ({
      id: role.id,
      name: PROFILE_LABELS[role.name] ?? role.name,
      description: role.description ?? undefined,
      isSystem: role.isSystem,
      permissions: await this.roles.permissionKeys(role.id) as AccessProfileResponse['permissions'],
      userCount: await this.roles.userCount(role.id),
    }))) };
  }

  async create(actingUser: AuthenticatedUser, input: CreateAccessProfileRequest) {
    this.validatePermissions(input.permissions);
    const role = await this.roles.createCustom(actingUser.tenantId, input.name.trim(), input.description?.trim());
    await this.roles.replacePermissions(role.id, input.permissions);
    await this.audit.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'access_profile.created', entity: 'role', entityId: role.id, metadata: {} });
    return { profile: (await this.list(actingUser)).items.find((item) => item.id === role.id)! };
  }

  async update(actingUser: AuthenticatedUser, input: UpdateAccessProfileRequest) {
    this.validatePermissions(input.permissions);
    const role = await this.roles.byId(input.id);
    if (!role || (role.tenantId !== null && role.tenantId !== actingUser.tenantId)) {
      throw new AppException(AppErrorCode.ROLE_NOT_FOUND, 'Perfil não encontrado.', HttpStatus.NOT_FOUND);
    }
    const actorRoleId = (await this.users.byId(actingUser.userId))?.roleId ?? actingUser.roleId;
    if (actorRoleId === input.id && !input.permissions.includes('profiles.manage')) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Você não pode remover de si mesmo o gerenciamento de perfis.', HttpStatus.BAD_REQUEST);
    }

    let targetId = input.id;
    if (role.isSystem) {
      const personalized = await this.roles.personalizeSystemRole(role.id, actingUser.tenantId, input.description?.trim());
      if (!personalized) throw new AppException(AppErrorCode.ROLE_NOT_FOUND, 'Perfil não encontrado.', HttpStatus.NOT_FOUND);
      targetId = personalized.id;
    } else {
      await this.roles.updateCustom(input.id, actingUser.tenantId, { name: input.name.trim(), description: input.description?.trim() });
    }
    await this.roles.replacePermissions(targetId, input.permissions);
    await this.audit.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'access_profile.updated', entity: 'role', entityId: targetId, metadata: {} });
    return { profile: (await this.list(actingUser)).items.find((item) => item.id === targetId)! };
  }

  async assign(actingUser: AuthenticatedUser, input: AssignUserProfileRequest) {
    const [user, role] = await Promise.all([this.users.byId(input.userId), this.roles.byId(input.profileId)]);
    if (!user || user.tenantId !== actingUser.tenantId) throw new AppException(AppErrorCode.USER_NOT_FOUND, 'Usuário não encontrado.', HttpStatus.NOT_FOUND);
    if (!role || (role.tenantId !== null && role.tenantId !== actingUser.tenantId)) throw new AppException(AppErrorCode.ROLE_NOT_FOUND, 'Perfil não encontrado.', HttpStatus.NOT_FOUND);
    await this.assertWorkshopKeepsAnAdministrator(actingUser.tenantId, user.id, role.id);
    await this.users.update(user.id, { roleId: role.id });
    await this.audit.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'access_profile.assigned', entity: 'user', entityId: user.id, metadata: {} });
    return { success: true };
  }

  // Someone has to stay able to manage profiles, or nobody in the workshop could ever undo this.
  private async assertWorkshopKeepsAnAdministrator(tenantId: string, userId: string, newRoleId: string) {
    if ((await this.roles.permissionKeys(newRoleId)).includes('profiles.manage')) return;
    const roles = await this.roles.listForTenant(tenantId);
    const managing: string[] = [];
    for (const role of roles) if ((await this.roles.permissionKeys(role.id)).includes('profiles.manage')) managing.push(role.id);
    if ((await this.roles.activeUserCount(tenantId, managing, userId)) === 0) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Esta é a última pessoa que administra os perfis da oficina. Dê esse acesso a outra pessoa antes de trocar este perfil.', HttpStatus.CONFLICT);
    }
  }

  private validatePermissions(permissions: readonly string[]) {
    const catalog = new Set<string>(PERMISSION_KEYS);
    if (permissions.some((permission) => !catalog.has(permission))) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Existe uma permissão inválida no perfil.', HttpStatus.BAD_REQUEST);
    }
  }
}
