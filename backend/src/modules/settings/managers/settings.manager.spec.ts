import { BadRequestException } from '@nestjs/common';
import { SettingsManager } from './settings.manager';

const user = { userId: 'user-1', tenantId: 'tenant-1', role: 'ADMIN' as const };
const tenant = {
  id: 'tenant-1', name: 'Oficina Teste', legalName: null, document: '123',
  stateRegistration: null, phone: null, whatsapp: null, email: null, website: null,
  addressStreet: null, addressNumber: null, addressComplement: null, addressDistrict: null,
  addressCity: null, addressState: null, addressPostalCode: null, logoDataUrl: null, documentFooter: null,
  smtpHost: 'smtp.test', smtpPort: 587, smtpSecure: false, smtpUsername: 'user',
  smtpPassword: 'encrypted-old', smtpFromName: 'Oficina', smtpFromEmail: 'oficina@test.com',
  smtpReplyTo: null, smtpEnabled: true, plan: 'free', status: 'active',
  createdAt: new Date(), updatedAt: null, deletedAt: null,
};

function build() {
  const tenants = { byId: jest.fn().mockResolvedValue(tenant), updateSettings: jest.fn().mockImplementation((_id, data) => ({ ...tenant, ...data })) };
  const secrets = { encrypt: jest.fn((value) => `encrypted:${value}`), decrypt: jest.fn() };
  const mailer = { send: jest.fn() };
  const audit = { record: jest.fn() };
  return { manager: new SettingsManager(tenants as never, secrets as never, mailer as never, audit as never), tenants, secrets, mailer };
}

describe('SettingsManager', () => {
  it('never exposes the SMTP password', async () => {
    const { manager } = build();
    const result = await manager.get(user as never);
    expect(result.email.passwordConfigured).toBe(true);
    expect(result.email).not.toHaveProperty('password');
  });

  it('preserves the stored password when update leaves it empty', async () => {
    const { manager, tenants, secrets } = build();
    await manager.updateEmail(user as never, { host: 'smtp.new', port: 587, secure: false, username: 'user', password: '', fromEmail: 'oficina@test.com', enabled: true });
    expect(secrets.encrypt).not.toHaveBeenCalled();
    expect(tenants.updateSettings).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ smtpPassword: 'encrypted-old' }));
  });

  it('rejects oversized logos', async () => {
    const { manager } = build();
    const logo = `data:image/png;base64,${Buffer.alloc(500 * 1024 + 1).toString('base64')}`;
    await expect(manager.updateCompany(user as never, { name: 'Oficina', document: '123', logoDataUrl: logo })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sends a real test through the tenant mailer', async () => {
    const { manager, mailer } = build();
    await manager.sendTest(user as never, 'owner@test.com');
    expect(mailer.send).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ to: 'owner@test.com' }));
  });

  it('saves the opening hours with unique, ordered working days and refuses an inverted day', async () => {
    const tenants = { updateSettings: jest.fn().mockImplementation(async (_id: string, data: Record<string, unknown>) => ({ id: 'tenant-1', ...data })) };
    const audit = { record: jest.fn() };
    const manager = new SettingsManager(tenants as never, {} as never, {} as never, audit as never);
    const user = { tenantId: 'tenant-1', userId: 'user-1' } as never;

    const result = await manager.updateAgendaHours(user, { openHour: 7, closeHour: 17, workDays: [6, 1, 1, 3] });
    expect(result.agendaHours).toEqual({ openHour: 7, closeHour: 17, workDays: [1, 3, 6], bays: null, remindersEnabled: false });
    await expect(manager.updateAgendaHours(user, { openHour: 18, closeHour: 8, workDays: [1] })).rejects.toThrow('fechamento');
  });
});
