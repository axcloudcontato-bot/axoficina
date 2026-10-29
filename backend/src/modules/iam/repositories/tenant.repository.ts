import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';

export interface CreateTenantInput {
  name: string;
  document: string;
  plan?: string;
  status?: string;
}

export interface UpdateTenantSettingsInput {
  name?: string;
  legalName?: string | null;
  document?: string;
  stateRegistration?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressDistrict?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostalCode?: string | null;
  logoDataUrl?: string | null;
  documentFooter?: string | null;
  smtpHost?: string | null;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string | null;
  smtpPassword?: string | null;
  smtpFromName?: string | null;
  smtpFromEmail?: string | null;
  smtpReplyTo?: string | null;
  smtpEnabled?: boolean;
  waAkgBaseUrl?: string | null;
  waAkgSessionId?: string | null;
  waAkgApiKey?: string | null;
  waAkgWebhookSecret?: string | null;
  waAkgEnabled?: boolean;
  photoRequireEntry?: boolean;
  photoRequireExit?: boolean;
  photoRequireItems?: boolean;
  agendaOpenHour?: number;
  agendaCloseHour?: number;
  agendaWorkDays?: number[];
  agendaBays?: number | null;
  appointmentRemindersEnabled?: boolean;
  laborRateCents?: number | null;
  maintenanceAlertMonths?: number;
}

@Injectable()
export class TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  // `tx` opcional: usado pelo AuthManager.signup para rodar tenant+user na
  // mesma transação.
  async insert(input: CreateTenantInput, tx?: PrismaClient) {
    const db = tx ?? this.prisma.unscoped;
    return db.tenant.create({
      data: {
        name: input.name,
        document: input.document,
        plan: input.plan ?? 'free',
        status: input.status ?? 'active',
      },
    });
  }

  async byId(id: string) {
    return this.prisma.unscoped.tenant.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async updateSettings(id: string, data: UpdateTenantSettingsInput) {
    await this.prisma.unscoped.tenant.updateMany({ where: { id, deletedAt: null }, data });
    return this.byId(id);
  }

  // Global de propósito — checar unicidade de documento acontece antes de
  // qualquer tenant/usuário existir (signup).
  async byDocument(document: string) {
    return this.prisma.unscoped.tenant.findFirst({
      where: { document, deletedAt: null },
    });
  }

  // Usado por MaintenanceAlertScanProcessor (Feature Motor de Manutenção
  // Preventiva) pra iterar todos os tenants em chunks — Tenant nunca é
  // tenant-scoped, então já é sempre `unscoped`, mesmo padrão dos outros
  // métodos deste repositório.
  async listAllUnscoped(offset: number, limit: number) {
    return this.prisma.unscoped.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
      skip: offset,
      take: limit,
    });
  }
}
