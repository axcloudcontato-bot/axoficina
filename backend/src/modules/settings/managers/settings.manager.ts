import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateMaintenanceAlertMonthsRequest, UpdateLaborRateRequest, AgendaHours, UpdateAgendaHoursRequest, PhotoPolicy, TenantSettingsResponse, UpdateCompanySettingsRequest, UpdateEmailSettingsRequest, UpdatePhotoPolicyRequest } from '@oficina/contracts';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { TenantRepository } from '../../iam/repositories/tenant.repository';
import { SecretEncryptionService } from '../services/secret-encryption.service';
import { TenantMailerService } from '../services/tenant-mailer.service';

const LOGO_PATTERN = /^data:image\/(png|jpeg|webp);base64,/;
const MAX_LOGO_BYTES = 500 * 1024;
const clean = (value?: string) => value?.trim() || null;

@Injectable()
export class SettingsManager {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly secrets: SecretEncryptionService,
    private readonly mailer: TenantMailerService,
    private readonly audit: AuditLogService,
  ) {}

  async get(user: AuthenticatedUser): Promise<TenantSettingsResponse> {
    const tenant = await this.requireTenant(user.tenantId);
    return this.toResponse(tenant);
  }

  async getBranding(user: AuthenticatedUser) {
    const tenant = await this.requireTenant(user.tenantId);
    return { company: this.toResponse(tenant).company, whatsappEnabled: tenant.waAkgEnabled ?? false, photoPolicy: this.photoPolicy(tenant), agendaHours: this.agendaHours(tenant), laborRateCents: tenant.laborRateCents ?? null, maintenanceAlertMonths: tenant.maintenanceAlertMonths ?? 6 };
  }

  async updateMaintenanceAlertMonths(user: AuthenticatedUser, input: UpdateMaintenanceAlertMonthsRequest) {
    const tenant = await this.tenants.updateSettings(user.tenantId, { maintenanceAlertMonths: input.months });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'settings.maintenance_alert_months_updated', entity: 'tenant', entityId: user.tenantId, metadata: { itemAction: 'update' } });
    return { maintenanceAlertMonths: tenant.maintenanceAlertMonths ?? 6 };
  }

  async updateLaborRate(user: AuthenticatedUser, input: UpdateLaborRateRequest) {
    const tenant = await this.tenants.updateSettings(user.tenantId, { laborRateCents: input.laborRateCents });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'settings.labor_rate_updated', entity: 'tenant', entityId: user.tenantId, metadata: { itemAction: 'update', amountCents: input.laborRateCents ?? 0 } });
    return { laborRateCents: tenant.laborRateCents ?? null };
  }

  async updateAgendaHours(user: AuthenticatedUser, input: UpdateAgendaHoursRequest) {
    const workDays = [...new Set(input.workDays)].sort((a, b) => a - b);
    if (input.openHour >= input.closeHour) throw new BadRequestException('O horário de fechamento deve ser depois da abertura.');
    if (!workDays.length) throw new BadRequestException('Escolha ao menos um dia de funcionamento.');
    const tenant = await this.tenants.updateSettings(user.tenantId, { agendaOpenHour: input.openHour, agendaCloseHour: input.closeHour, agendaWorkDays: workDays, ...(input.bays !== undefined ? { agendaBays: input.bays } : {}), ...(input.remindersEnabled !== undefined ? { appointmentRemindersEnabled: input.remindersEnabled } : {}) });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'settings.agenda_hours_updated', entity: 'tenant', entityId: user.tenantId });
    return { agendaHours: this.agendaHours(tenant) };
  }

  private agendaHours(tenant: { agendaOpenHour?: number; agendaCloseHour?: number; agendaWorkDays?: number[]; agendaBays?: number | null; appointmentRemindersEnabled?: boolean }): AgendaHours {
    return { openHour: tenant.agendaOpenHour ?? 8, closeHour: tenant.agendaCloseHour ?? 18, workDays: tenant.agendaWorkDays ?? [1, 2, 3, 4, 5, 6], bays: tenant.agendaBays ?? null, remindersEnabled: tenant.appointmentRemindersEnabled ?? false };
  }

  async updatePhotoPolicy(user: AuthenticatedUser, input: UpdatePhotoPolicyRequest) {
    const tenant = await this.tenants.updateSettings(user.tenantId, { photoRequireEntry: input.entry, photoRequireExit: input.exit, photoRequireItems: input.items });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'settings.photo_policy_updated', entity: 'tenant', entityId: user.tenantId, metadata: { enabled: input.entry && input.exit && input.items } });
    return { photoPolicy: this.photoPolicy(tenant) };
  }

  private photoPolicy(tenant: { photoRequireEntry?: boolean; photoRequireExit?: boolean; photoRequireItems?: boolean }): PhotoPolicy {
    return { entry: tenant.photoRequireEntry ?? true, exit: tenant.photoRequireExit ?? true, items: tenant.photoRequireItems ?? true };
  }

  async updateCompany(user: AuthenticatedUser, input: UpdateCompanySettingsRequest) {
    this.validateLogo(input.logoDataUrl);
    const tenant = await this.tenants.updateSettings(user.tenantId, {
      name: input.name.trim(),
      legalName: clean(input.legalName),
      document: input.document.trim(),
      stateRegistration: clean(input.stateRegistration),
      phone: clean(input.phone),
      whatsapp: clean(input.whatsapp),
      email: clean(input.email),
      website: clean(input.website),
      addressStreet: clean(input.addressStreet),
      addressNumber: clean(input.addressNumber),
      addressComplement: clean(input.addressComplement),
      addressDistrict: clean(input.addressDistrict),
      addressCity: clean(input.addressCity),
      addressState: clean(input.addressState)?.toUpperCase() ?? null,
      addressPostalCode: clean(input.addressPostalCode),
      logoDataUrl: clean(input.logoDataUrl),
      documentFooter: clean(input.documentFooter),
    });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'settings.company_updated', entity: 'tenant', entityId: user.tenantId });
    return { company: this.toResponse(tenant).company };
  }

  async updateEmail(user: AuthenticatedUser, input: UpdateEmailSettingsRequest) {
    const current = await this.requireTenant(user.tenantId);
    if (input.enabled && (!input.host?.trim() || !input.fromEmail?.trim())) {
      throw new BadRequestException('Informe servidor SMTP e e-mail remetente antes de ativar.');
    }
    const tenant = await this.tenants.updateSettings(user.tenantId, {
      smtpHost: clean(input.host),
      smtpPort: input.port,
      smtpSecure: input.secure,
      smtpUsername: clean(input.username),
      smtpPassword: input.password?.trim() ? this.secrets.encrypt(input.password) : current.smtpPassword,
      smtpFromName: clean(input.fromName),
      smtpFromEmail: clean(input.fromEmail),
      smtpReplyTo: clean(input.replyTo),
      smtpEnabled: input.enabled,
    });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'settings.email_updated', entity: 'tenant', entityId: user.tenantId, metadata: { enabled: input.enabled } });
    return { email: this.toResponse(tenant).email };
  }

  async sendTest(user: AuthenticatedUser, recipient: string) {
    const tenant = await this.requireTenant(user.tenantId);
    await this.mailer.send(user.tenantId, {
      to: recipient,
      subject: `Teste de e-mail — ${tenant.name}`,
      text: `O envio de e-mail da ${tenant.name} foi configurado corretamente.`,
      html: `<p>O envio de e-mail da <strong>${escapeHtml(tenant.name)}</strong> foi configurado corretamente.</p>`,
    });
    return { sent: true };
  }

  async sendMessage(user: AuthenticatedUser, input: { recipient: string; subject: string; text: string }) {
    await this.mailer.send(user.tenantId, { to: input.recipient, subject: input.subject, text: input.text });
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'email.sent', entity: 'tenant', entityId: user.tenantId, metadata: { recipient: input.recipient, subject: input.subject } });
    return { sent: true };
  }

  private async requireTenant(id: string) {
    const tenant = await this.tenants.byId(id);
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    return tenant;
  }

  private validateLogo(value?: string) {
    if (!value) return;
    if (!LOGO_PATTERN.test(value)) throw new BadRequestException('A logo deve ser PNG, JPEG ou WebP.');
    const base64 = value.slice(value.indexOf(',') + 1);
    if (Buffer.byteLength(base64, 'base64') > MAX_LOGO_BYTES) throw new BadRequestException('A logo deve ter no máximo 500 KiB.');
  }

  private toResponse(tenant: Awaited<ReturnType<TenantRepository['byId']>> & {}) {
    return {
      company: {
        name: tenant.name, legalName: tenant.legalName ?? undefined, document: tenant.document,
        stateRegistration: tenant.stateRegistration ?? undefined, phone: tenant.phone ?? undefined,
        whatsapp: tenant.whatsapp ?? undefined, email: tenant.email ?? undefined, website: tenant.website ?? undefined,
        addressStreet: tenant.addressStreet ?? undefined, addressNumber: tenant.addressNumber ?? undefined,
        addressComplement: tenant.addressComplement ?? undefined, addressDistrict: tenant.addressDistrict ?? undefined,
        addressCity: tenant.addressCity ?? undefined, addressState: tenant.addressState ?? undefined,
        addressPostalCode: tenant.addressPostalCode ?? undefined, logoDataUrl: tenant.logoDataUrl ?? undefined,
        documentFooter: tenant.documentFooter ?? undefined,
      },
      email: {
        host: tenant.smtpHost ?? undefined, port: tenant.smtpPort, secure: tenant.smtpSecure,
        username: tenant.smtpUsername ?? undefined, passwordConfigured: Boolean(tenant.smtpPassword),
        fromName: tenant.smtpFromName ?? undefined, fromEmail: tenant.smtpFromEmail ?? undefined,
        replyTo: tenant.smtpReplyTo ?? undefined, enabled: tenant.smtpEnabled,
      },
    } satisfies TenantSettingsResponse;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!);
}
