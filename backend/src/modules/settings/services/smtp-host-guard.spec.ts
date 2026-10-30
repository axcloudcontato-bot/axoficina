import { assertSmtpHostShape, isPublicAddress, resolvePublicSmtpHost } from './smtp-host-guard';

const resolvingTo = (...addresses: string[]) => jest.fn().mockResolvedValue(addresses.map(address => ({ address, family: address.includes(':') ? 6 : 4 })));

describe('smtp host guard', () => {
  it('tells public addresses from internal ones', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '172.18.0.5', '192.168.0.250', '169.254.169.254', '100.64.1.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) expect(isPublicAddress(address)).toBe(false);
    for (const address of ['8.8.8.8', '203.0.113.10', '2606:4700::1111', '::ffff:8.8.8.8']) expect(isPublicAddress(address)).toBe(true);
  });

  it('rejects internal names, private IPs and ports that are not SMTP when saving', () => {
    for (const [host, port] of [['redis', 587], ['postgres', 587], ['localhost', 25], ['backend', 465], ['mail.empresa.local', 587], ['10.0.0.5', 587], ['smtp.gmail.com', 6379], ['smtp.gmail.com', 5432]] as const) {
      expect(() => assertSmtpHostShape(host, port)).toThrow('servidor SMTP do seu provedor');
    }
    expect(() => assertSmtpHostShape('smtp.titan.email', 465)).not.toThrow();
    expect(() => assertSmtpHostShape('SMTP.Gmail.com.', 587)).not.toThrow();
  });

  it('refuses a public name that resolves to the internal network (DNS rebinding included)', async () => {
    await expect(resolvePublicSmtpHost('smtp.attacker.com', 587, resolvingTo('203.0.113.10', '127.0.0.1') as never)).rejects.toThrow('servidor SMTP do seu provedor');
    await expect(resolvePublicSmtpHost('smtp.attacker.com', 587, resolvingTo('172.18.0.3') as never)).rejects.toThrow('servidor SMTP do seu provedor');
  });

  it('returns the checked address to connect to', async () => {
    await expect(resolvePublicSmtpHost('smtp.titan.email', 465, resolvingTo('203.0.113.10') as never)).resolves.toBe('203.0.113.10');
    await expect(resolvePublicSmtpHost('smtp.inexistente.com', 587, jest.fn().mockRejectedValue(new Error('ENOTFOUND')) as never)).rejects.toThrow('Não foi possível encontrar');
  });
});
