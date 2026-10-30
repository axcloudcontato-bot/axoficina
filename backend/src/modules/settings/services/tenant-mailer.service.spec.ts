import { BadRequestException } from '@nestjs/common';
import { TenantMailerService } from './tenant-mailer.service';

const sendMail = jest.fn();
jest.mock('nodemailer', () => {
  const createTransport = jest.fn(() => ({ sendMail: (...args: unknown[]) => sendMail(...args) }));
  return { createTransport, default: { createTransport } };
});

// The SMTP name is resolved before connecting; tests never touch real DNS.
const lookup = jest.fn();
jest.mock('node:dns', () => ({ promises: { lookup: (...args: unknown[]) => lookup(...args) } }));

const tenant = {
  id: 'tenant-1', smtpEnabled: true, smtpHost: 'smtp.titan.email', smtpPort: 465, smtpSecure: true,
  smtpUsername: 'contato@axcloud.com.br', smtpPassword: 'encrypted-pass', smtpFromName: 'Oficina',
  smtpFromEmail: 'atendimento@oficina.com.br', smtpReplyTo: null, name: 'Oficina Teste',
};

function build() {
  const tenants = { byId: jest.fn().mockResolvedValue(tenant) };
  const secrets = { decrypt: jest.fn().mockReturnValue('plain-pass') };
  return { service: new TenantMailerService(tenants as never, secrets as never) };
}

describe('TenantMailerService', () => {
  beforeEach(() => { sendMail.mockReset(); lookup.mockReset().mockResolvedValue([{ address: '203.0.113.10', family: 4 }]); });

  it('sends through nodemailer when the SMTP server accepts it', async () => {
    sendMail.mockResolvedValue({ messageId: 'abc' });
    const { service } = build();
    await expect(service.send('tenant-1', { to: 'a@b.com', subject: 'Oi' })).resolves.toEqual({ messageId: 'abc' });
  });

  it('translates an auth failure into a message pointing at the credentials', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('Invalid login'), { code: 'EAUTH', response: '535 Authentication failed' }));
    const { service } = build();
    const promise = service.send('tenant-1', { to: 'a@b.com', subject: 'Oi' });
    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toMatchObject({ message: expect.stringContaining('autenticação') });
  });

  it('translates a connection failure into a message pointing at host/port/TLS', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNECTION' }));
    const { service } = build();
    await expect(service.send('tenant-1', { to: 'a@b.com', subject: 'Oi' })).rejects.toMatchObject({
      message: expect.stringContaining('conectar ao servidor SMTP'),
    });
  });

  it('translates a sender/recipient rejection (e.g. from-address not matching the authenticated account)', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('Sender address rejected'), {
      code: 'EENVELOPE',
      response: "553 5.7.1 <atendimento@oficina.com.br>: Sender address rejected: not owned by user contato@axcloud.com.br",
    }));
    const { service } = build();
    await expect(service.send('tenant-1', { to: 'a@b.com', subject: 'Oi' })).rejects.toMatchObject({
      message: expect.stringContaining('not owned by user'),
    });
  });

  it('connects to the checked public address and keeps the typed name for TLS', async () => {
    sendMail.mockResolvedValue({ messageId: 'abc' });
    const { service } = build();
    await service.send('tenant-1', { to: 'a@b.com', subject: 'Oi' });
    const nodemailer = jest.requireMock('nodemailer') as { createTransport: jest.Mock };
    expect(nodemailer.createTransport).toHaveBeenLastCalledWith(expect.objectContaining({ host: '203.0.113.10', tls: { servername: 'smtp.titan.email' } }));
  });

  it('never connects when the SMTP server points at the internal network', async () => {
    lookup.mockResolvedValue([{ address: '172.18.0.4', family: 4 }]);
    const { service } = build();
    await expect(service.send('tenant-1', { to: 'a@b.com', subject: 'Oi' })).rejects.toBeInstanceOf(BadRequestException);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
