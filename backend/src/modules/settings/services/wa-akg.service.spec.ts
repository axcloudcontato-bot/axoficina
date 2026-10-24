import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { WaAkgService } from './wa-akg.service';
import { SecretEncryptionService } from './secret-encryption.service';

const secret = 'webhook-secret-'.repeat(4);
const config = new ConfigService({ SETTINGS_ENCRYPTION_KEY: 'test-encryption-key', PUBLIC_API_URL: 'https://api.oficina.example' });
function setup() {
  const secrets = new SecretEncryptionService(config);
  let tenant = { id: 'tenant-a', waAkgBaseUrl: 'https://chat.axcloud.com.br/api', waAkgSessionId: 'oficina', waAkgEnabled: true, waAkgApiKey: secrets.encrypt('private-api-key'), waAkgWebhookSecret: secrets.encrypt(secret) };
  const tenants = { byId: jest.fn(async () => tenant), updateSettings: jest.fn(async (_id, changes) => { tenant = { ...tenant, ...changes }; return tenant; }) };
  const audit = { record: jest.fn() };
  const service = new WaAkgService(tenants as never, secrets, config, audit as never);
  return { service, tenants, tenant, secrets };
}

describe('WA-AKG connection', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stores encrypted credentials, preserves empty secrets and never returns them', async () => {
    const { service, tenants, secrets } = setup();
    const result = await service.update({ tenantId: 'tenant-a', userId: 'user-a', role: 'ADMIN' }, { baseUrl: 'https://chat.axcloud.com.br/', sessionId: 'oficina', apiKey: 'new-private-key', webhookSecret: secret, enabled: true });
    const stored = tenants.updateSettings.mock.calls[0][1];
    expect(stored.waAkgApiKey).not.toBe('new-private-key');
    expect(secrets.decrypt(stored.waAkgApiKey)).toBe('new-private-key');
    expect(JSON.stringify(result)).not.toContain('new-private-key');
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result).toMatchObject({ enabled: true, apiKeyConfigured: true, webhookSecretConfigured: true, webhookUrl: 'https://api.oficina.example/api/v1/webhooks/wa-akg/tenant-a' });
    await service.update({ tenantId: 'tenant-a', userId: 'user-a', role: 'ADMIN' }, { baseUrl: 'https://chat.axcloud.com.br/api', sessionId: 'oficina', apiKey: '', webhookSecret: '', enabled: true });
    expect(tenants.updateSettings.mock.calls[1][1].waAkgApiKey).toBe(stored.waAkgApiKey);
  });

  it('checks session access with a read-only request and no message send', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ sessionId: 'oficina', status: 'Connected' }]), { status: 200 }));
    const { service } = setup();
    await expect(service.testConnection('tenant-a')).resolves.toEqual({ connected: true, status: 'Connected' });
    expect(fetchMock).toHaveBeenCalledWith('https://chat.axcloud.com.br/api/sessions', expect.objectContaining({ headers: { 'X-API-Key': 'private-api-key', 'Content-Type': 'application/json' }, redirect: 'error' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('formats native quick reply buttons and captures the gateway message id', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: true, data: { key: { id: 'provider-message' } } }), { status: 200 }));
    const { service } = setup();
    const connection = (await service.getConnection('tenant-a'))!;
    await expect(service.sendButtons(connection, { recipient: '5511999998888@s.whatsapp.net', message: 'Orçamento', question: 'Aprova?', options: ['Aprovar', 'Recusar'], token: 'a'.repeat(64) })).resolves.toEqual({ providerMessageId: 'provider-message' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://chat.axcloud.com.br/api/messages/oficina/5511999998888%40s.whatsapp.net/interactive');
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toMatchObject({ body: 'Orçamento\n\nAprova?', buttons: [{ type: 'quick_reply', displayText: 'Aprovar', id: `axm:${'a'.repeat(64)}:0` }, { type: 'quick_reply', displayText: 'Recusar', id: `axm:${'a'.repeat(64)}:1` }] });
  });

  it('verifies HMAC over the original bytes and rejects modified bodies or missing signatures', async () => {
    const { service } = setup();
    const body = Buffer.from('{ "sessionId":"oficina", "display_text":"Aprovar" }');
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    await expect(service.verifyWebhook('tenant-a', signature, body)).resolves.toEqual({ sessionId: 'oficina' });
    await expect(service.verifyWebhook('tenant-a', signature, Buffer.from('{}'))).rejects.toThrow('não autorizado');
    await expect(service.verifyWebhook('tenant-a', undefined, body)).rejects.toThrow('não autorizado');
  });

  it.each(['http://chat.axcloud.com.br', 'https://127.0.0.1', 'https://localhost', 'https://user:password@chat.axcloud.com.br', 'https://untrusted.example', 'https://chat.axcloud.com.br:444', 'https://chat.axcloud.com.br?key=secret'])('rejects an unapproved or unsafe gateway URL: %s', async (baseUrl) => {
    const { service } = setup();
    await expect(service.update({ tenantId: 'tenant-a', userId: 'user-a', role: 'ADMIN' }, { baseUrl, sessionId: 'oficina', enabled: true })).rejects.toThrow();
  });

  it('does not leak gateway errors or keys on rejected requests', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('private-api-key', { status: 401 }));
    const { service } = setup();
    await expect(service.testConnection('tenant-a')).rejects.toThrow('recusou a chave');
  });

  it('keeps manual sharing available when the integration is disabled', async () => {
    const { service, tenant } = setup();
    tenant.waAkgEnabled = false;
    await expect(service.getConnection('tenant-a')).resolves.toBeNull();
  });
});
