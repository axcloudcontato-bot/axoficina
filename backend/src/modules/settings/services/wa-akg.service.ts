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

  // The platform key (WA_AKG_API_KEY, server environment only) serves every workshop. When it is set the workshop
  // neither sees nor sends a key, a server or a session: the SaaS manager assigns the session in the subscription.
  private get platformKey() { return this.config.get<string>('WA_AKG_API_KEY')?.trim() || null; }
  private get platformBaseUrl() { return this.config.get<string>('WA_AKG_BASE_URL')?.trim() || 'https://chat.axcloud.com.br'; }

  async getSettings(tenantId: string): Promise<WhatsAppSettingsResponse> {
    const tenant = await this.requireTenant(tenantId);
    const managed = Boolean(this.platformKey);
    const publicApi = this.config.get<string>('PUBLIC_API_URL') ?? this.config.get<string>('NEXT_PUBLIC_API_URL', 'http://localhost:3001');
    return {
      managed,
      baseUrl: (managed ? this.platformBaseUrl : tenant.waAkgBaseUrl) ?? undefined, sessionId: tenant.waAkgSessionId ?? undefined,
      apiKeyConfigured: managed || Boolean(tenant.waAkgApiKey), webhookSecretConfigured: Boolean(tenant.waAkgWebhookSecret), enabled: tenant.waAkgEnabled,
      webhookUrl: `${publicApi.replace(/\/$/, '')}/api/v1/webhooks/wa-akg/${tenantId}`,
      connectionTestAt: tenant.waAkgTestedAt?.toISOString(), connectionSuccessAt: tenant.waAkgTestSuccessAt?.toISOString(), connectionTestError: tenant.waAkgTestError ?? undefined,
      webhookTestAt: tenant.waWebhookTestedAt?.toISOString(), webhookSuccessAt: tenant.waWebhookTestSuccessAt?.toISOString(), webhookTestError: tenant.waWebhookTestError ?? undefined,
    };
  }

  async update(user: AuthenticatedUser, input: UpdateWhatsAppSettingsRequest) {
    const current = await this.requireTenant(user.tenantId);
    const managed = Boolean(this.platformKey);
    // With the platform key the workshop cannot choose the server, the session or a key of its own.
    const baseUrl = managed ? current.waAkgBaseUrl : clean(input.baseUrl) ? this.normalizeBaseUrl(input.baseUrl!) : null;
    const sessionId = managed ? current.waAkgSessionId : clean(input.sessionId);
    if (sessionId && !/^[a-zA-Z0-9_-]+$/.test(sessionId)) throw new BadRequestException('A sessão deve conter apenas letras, números, hífen ou sublinhado.');
    const apiKey = managed ? null : clean(input.apiKey);
    const webhookSecret = clean(input.webhookSecret);
    if (webhookSecret && webhookSecret.length < 32) throw new BadRequestException('Use um segredo do webhook com pelo menos 32 caracteres.');
    if (apiKey && /[\r\n]/.test(apiKey)) throw new BadRequestException('Chave de API inválida.');
    if (input.enabled && managed && !sessionId) throw new BadRequestException('O número de WhatsApp desta oficina ainda não foi liberado pelo Ax Cloud. Fale com o suporte.');
    if (input.enabled && !managed && (!baseUrl || !sessionId || !(apiKey || current.waAkgApiKey))) {
      throw new BadRequestException('Informe endereço, sessão e chave de API antes de ativar o WhatsApp.');
    }
    if (input.enabled && !(webhookSecret || current.waAkgWebhookSecret)) throw new BadRequestException('Informe o segredo do webhook antes de ativar o WhatsApp.');
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
    if (requireEnabled) {
      const { modules, access } = await this.entitlements.forTenant(tenantId);
      // A view-only account sends nothing either: no reminders or notices leave while the subscription is not active.
      if (!modules.includes('whatsapp') || access?.state === 'suspended') return null;
    }
    const platformKey = this.platformKey;
    const baseUrl = platformKey ? this.platformBaseUrl : tenant.waAkgBaseUrl;
    if (!baseUrl || !tenant.waAkgSessionId || !(platformKey || tenant.waAkgApiKey)) throw new BadRequestException('Configure a conexão com o WA-AKG antes de continuar.');
    return { baseUrl: this.normalizeBaseUrl(baseUrl), sessionId: tenant.waAkgSessionId, apiKey: platformKey ?? this.secrets.decrypt(tenant.waAkgApiKey!) };
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

  async configureWebhook(user: AuthenticatedUser): Promise<WhatsAppWebhookTestResponse> {
    const tenant = await this.requireTenant(user.tenantId);
    if (!tenant.waAkgEnabled || !tenant.waAkgWebhookSecret) throw new BadRequestException('Ative a integração e salve o segredo antes de configurar o webhook.');
    const connection = (await this.getConnection(user.tenantId, false))!;
    const { webhookUrl } = await this.getSettings(user.tenantId);
    const path = `/webhooks/${encodeURIComponent(connection.sessionId)}`;
    const list = await this.request(connection, path);
    const hooks = isRecord(list) && list.status === true && Array.isArray(list.data) ? list.data : null;
    if (!hooks) throw new BadGatewayException('O WA-AKG não retornou os webhooks da sessão. Confira o acesso da chave de API.');
    const secret = this.secrets.decrypt(tenant.waAkgWebhookSecret);
    const alreadyConfigured = hooks.some((item: unknown) => isRecord(item) && item.url === webhookUrl && item.isActive === true && item.secret === secret && Array.isArray(item.events) && item.events.some((event: unknown) => event === 'message.received' || event === '*'));
    if (alreadyConfigured) return this.testWebhook(user.tenantId);
    // Only edit a webhook attached to this session and this workshop URL. A
    // global hook or another workshop's hook must never be changed here.
    const existing = hooks.find((item: unknown) => isRecord(item) && item.url === webhookUrl && isRecord(item.session) && item.session.sessionId === connection.sessionId);
    if (isRecord(existing) && typeof existing.id === 'string') {
      const events = Array.isArray(existing.events) ? existing.events.filter((event): event is string => typeof event === 'string') : [];
      if (!events.includes('message.received') && !events.includes('*')) events.push('message.received');
      if (existing.isActive !== true || existing.secret !== secret || !Array.isArray(existing.events) || !existing.events.includes('message.received') && !existing.events.includes('*')) {
        await this.request(connection, `${path}/${encodeURIComponent(existing.id)}`, { method: 'PUT', body: JSON.stringify({ isActive: true, events, secret }) });
      }
    } else {
      const created = await this.request(connection, path, { method: 'POST', body: JSON.stringify({ name: 'Ofix - respostas dos clientes', url: webhookUrl, events: ['message.received'], secret }) });
      if (!isRecord(created) || created.status !== true) throw new BadGatewayException('O WA-AKG não confirmou o cadastro do webhook.');
    }
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'settings.whatsapp_webhook_configured', entity: 'tenant', entityId: user.tenantId, metadata: { webhookUrl } });
    return this.testWebhook(user.tenantId);
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
    // A direct call proves only that our public endpoint works. A real reply also
    // needs a webhook registered for this exact session in the gateway.
    const connection = (await this.getConnection(tenantId, false))!;
    const hooksResponse = await this.request(connection, `/webhooks/${encodeURIComponent(connection.sessionId)}`);
    const hooks = isRecord(hooksResponse) && hooksResponse.status === true && Array.isArray(hooksResponse.data) ? hooksResponse.data : null;
    if (!hooks) throw new BadGatewayException('O WA-AKG não retornou os webhooks da sessão. Confira o acesso da chave de API.');
    const matchingHooks = hooks.filter((item: unknown): item is Record<string, unknown> => isRecord(item) && item.url === webhookUrl && item.isActive === true);
    if (!matchingHooks.length) throw new BadRequestException('Nenhum webhook ativo desta sessão aponta para a URL exibida. Cadastre ou ative o webhook no WA-AKG.');
    const eventHooks = matchingHooks.filter((item) => Array.isArray(item.events) && item.events.some((event: unknown) => event === 'message.received' || event === '*'));
    if (!eventHooks.length) throw new BadRequestException('O webhook da sessão não recebe o evento message.received. Adicione esse evento no WA-AKG.');
    const expectedSecret = this.secrets.decrypt(tenant.waAkgWebhookSecret);
    const hook = eventHooks.find((item) => typeof item.secret === 'string' && item.secret === expectedSecret);
    if (!hook) throw new BadRequestException('O segredo do webhook no WA-AKG difere do segredo salvo nesta oficina. Configure o mesmo valor nos dois lados.');
    if (typeof hook.id !== 'string') throw new BadGatewayException('O WA-AKG retornou um webhook sem identificador válido.');
    const gatewayTest = await this.request(connection, `/webhooks/${encodeURIComponent(connection.sessionId)}/${encodeURIComponent(hook.id)}/test`, { method: 'POST' });
    const delivery = isRecord(gatewayTest) && isRecord(gatewayTest.data) ? gatewayTest.data : null;
    let gatewayResponse: unknown;
    try { gatewayResponse = typeof delivery?.responseBody === 'string' ? JSON.parse(delivery.responseBody) : null; } catch { gatewayResponse = null; }
    if (!delivery || delivery.success !== true || delivery.statusCode !== 200 || !isRecord(gatewayResponse) || gatewayResponse.received !== true || gatewayResponse.recorded !== false) throw new BadRequestException('O teste enviado pelo WA-AKG não foi confirmado pelo Ofix. Confira a URL, o segredo e os logs do webhook no WA-AKG.');
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
