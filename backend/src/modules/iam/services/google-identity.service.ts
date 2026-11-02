import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createPublicKey, verify } from 'node:crypto';

interface GoogleClaims {
  iss?: string;
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  exp?: number;
  iat?: number;
}

interface GoogleKey { kid: string; kty: string; n: string; e: string; alg?: string; use?: string }

@Injectable()
export class GoogleIdentityService {
  private keys: GoogleKey[] = [];
  private keysExpireAt = 0;

  async verifyCredential(credential: string): Promise<{ subject: string; email: string; name: string }> {
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (!audience) throw new ServiceUnavailableException('Entrada com Google não configurada.');
    const parts = credential.split('.');
    if (parts.length !== 3 || parts.some((part) => !part)) throw new UnauthorizedException('Credencial Google inválida.');
    let header: { alg?: string; kid?: string };
    let claims: GoogleClaims;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Credencial Google inválida.');
    }
    if (header.alg !== 'RS256' || !header.kid) throw new UnauthorizedException('Credencial Google inválida.');
    const matches = (item: GoogleKey) => item.kid === header.kid && item.kty === 'RSA' && (!item.alg || item.alg === 'RS256') && (!item.use || item.use === 'sig');
    const key = (await this.getKeys()).find(matches) ?? (await this.getKeys(true)).find(matches);
    if (!key) throw new UnauthorizedException('Credencial Google inválida.');
    let valid = false;
    try {
      valid = verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: { kty: key.kty, n: key.n, e: key.e }, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
    } catch {
      throw new UnauthorizedException('Credencial Google inválida.');
    }
    const now = Math.floor(Date.now() / 1000);
    if (!valid || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss ?? '') || claims.aud !== audience || !claims.sub || !claims.email || claims.email_verified !== true || !claims.exp || claims.exp <= now || !claims.iat || claims.iat > now + 60) {
      throw new UnauthorizedException('Credencial Google inválida.');
    }
    return { subject: claims.sub, email: claims.email.toLowerCase(), name: claims.name?.trim() || claims.email };
  }

  private async getKeys(force = false): Promise<GoogleKey[]> {
    if (!force && Date.now() < this.keysExpireAt && this.keys.length) return this.keys;
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Google certificates unavailable');
      const body = await response.json() as { keys?: GoogleKey[] };
      if (!Array.isArray(body.keys) || !body.keys.length) throw new Error('Google certificates unavailable');
      const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] ?? 300);
      this.keys = body.keys;
      this.keysExpireAt = Date.now() + Math.min(maxAge, 3600) * 1000;
      return this.keys;
    } catch {
      throw new ServiceUnavailableException('Não foi possível confirmar a conta Google agora. Tente novamente.');
    }
  }
}
