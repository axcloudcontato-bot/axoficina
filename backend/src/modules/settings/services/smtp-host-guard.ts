import { BadRequestException } from '@nestjs/common';
import { promises as dns } from 'node:dns';
import { BlockList, isIP } from 'node:net';

// Ports SMTP providers actually use. Anything else turns the "test e-mail" button into a way to knock on other services.
export const SMTP_PORTS = [25, 465, 587, 2525] as const;

// Addresses that are never a public mail server: loopback, private networks, link-local (cloud metadata),
// carrier-grade NAT, multicast and reserved ranges, in IPv4 and IPv6.
const blocked = new BlockList();
for (const [network, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) blocked.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) blocked.addSubnet(network, prefix, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicAddress(mapped[1]);
  const family = isIP(address);
  if (!family) return false;
  return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

const UNSAFE = 'Use o endereço público do servidor SMTP do seu provedor (por exemplo smtp.seudominio.com.br), na porta 25, 465, 587 ou 2525.';

// Checked when saving: a name with a dot, not an internal name or a private IP, on a mail port.
export function assertSmtpHostShape(host: string, port: number): void {
  const name = host.trim().toLowerCase().replace(/\.$/, '');
  if (!(SMTP_PORTS as readonly number[]).includes(port)) throw new BadRequestException(UNSAFE);
  if (isIP(name)) { if (!isPublicAddress(name)) throw new BadRequestException(UNSAFE); return; }
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name) || /\.(local|localhost|internal|lan|home|corp)$/.test(name) || name === 'localhost') throw new BadRequestException(UNSAFE);
}

// Checked on every connection: resolves the name and connects to the address that was checked, so a DNS answer that
// changes between the check and the connection (DNS rebinding) cannot point it at the internal network.
export async function resolvePublicSmtpHost(host: string, port: number, lookup: typeof dns.lookup = dns.lookup): Promise<string> {
  assertSmtpHostShape(host, port);
  const name = host.trim().replace(/\.$/, '');
  if (isIP(name)) return name;
  let addresses: Array<{ address: string }>;
  try { addresses = await lookup(name, { all: true, verbatim: true }); }
  catch { throw new BadRequestException('Não foi possível encontrar o servidor SMTP informado. Confira o endereço.'); }
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) throw new BadRequestException(UNSAFE);
  return addresses[0].address;
}
