import { BadRequestException, Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { TenantRepository } from '../../iam/repositories/tenant.repository';
import { SecretEncryptionService } from './secret-encryption.service';

@Injectable()
export class TenantMailerService {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly secrets: SecretEncryptionService,
  ) {}

  async send(tenantId: string, input: { to: string; subject: string; text?: string; html?: string }) {
    const tenant = await this.tenants.byId(tenantId);
    if (!tenant?.smtpEnabled || !tenant.smtpHost || !tenant.smtpFromEmail) {
      throw new BadRequestException('Configure e ative o envio de e-mail antes de continuar.');
    }
    const transporter = nodemailer.createTransport({
      host: tenant.smtpHost,
      port: tenant.smtpPort,
      secure: tenant.smtpSecure,
      auth: tenant.smtpUsername && tenant.smtpPassword
        ? { user: tenant.smtpUsername, pass: this.secrets.decrypt(tenant.smtpPassword) }
        : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    try {
      return await transporter.sendMail({
        from: { name: tenant.smtpFromName || tenant.name, address: tenant.smtpFromEmail },
        replyTo: tenant.smtpReplyTo || undefined,
        ...input,
      });
    } catch (error) {
      // Sem isso, o HttpExceptionFilter trata qualquer exceção não-HTTP como
      // 500 genérico ("Erro interno do servidor.") — a causa real (senha
      // errada, host/porta incorretos, TLS, ou o provedor rejeitando o
      // remetente por não bater com a conta autenticada, comum em
      // Titan/Zoho/Gmail) nunca chega na tela de quem está configurando.
      throw new BadRequestException(describeSmtpError(error));
    }
  }
}

interface SmtpError {
  code?: string;
  responseCode?: number;
  response?: string;
  message?: string;
}

function describeSmtpError(error: unknown): string {
  const smtpError = error as SmtpError;
  const detail = smtpError.response?.trim() || smtpError.message || 'Erro desconhecido.';
  switch (smtpError.code) {
    case 'EAUTH':
      return `Falha na autenticação SMTP — confira o usuário e a senha. Detalhe do servidor: ${detail}`;
    case 'ECONNECTION':
    case 'ESOCKET':
      return `Não foi possível conectar ao servidor SMTP — confira host, porta e a opção de conexão SSL/TLS. Detalhe: ${detail}`;
    case 'ETIMEDOUT':
      return `Tempo esgotado ao conectar ao servidor SMTP. Confira host, porta e firewall. Detalhe: ${detail}`;
    case 'EENVELOPE':
      return `O servidor SMTP rejeitou o remetente ou o destinatário — em alguns provedores o e-mail remetente precisa ser o mesmo (ou um alias) da conta autenticada. Detalhe: ${detail}`;
    default:
      if (smtpError.responseCode && smtpError.responseCode >= 500) {
        return `O servidor SMTP recusou o envio: ${detail}`;
      }
      return `Não foi possível enviar o e-mail: ${detail}`;
  }
}
