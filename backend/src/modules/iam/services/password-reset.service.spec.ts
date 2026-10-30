import { ConfigService } from '@nestjs/config';
import { PasswordResetService } from './password-reset.service';

const sendMail = jest.fn();
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail: (...args: unknown[]) => sendMail(...args) })) }));

const activeUser = { id: 'u1', tenantId: 't1', email: 'ana@oficina.com', name: 'Ana', status: 'active', passwordHash: 'old-hash' };

function build(overrides: { user?: unknown; tenant?: unknown; env?: Record<string, string> } = {}) {
  const users = {
    byEmail: jest.fn().mockResolvedValue('user' in overrides ? overrides.user : activeUser),
    byPasswordResetTokenHash: jest.fn(),
    update: jest.fn(),
  };
  const tenants = { byId: jest.fn().mockResolvedValue(overrides.tenant ?? { id: 't1', name: 'Oficina Boa', smtpEnabled: true }) };
  const refreshTokens = { revokeAllForUser: jest.fn() };
  const tokens = { generateOpaqueToken: jest.fn(() => ({ token: 'raw-token', tokenHash: 'hashed-token', expiresAt: new Date('2026-10-30T13:00:00Z') })), hashToken: jest.fn((token: string) => `hash(${token})`) };
  const passwords = { hash: jest.fn(async (plain: string) => `hashed:${plain}`) };
  const mailer = { send: jest.fn() };
  const auditLog = { record: jest.fn() };
  const config = new ConfigService({ FRONTEND_URL: 'https://ofix.test', ...overrides.env });
  const service = new PasswordResetService(users as never, tenants as never, refreshTokens as never, tokens as never, passwords as never, mailer as never, auditLog as never, config);
  return { service, users, refreshTokens, mailer, auditLog };
}

describe('PasswordResetService', () => {
  beforeEach(() => sendMail.mockReset());

  it('e-mails a one-hour link through the workshop e-mail', async () => {
    const { service, users, mailer } = build();
    await service.request(' ana@oficina.com ');
    expect(users.byEmail).toHaveBeenCalledWith('ana@oficina.com');
    expect(users.update).toHaveBeenCalledWith('u1', { passwordResetTokenHash: 'hashed-token', passwordResetExpiresAt: expect.any(Date) });
    expect(mailer.send).toHaveBeenCalledWith('t1', expect.objectContaining({ to: 'ana@oficina.com', text: expect.stringContaining('https://ofix.test/redefinir-senha/raw-token') }));
  });

  it('falls back to the platform e-mail when the workshop has none', async () => {
    const { service, mailer } = build({ tenant: { id: 't1', name: 'Oficina Boa', smtpEnabled: false }, env: { PLATFORM_SMTP_URL: 'smtps://u:p@smtp.ofix.test:465', PLATFORM_MAIL_FROM: 'Ofix <nao-responda@ofix.test>' } });
    await service.request('ana@oficina.com');
    expect(mailer.send).not.toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'Ofix <nao-responda@ofix.test>', to: 'ana@oficina.com' }));
  });

  it('says nothing and creates no link for unknown, invited or disabled accounts', async () => {
    for (const user of [null, { ...activeUser, status: 'invited' }, { ...activeUser, status: 'disabled' }]) {
      const { service, users, mailer } = build({ user });
      await expect(service.request('ana@oficina.com')).resolves.toBeUndefined();
      expect(users.update).not.toHaveBeenCalled();
      expect(mailer.send).not.toHaveBeenCalled();
    }
  });

  it('sets the new password, spends the link and signs every device out', async () => {
    const { service, users, refreshTokens } = build();
    users.byPasswordResetTokenHash.mockResolvedValue({ ...activeUser, passwordResetExpiresAt: new Date(Date.now() + 60_000) });
    await service.reset('raw-token', 'nova-senha-forte');
    expect(users.byPasswordResetTokenHash).toHaveBeenCalledWith('hash(raw-token)');
    expect(users.update).toHaveBeenCalledWith('u1', { passwordHash: 'hashed:nova-senha-forte', passwordResetTokenHash: null, passwordResetExpiresAt: null });
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('refuses an expired or unknown link', async () => {
    const { service, users } = build();
    users.byPasswordResetTokenHash.mockResolvedValueOnce({ ...activeUser, passwordResetExpiresAt: new Date(Date.now() - 1000) }).mockResolvedValueOnce(null);
    await expect(service.reset('raw-token', 'nova-senha-forte')).rejects.toThrow('inválido ou expirou');
    await expect(service.reset('raw-token', 'nova-senha-forte')).rejects.toThrow('inválido ou expirou');
    expect(users.update).not.toHaveBeenCalled();
  });
});
