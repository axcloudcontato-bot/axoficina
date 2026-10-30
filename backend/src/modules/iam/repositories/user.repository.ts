import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';

export interface CreateUserInput {
  legalVersion?: string;
  legalAcceptedAt?: Date;
  tenantId: string;
  email: string;
  name: string;
  roleId: string;
  status: 'active' | 'invited';
  passwordHash?: string;
  inviteTokenHash?: string;
  inviteExpiresAt?: Date;
}

export interface UpdateUserInput {
  name?: string;
  legalVersion?: string;
  legalAcceptedAt?: Date;
  passwordHash?: string;
  status?: 'active' | 'invited' | 'disabled';
  inviteTokenHash?: string | null;
  inviteExpiresAt?: Date | null;
  passwordResetTokenHash?: string | null;
  passwordResetExpiresAt?: Date | null;
  lastLoginAt?: Date;
  roleId?: string;
}

export interface ListUsersFilters {
  status?: string;
  roleId?: string;
  search?: string;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Passa por `client`: se houver tenant context ativo (convite feito por um
  // Admin autenticado), a extensão injeta o tenant_id do Admin no `create` —
  // exatamente o comportamento desejado. No signup (sem context ainda), o
  // Manager passa `tenantId` explicitamente no input. `tx` opcional: usado
  // pelo AuthManager.signup para rodar tenant+user na mesma transação.
  async insert(input: CreateUserInput, tx?: PrismaClient) {
    const db = tx ?? this.prisma.client;
    return db.user.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        name: input.name,
        roleId: input.roleId,
        status: input.status,
        passwordHash: input.passwordHash,
        inviteTokenHash: input.inviteTokenHash,
        inviteExpiresAt: input.inviteExpiresAt,
        legalVersion: input.legalVersion,
        legalAcceptedAt: input.legalAcceptedAt,
      },
    });
  }

  async byId(id: string) {
    return this.prisma.client.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  // Global de propósito — usado no login (sem tenant context ainda) e na
  // checagem de unicidade do convite (email é único globalmente, não por
  // tenant; ver schema.prisma).
  async byEmail(email: string) {
    return this.prisma.unscoped.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  // Ignora deletedAt de propósito — usado só para distinguir "e-mail nunca
  // existiu" de "existiu mas foi soft-deleted" no login (Edge Case 6 da
  // spec), já que `byEmail` sozinho não permite essa distinção. Pega o
  // registro mais recente: como o e-mail pode ser reciclado após um soft
  // delete (índice único é parcial, só entre ativos), múltiplas linhas com
  // o mesmo e-mail podem existir ao longo do tempo.
  async byEmailIncludingDeleted(email: string) {
    return this.prisma.unscoped.user.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Global de propósito — accept-invite acontece sem o usuário autenticado.
  async byInviteTokenHash(inviteTokenHash: string) {
    return this.prisma.unscoped.user.findFirst({
      where: { inviteTokenHash, deletedAt: null },
    });
  }

  // Global de propósito — redefinir a senha acontece sem o usuário autenticado.
  async byPasswordResetTokenHash(passwordResetTokenHash: string) {
    return this.prisma.unscoped.user.findFirst({
      where: { passwordResetTokenHash, deletedAt: null },
    });
  }

  // Usado pelo ServiceOrderManager pra denormalizar o nome do técnico em
  // telas de listagem de OS sem N+1, mesmo padrão de CustomerRepository.byIds.
  // Escopado ao tenant (via `client`) — técnico de outro tenant nunca aparece.
  async byIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.client.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });
  }

  async update(id: string, patch: UpdateUserInput) {
    return this.prisma.client.user.updateMany({
      where: { id, deletedAt: null },
      data: patch,
    });
  }

  async disableAndRevokeSessions(id: string) {
    return this.prisma.unscoped.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status: 'disabled' } });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }

  async softDeleteAndRevokeSessions(id: string) {
    return this.prisma.unscoped.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status: 'disabled', deletedAt: new Date() } });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }

  async listByTenant(offset: number, limit: number, filters?: ListUsersFilters) {
    const where = {
      deletedAt: null,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.roleId ? { roleId: filters.roleId } : {}),
      ...(filters?.search ? { OR: [{ name: { contains: filters.search, mode: 'insensitive' as const } }, { email: { contains: filters.search, mode: 'insensitive' as const } }] } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.client.user.count({ where }),
    ]);

    return { items, total };
  }
}
