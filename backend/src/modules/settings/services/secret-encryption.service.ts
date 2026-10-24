import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

@Injectable()
export class SecretEncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const source = config.get<string>('SETTINGS_ENCRYPTION_KEY') ?? config.get<string>('JWT_SECRET');
    if (!source) throw new Error('SETTINGS_ENCRYPTION_KEY ou JWT_SECRET deve estar configurada.');
    this.key = createHash('sha256').update(source).digest();
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(value: string): string {
    try {
      const [version, iv, tag, encrypted] = value.split(':');
      if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('invalid');
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
    } catch {
      throw new BadRequestException('A credencial armazenada não pôde ser lida. Cadastre o segredo novamente.');
    }
  }
}
