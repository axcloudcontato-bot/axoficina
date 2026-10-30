import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';

export interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}

// refresh_tokens não tem tenant_id (ver spec) — não passa pela extensão de
// isolamento de qualquer forma. Usa `unscoped` só para deixar isso
// explícito na leitura do código.
@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(input: CreateRefreshTokenInput) {
    return this.prisma.unscoped.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent,
        ip: input.ip,
      },
    });
  }

  async byTokenHash(tokenHash: string) {
    return this.prisma.unscoped.refreshToken.findFirst({
      where: { tokenHash },
    });
  }

  async revoke(id: string) {
    return this.prisma.unscoped.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  // Open sessions of a user: not revoked, not expired.
  async listActive(userId: string) {
    return this.prisma.unscoped.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Always scoped to the owner: nobody revokes another person's session by guessing an id.
  async revokeOne(id: string, userId: string) {
    return this.prisma.unscoped.refreshToken.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeOthers(userId: string, keepId: string) {
    return this.prisma.unscoped.refreshToken.updateMany({ where: { userId, revokedAt: null, id: { not: keepId } }, data: { revokedAt: new Date() } });
  }

  // Sinal de possível token roubado (Edge Case 2 da spec): revoga TODA a
  // família de refresh tokens do usuário, não só o token reutilizado.
  async revokeAllForUser(userId: string) {
    return this.prisma.unscoped.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
