import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MIN_PASSWORD_LENGTH } from '@oficina/contracts';
import * as nodemailer from 'nodemailer';
import { AppErrorCode } from '../../../shared/errors/app-error-code';
import { AppException } from '../../../shared/errors/app-exception';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import { TenantMailerService } from '../../settings/services/tenant-mailer.service';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { TenantRepository } from '../repositories/tenant.repository';
import { UserRepository } from '../repositories/user.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

// A link sent by e-mail lives one hour; one an administrator hands over in person lives a day.
const EMAIL_LINK_TTL_SECONDS = 60 * 60;
const ADMIN_LINK_TTL_SECONDS = 24 * 60 * 60;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!);

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly users: UserRepository,
    private readonly tenants: TenantRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenService,
    private readonly passwords: PasswordService,
    private readonly mailer: TenantMailerService,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  private link(token: string) {
    return `${this.config.get<string>('FRONTEND_URL', 'http://localhost:3000')}/redefinir-senha/${token}`;
  }

  private async issue(userId: string, ttlSeconds: number) {
    const opaque = this.tokens.generateOpaqueToken(ttlSeconds);
    await this.users.update(userId, { passwordResetTokenHash: opaque.tokenHash, passwordResetExpiresAt: opaque.expiresAt });
    return this.link(opaque.token);
  }

  // Always answers the same, whether the e-mail exists or not, so the form does not reveal who has an account.
  async request(email: string): Promise<void> {
    const user = await this.users.byEmail(email.trim());
    if (!user || user.status !== 'active' || !user.passwordHash) return;
    const link = await this.issue(user.id, EMAIL_LINK_TTL_SECONDS);
    const tenant = await this.tenants.byId(user.tenantId);
    const message = {
      to: user.email,
      subject: 'Redefinir sua senha do Ofix',
      text: `Olá, ${user.name}.\n\nRecebemos um pedido para redefinir a sua senha${tenant ? ` da ${tenant.name}` : ''} no Ofix. Para criar uma nova senha, acesse:\n${link}\n\nO link vale por 1 hora. Se você não pediu, ignore este e-mail: sua senha continua a mesma.`,
      html: `<p>Olá, ${escapeHtml(user.name)}.</p><p>Recebemos um pedido para redefinir a sua senha${tenant ? ` da <strong>${escapeHtml(tenant.name)}</strong>` : ''} no Ofix.</p><p><a href="${link}">Criar uma nova senha</a></p><p>O link vale por 1 hora. Se você não pediu, ignore este e-mail: sua senha continua a mesma.</p>`,
    };
    const sent = await this.sendThroughWorkshop(user.tenantId, Boolean(tenant?.smtpEnabled), message) || await this.sendThroughPlatform(message);
    await this.auditLog.record({ tenantId: user.tenantId, userId: user.id, action: 'auth.password_reset_requested', entity: 'user', entityId: user.id, metadata: { emailSent: sent } });
  }

  private async sendThroughWorkshop(tenantId: string, enabled: boolean, message: { to: string; subject: string; text: string; html: string }) {
    if (!enabled) return false;
    try { await this.mailer.send(tenantId, message); return true; }
    catch { return false; }
  }

  // Fallback for workshops without their own e-mail: PLATFORM_SMTP_URL (smtps://user:pass@host:465) set by whoever runs the server.
  private async sendThroughPlatform(message: { to: string; subject: string; text: string; html: string }) {
    const url = this.config.get<string>('PLATFORM_SMTP_URL');
    const from = this.config.get<string>('PLATFORM_MAIL_FROM');
    if (!url || !from) return false;
    try {
      await nodemailer.createTransport(url).sendMail({ from, ...message });
      return true;
    } catch (error) {
      this.logger.warn(`Password reset e-mail not sent through the platform SMTP: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  // An administrator hands the link to a team member who cannot receive e-mail.
  async linkFor(userId: string, actor: { userId: string; tenantId: string }): Promise<string> {
    const link = await this.issue(userId, ADMIN_LINK_TTL_SECONDS);
    await this.auditLog.record({ tenantId: actor.tenantId, userId: actor.userId, action: 'user.password_reset_link_created', entity: 'user', entityId: userId, metadata: {} });
    return link;
  }

  // Sets the new password, spends the link and signs every device out.
  async reset(token: string, password: string): Promise<void> {
    if (password.length < MIN_PASSWORD_LENGTH) throw new AppException(AppErrorCode.VALIDATION_ERROR, `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    const user = await this.users.byPasswordResetTokenHash(this.tokens.hashToken(token));
    if (!user || user.status !== 'active' || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
      throw new AppException(AppErrorCode.PASSWORD_RESET_TOKEN_INVALID, 'Este link para criar uma nova senha é inválido ou expirou. Peça um novo.', HttpStatus.BAD_REQUEST);
    }
    await this.users.update(user.id, { passwordHash: await this.passwords.hash(password), passwordResetTokenHash: null, passwordResetExpiresAt: null });
    await this.refreshTokens.revokeAllForUser(user.id);
    await this.auditLog.record({ tenantId: user.tenantId, userId: user.id, action: 'auth.password_reset', entity: 'user', entityId: user.id, metadata: {} });
  }
}
