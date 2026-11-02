import { createSign, generateKeyPairSync } from 'node:crypto';
import { GoogleIdentityService } from './google-identity.service';

describe('GoogleIdentityService', () => {
  const originalFetch = global.fetch;
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  const service = new GoogleIdentityService();

  function credential(overrides: Record<string, unknown> = {}) {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: 'ofix-client', sub: 'google-person-1', email: 'user@gmail.com', email_verified: true, name: 'Pessoa', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...overrides })).toString('base64url');
    const data = `${header}.${payload}`;
    const signature = createSign('RSA-SHA256').update(data).sign(privateKey).toString('base64url');
    return `${data}.${signature}`;
  }

  beforeAll(() => {
    process.env.GOOGLE_CLIENT_ID = 'ofix-client';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: { get: () => 'public, max-age=300' }, json: async () => ({ keys: [{ ...jwk, kid: 'test-key' }] }) }) as never;
  });
  afterAll(() => {
    global.fetch = originalFetch;
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalClientId;
  });

  it('accepts a correctly signed Google token for this client', async () => {
    await expect(service.verifyCredential(credential())).resolves.toEqual({ subject: 'google-person-1', email: 'user@gmail.com', name: 'Pessoa' });
  });

  it('rejects another audience, an unverified email, expiry, and a changed signature', async () => {
    await expect(service.verifyCredential(credential({ aud: 'another-client' }))).rejects.toThrow('Credencial Google inválida');
    await expect(service.verifyCredential(credential({ email_verified: false }))).rejects.toThrow('Credencial Google inválida');
    await expect(service.verifyCredential(credential({ exp: 1 }))).rejects.toThrow('Credencial Google inválida');
    const tampered = credential().replace('user@gmail.com', 'x@gmail.com');
    await expect(service.verifyCredential(`${tampered.slice(0, -3)}abc`)).rejects.toThrow('Credencial Google inválida');
  });
});
