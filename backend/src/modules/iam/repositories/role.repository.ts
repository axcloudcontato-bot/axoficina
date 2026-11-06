import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async byName(name: string) {
    return this.prisma.unscoped.role.findFirst({
      where: { name, tenantId: null, deletedAt: null },
    });
  }

  // A workshop that personalized a fixed profile keeps using its own version, also for the people invited afterwards.
  async byNameForTenant(name: string, tenantId: string) {
    const own = await this.prisma.unscoped.role.findFirst({ where: { name, tenantId, baseRole: name, deletedAt: null } });
    return own ?? this.byName(name);
  }

  async byId(id: string) {
    return this.prisma.unscoped.role.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async all() {
    return this.prisma.unscoped.role.findMany({
      where: { tenantId: null, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async permissionKeys(roleId: string): Promise<string[]> {
    const rows = await this.prisma.unscoped.rolePermission.findMany({
      where: { roleId, deletedAt: null },
      select: { permissionId: true },
    });
    const permissions = await this.prisma.unscoped.permission.findMany({
      where: { id: { in: rows.map((row) => row.permissionId) } },
      select: { key: true },
    });
    return permissions.map((permission) => permission.key);
  }

  async listForTenant(tenantId: string) {
    const roles = await this.prisma.unscoped.role.findMany({
      where: { deletedAt: null, OR: [{ tenantId: null }, { tenantId }] },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    const overriddenNames = new Set(roles.filter((role) => role.tenantId === tenantId).map((role) => role.name));
    return roles.filter((role) => role.tenantId !== null || !overriddenNames.has(role.name));
  }

  async createCustom(tenantId: string, name: string, description?: string) {
    return this.prisma.unscoped.role.create({ data: { tenantId, name, description, baseRole: 'ADMIN', isSystem: false } });
  }

  async updateCustom(id: string, tenantId: string, data: { name: string; description?: string }) {
    return this.prisma.unscoped.role.updateMany({ where: { id, tenantId, isSystem: false, deletedAt: null }, data });
  }

  async personalizeSystemRole(systemRoleId: string, tenantId: string, description?: string) {
    const systemRole = await this.byId(systemRoleId);
    if (!systemRole || !systemRole.isSystem || systemRole.tenantId !== null) return null;
    return this.prisma.transaction(async (tx) => {
      const role = await tx.role.create({
        data: { tenantId, name: systemRole.name, description, baseRole: systemRole.baseRole, isSystem: false },
      });
      await tx.user.updateMany({
        where: { tenantId, roleId: systemRoleId, deletedAt: null },
        data: { roleId: role.id },
      });
      return role;
    });
  }

  async replacePermissions(roleId: string, keys: string[]) {
    const permissions = await this.prisma.unscoped.permission.findMany({ where: { key: { in: keys } } });
    await this.prisma.transaction(async (tx) => {
      await tx.rolePermission.updateMany({ where: { roleId, deletedAt: null }, data: { deletedAt: new Date() } });
      for (const permission of permissions) {
        const existing = await tx.rolePermission.findFirst({ where: { roleId, permissionId: permission.id } });
        if (existing) await tx.rolePermission.update({ where: { id: existing.id }, data: { deletedAt: null } });
        else await tx.rolePermission.create({ data: { roleId, permissionId: permission.id } });
      }
    });
  }

  async activeUserCount(tenantId: string, roleIds: string[], exceptUserId: string): Promise<number> {
    return this.prisma.client.user.count({ where: { tenantId, roleId: { in: roleIds }, status: 'active', deletedAt: null, id: { not: exceptUserId } } });
  }

  async userCount(roleId: string): Promise<number> {
    return this.prisma.unscoped.user.count({ where: { roleId, deletedAt: null } });
  }
}
