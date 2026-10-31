import { Injectable } from '@nestjs/common';
import { TRIAL_DAYS } from '@oficina/contracts';
import { Prisma, type PrismaClient } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';

export interface CreateTenantInput {
  name: string;
  document: string;
  plan?: string;
  status?: string;
}

export interface UpdateTenantSettingsInput {
  onboardingCompletedAt?: Date | null;
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
  smtpTestedAt?: Date | null;
  smtpTestSuccessAt?: Date | null;
  smtpTestError?: string | null;
  waAkgBaseUrl?: string | null;
  waAkgSessionId?: string | null;
  waAkgApiKey?: string | null;
  waAkgWebhookSecret?: string | null;
  waAkgEnabled?: boolean;
  waAkgTestedAt?: Date | null;
  waAkgTestSuccessAt?: Date | null;
  waAkgTestError?: string | null;
  waWebhookTestedAt?: Date | null;
  waWebhookTestSuccessAt?: Date | null;
  waWebhookTestError?: string | null;
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
  defaultWarrantyDays?: number | null;
  quoteValidityDays?: number | null;
  documentTerms?: string | null;
  acceptedPaymentMethods?: string[];
  agendaDayHours?: Record<string, { openHour: number; closeHour: number }> | null;
  agendaClosedDates?: string[];
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
        plan: input.plan ?? 'completo',
        status: input.status ?? 'active',
        // Every new workshop starts on the free trial of the Completo plan.
        subscriptionStatus: 'trial',
        subscriptionDueAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
      },
    });
  }

  async byId(id: string) {
    return this.prisma.unscoped.tenant.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async updateSettings(id: string, data: UpdateTenantSettingsInput) {
    // Prisma needs JsonNull to clear a JSON column.
    const { agendaDayHours, ...rest } = data;
    await this.prisma.unscoped.tenant.updateMany({ where: { id, deletedAt: null }, data: { ...rest, ...(agendaDayHours !== undefined ? { agendaDayHours: agendaDayHours ?? Prisma.JsonNull } : {}) } });
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
