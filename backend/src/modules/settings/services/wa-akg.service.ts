import { BadGatewayException, BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { UpdateWhatsAppSettingsRequest, WhatsAppConnectionResponse, WhatsAppSettingsResponse, WhatsAppWebhookTestResponse } from '@oficina/contracts';
import { TenantRepository } from '../../iam/repositories/tenant.repository';
import { SecretEncryptionService } from './secret-encryption.service';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import { EntitlementsService } from '../../../shared/plan/entitlements.service';

export interface WaAkgConnection { baseUrl: string; sessionId: string; apiKey: string }
const clean = (value?: string) => value?.trim() || null;

@Injectable()
export class WaAkgService {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly secrets: SecretEncryptionService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async getSettings(tenantId: string): Promise<WhatsAppSettingsResponse> {
    const tenant = await this.requireTenant(tenantId);
    const publicApi = this.config.get<string>('PUBLIC_API_URL') ?? this.config.get<string>('NEXT_PUBLIC_API_URL', 'http://localhost:3001');
    return {
      baseUrl: tenant.waAkgBaseUrl ?? undefined, sessionId: tenant.waAkgSessionId ?? undefined,
      apiKeyConfigured: Boolean(tenant.waAkgApiKey), webhookSecretConfigured: Boolean(tenant.waAkgWebhookSecret), enabled: tenant.waAkgEnabled,
      webhookUrl: `${publicApi.replace(/\/$/, '')}/api/v1/webhooks/wa-akg/${tenantId}`,
      connectionTestAt: tenant.waAkgTestedAt?.toISOString(), connectionSuccessAt: tenant.waAkgTestSuccessAt?.toISOString(), connectionTestError: tenant.waAkgTestError ?? undefined,
      webhookTestAt: tenant.waWebhookTestedAt?.toISOString(), webhookSuccessAt: tenant.waWebhookTestSuccessAt?.toISOString(), webhookTestError: tenant.waWebhookTestError ?? undefined,
    };
  }

  async update(user: AuthenticatedUser, input: UpdateWhatsAppSettingsRequest) {
    const current = await this.requireTenant(user.tenantId);
    const baseUrl = clean(input.baseUrl) ? this.normalizeBaseUrl(input.baseUrl!) : null;
    const sessionId = clean(input.sessionId);
    if (sessionId && !/^[a-zA-Z0-9_-]+$/.test(sessionId)) throw new BadRequestException('A sessão deve conter apenas letras, números, hífen ou sublinhado.');
    const apiKey = clean(input.apiKey);
    const webhookSecret = clean(input.webhookSecret);
    if (webhookSecret && webhookSecret.length < 32) throw new BadRequestException('Use um segredo do webhook com pelo menos 32 caracteres.');
    if (apiKey && /[\r\n]/.test(apiKey)) throw new BadRequestException('Chave de API inválida.');
    if (input.enabled && (!baseUrl || !sessionId || !(apiKey || current.waAkgApiKey) || !(webhookSecret || current.waAkgWebhookSecret))) {
      throw new BadRequestException('Informe endereço, sessão, chave de API e segredo do webhook antes de ativar o WhatsApp.');
    }
    await this.tenants.updateSettings(user.tenantId, {
      waAkgBaseUrl: baseUrl, waAkgSessionId: sessionId,
      waAkgApiKey: apiKey ? this.secrets.encrypt(apiKey) : current.waAkgApiKey,
      waAkgWebhookSecret: webhookSecret ? this.secrets.encrypt(webhookSecret) : current.waAkgWebhookSecret,
      waAkgEnabled: input.enabled,
      waAkgTestedAt: null, waAkgTestSuccessAt: null, waAkgTestError: null,
      waWebhookTestedAt: null, waWebhookTestSuccessAt: null, waWebhookTestError: null,
    });
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'settings.whatsapp_updated', entity: 'tenant', entityId: user.tenantId, metadata: { enabled: input.enabled } });
    return this.getSettings(user.tenantId);
  }

  async getConnection(tenantId: string, requireEnabled = true): Promise<WaAkgConnection | null> {
    const tenant = await this.requireTenant(tenantId);
    if (requireEnabled && !tenant.waAkgEnabled) return null;
    // Every automatic or manual send asks for the connection here, so a plan without WhatsApp stops them all in one place.
    if (requireEnabled && !(await this.entitlements.forTenant(tenantId)).modules.includes('whatsapp')) return null;
    if (!tenant.waAkgBaseUrl || !tenant.waAkgSessionId || !tenant.waAkgApiKey) throw new BadRequestException('Configure a conexão com o WA-AKG antes de continuar.');
    return { baseUrl: this.normalizeBaseUrl(tenant.waAkgBaseUrl), sessionId: tenant.waAkgSessionId, apiKey: this.secrets.decrypt(tenant.waAkgApiKey) };
  }

  async testConnection(tenantId: string): Promise<WhatsAppConnectionResponse> {
    const testedAt = new Date();
    try {
      const connection = (await this.getConnection(tenantId, false))!;
      const response = await this.request(connection, '/sessions');
      const sessions = Array.isArray(response) ? response : isRecord(response) && Array.isArray(response.data) ? response.data : null;
      const session = sessions?.find((item: unknown) => isRecord(item) && item.sessionId === connection.sessionId) as Record<string, unknown> | undefined;
      if (!session) throw new BadRequestException('A sessão informada não foi encontrada ou a chave de API não possui acesso a ela.');
      const status = typeof session.status === 'string' ? session.status : 'Unknown';
      const connected = status.toLowerCase() === 'connected';
      await this.tenants.updateSettings(tenantId, { waAkgTestedAt: testedAt, ...(connected ? { waAkgTestSuccessAt: testedAt } : {}), waAkgTestError: connected ? null : `Sessão desconectada (${status}).` });
      return { connected, status };
    } catch (error) {
      await this.tenants.updateSettings(tenantId, { waAkgTestedAt: testedAt, waAkgTestError: error instanceof Error ? error.message.slice(0, 500) : 'Falha no teste da conexão.' });
      throw error;
    }
  }

  async sendButtons(connection: WaAkgConnection, input: { recipient: string; message: string; question: string; options: string[]; token: string }) {
    const result = await this.request(connection, `/messages/${encodeURIComponent(connection.sessionId)}/${encodeURIComponent(input.recipient)}/interactive`, {
      method: 'POST', body: JSON.stringify({
        body: `${input.message}\n\n${input.question}`,
        footer: '👇 Toque em uma opção para registrar sua resposta. Válido por 7 dias.',
        buttons: input.options.length > 3 ? [{ type: 'single_select', displayText: 'Avaliar serviço', title: 'Avaliar serviço', sections: [{ title: 'Escolha sua nota', rows: input.options.map((label, index) => ({ title: label, id: `axm:${input.token}:${index}` })) }] }] : input.options.map((label, index) => ({ type: 'quick_reply', displayText: label, id: `axm:${input.token}:${index}` })),
      }),
    });
    if (!isRecord(result) || result.status !== true) throw new BadGatewayException('O WA-AKG não confirmou o envio. Confira o histórico antes de tentar novamente.');
    const data = isRecord(result.data) ? result.data : null;
    const key = data && isRecord(data.key) ? data.key : null;
    return { providerMessageId: key && typeof key.id === 'string' ? key.id : undefined };
  }

  async sendConfirmation(connection: WaAkgConnection, recipient: string, option: string) {
    return this.sendNotice(connection, recipient, `📩 *Sua resposta foi registrada:* ${option}.\n\n🔔 A equipe da oficina recebeu sua escolha.`);
  }

  async sendNotice(connection: WaAkgConnection, recipient: string, text: string) {
    const result = await this.request(connection, `/messages/${encodeURIComponent(connection.sessionId)}/${encodeURIComponent(recipient)}/send`, {
      method: 'POST', body: JSON.stringify({ message: { text } }),
    }, 5_000);
    if (!isRecord(result) || result.status !== true) throw new BadGatewayException('O WA-AKG não confirmou o envio da confirmação.');
  }

  async testWebhook(tenantId: string): Promise<WhatsAppWebhookTestResponse> {
    const testedAt = new Date();
    try { return await this.performWebhookTest(tenantId, testedAt); }
    catch (error) {
      await this.tenants.updateSettings(tenantId, { waWebhookTestedAt: testedAt, waWebhookTestError: error instanceof Error ? error.message.slice(0, 500) : 'Falha no teste de recebimento.' });
      throw error;
    }
  }

  private async performWebhookTest(tenantId: string, testedAt: Date): Promise<WhatsAppWebhookTestResponse> {
    const tenant = await this.requireTenant(tenantId);
    if (!tenant.waAkgEnabled || !tenant.waAkgWebhookSecret) throw new BadRequestException('Salve o segredo e ative a integração antes de testar o recebimento.');
    const { webhookUrl } = await this.getSettings(tenantId);
    const body = JSON.stringify({ event: 'test', sessionId: tenant.waAkgSessionId, timestamp: new Date().toISOString(), data: {} });
    const signature = `sha256=${createHmac('sha256', this.secrets.decrypt(tenant.waAkgWebhookSecret)).update(body).digest('hex')}`;
    let response: Response;
    try {
      response = await fetch(webhookUrl, { method: 'POST', body, headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new BadGatewayException('Não foi possível acessar a URL pública do webhook. Confira o domínio da API e o proxy ou túnel.');
    }
    if (!response.headers.get('content-type')?.includes('application/json')) throw new BadRequestException('A URL do webhook retornou HTML ou outro conteúdo inesperado. Ela deve apontar para a API do Ofix. Confira PUBLIC_BACKEND_URL e o roteamento de /api/* no proxy ou túnel.');
    if (response.status === 401) throw new BadRequestException('O webhook recusou a assinatura. Confira se a URL aponta para esta oficina e se a integração está ativa no backend de destino.');
    if (response.status !== 200) throw new BadRequestException(`O webhook retornou HTTP ${response.status}. Confira a URL pública e se o backend está atualizado.`);
    let result: unknown;
    try { result = await response.json(); } catch { throw new BadRequestException('A URL pública não retornou JSON válido do Ofix.'); }
    if (!isRecord(result) || result.received !== true || result.recorded !== false) throw new BadRequestException('A URL respondeu, mas não confirmou o teste do webhook do Ofix. Confira o domínio e o caminho completos.');
    await this.tenants.updateSettings(tenantId, { waWebhookTestedAt: testedAt, waWebhookTestSuccessAt: testedAt, waWebhookTestError: null });
    return { reachable: true, webhookUrl };
  }

  async verifyWebhook(tenantId: string, signature: string | undefined, rawBody: Buffer) {
    const tenant = await this.tenants.byId(tenantId);
    if (!tenant?.waAkgEnabled || !tenant.waAkgWebhookSecret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) throw new UnauthorizedException('Webhook não autorizado.');
    const expected = createHmac('sha256', this.secrets.decrypt(tenant.waAkgWebhookSecret)).update(rawBody).digest();
    const actual = Buffer.from(signature.slice(7), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new UnauthorizedException('Webhook não autorizado.');
    return { sessionId: tenant.waAkgSessionId };
  }

  private normalizeBaseUrl(input: string) {
    let url: URL;
    try { url = new URL(input.trim()); } catch { throw new BadRequestException('Informe um endereço HTTPS válido para o WA-AKG.'); }
    // Credentials are sent only to an explicit HTTPS hostname, never through redirects.
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || isIP(hostname) || hostname === 'localhost' || !hostname.includes('.') || /\.(local|internal|localhost)$/.test(hostname)) {
      throw new BadRequestException('Use o endereço HTTPS público do WA-AKG, sem credenciais, parâmetros ou IP local.');
    }
    const allowedHosts = this.config.get<string>('WA_AKG_ALLOWED_HOSTS', 'chat.axcloud.com.br').split(',').map((host) => host.trim().toLowerCase());
    if (!allowedHosts.includes(hostname) || (url.port && url.port !== '443')) throw new BadRequestException('Este servidor não está autorizado para o WA-AKG. Configure o domínio em WA_AKG_ALLOWED_HOSTS na API.');
    const path = url.pathname.replace(/\/+$/, '');
    url.pathname = path.endsWith('/api') ? path : `${path}/api`;
    return url.toString().replace(/\/$/, '');
  }

  private async request(connection: WaAkgConnection, path: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${connection.baseUrl}${path}`, {
        ...init, headers: { 'X-API-Key': connection.apiKey, 'Content-Type': 'application/json' },
        redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new BadGatewayException('Não foi possível confirmar a operação no WA-AKG. Confira a conexão e o histórico antes de tentar novamente.');
    }
    if ([401, 403].includes(response.status)) throw new BadRequestException('O WA-AKG recusou a chave de API ou o acesso à sessão.');
    if (response.status === 404) throw new BadRequestException('Endpoint não encontrado no WA-AKG. Confira o endereço e se a versão possui suporte a botões (1.7.0 ou superior).');
    if (!response.ok) throw new BadGatewayException('O WA-AKG não confirmou a operação. Confira a sessão e o histórico antes de tentar novamente.');
    try { return await response.json(); } catch { throw new BadGatewayException('O WA-AKG retornou uma resposta inválida.'); }
  }

  private async requireTenant(tenantId: string) {
    const tenant = await this.tenants.byId(tenantId);
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    return tenant;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
