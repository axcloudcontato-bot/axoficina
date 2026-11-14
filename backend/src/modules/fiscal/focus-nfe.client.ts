import { Injectable, Logger, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FiscalDocumentKind, FiscalDocumentStatus, FiscalEnvironment } from '@oficina/contracts';

// Focus NFe REST API (https://focusnfe.com.br/doc/). The Ofix account acts as a reseller: its token registers each
// workshop (POST/PUT /v2/empresas) and each workshop gets its own production and homologation tokens to issue with.
const PATHS: Record<FiscalDocumentKind, string> = { NFSE: 'nfse', NFE: 'nfe', NFCE: 'nfce' };
const TIMEOUT_MS = 30_000;

export interface FocusCompany {
  id: string;
  tokenProduction?: string;
  tokenHomologation?: string;
  certificateValidUntil?: Date;
}

export interface FocusDocumentResult {
  status: FiscalDocumentStatus;
  number?: string;
  series?: string;
  verificationCode?: string;
  accessKey?: string;
  issuedAt?: Date;
  pdfUrl?: string;
  xmlUrl?: string;
  errorMessage?: string;
}

// The provider never saw this reference (lost request): the document can be issued again.
export class FocusNotFoundError extends Error {}

type FocusBody = Record<string, unknown> & { mensagem?: string; erros?: Array<{ mensagem?: string; correcao?: string }> };

@Injectable()
export class FocusNfeClient {
  private readonly logger = new Logger(FocusNfeClient.name);
  private readonly resellerToken?: string;
  private readonly productionUrl: string;
  private readonly homologationUrl: string;

  constructor(config: ConfigService) {
    this.resellerToken = config.get<string>('FOCUS_NFE_TOKEN')?.trim() || undefined;
    this.productionUrl = (config.get<string>('FOCUS_NFE_URL') || 'https://api.focusnfe.com.br').replace(/\/$/, '');
    this.homologationUrl = (config.get<string>('FOCUS_NFE_HOMOLOGATION_URL') || 'https://homologacao.focusnfe.com.br').replace(/\/$/, '');
  }

  get available(): boolean {
    return Boolean(this.resellerToken);
  }

  async saveCompany(companyId: string | null | undefined, payload: Record<string, unknown>): Promise<FocusCompany> {
    if (!this.resellerToken) throw new ServiceUnavailableException('A emissão de notas ainda não está configurada neste servidor.');
    const body = await this.request(companyId ? 'PUT' : 'POST', `${this.productionUrl}/v2/empresas${companyId ? `/${encodeURIComponent(companyId)}` : ''}`, this.resellerToken, payload);
    const id = body.id === undefined || body.id === null ? companyId : String(body.id);
    if (!id) throw new UnprocessableEntityException('O emissor não devolveu o cadastro da oficina.');
    const validUntil = typeof body.certificado_valido_ate === 'string' ? new Date(body.certificado_valido_ate) : undefined;
    return {
      id,
      tokenProduction: typeof body.token_producao === 'string' ? body.token_producao : undefined,
      tokenHomologation: typeof body.token_homologacao === 'string' ? body.token_homologacao : undefined,
      certificateValidUntil: validUntil && !Number.isNaN(validUntil.getTime()) ? validUntil : undefined,
    };
  }

  async issue(kind: FiscalDocumentKind, environment: FiscalEnvironment, token: string, ref: string, payload: Record<string, unknown>): Promise<FocusDocumentResult> {
    const base = this.baseUrl(environment);
    const body = await this.request('POST', `${base}/v2/${PATHS[kind]}?ref=${encodeURIComponent(ref)}`, token, payload);
    return this.toResult(body, base);
  }

  async status(kind: FiscalDocumentKind, environment: FiscalEnvironment, token: string, ref: string): Promise<FocusDocumentResult> {
    const base = this.baseUrl(environment);
    const body = await this.request('GET', `${base}/v2/${PATHS[kind]}/${encodeURIComponent(ref)}`, token);
    return this.toResult(body, base);
  }

  async cancel(kind: FiscalDocumentKind, environment: FiscalEnvironment, token: string, ref: string, reason: string): Promise<FocusDocumentResult> {
    const base = this.baseUrl(environment);
    const body = await this.request('DELETE', `${base}/v2/${PATHS[kind]}/${encodeURIComponent(ref)}`, token, { justificativa: reason });
    const result = this.toResult(body, base);
    if (result.status !== 'CANCELLED') throw new UnprocessableEntityException(result.errorMessage ?? 'O cancelamento não foi aceito. Confira o prazo de cancelamento da nota.');
    return result;
  }

  private baseUrl(environment: FiscalEnvironment): string {
    return environment === 'PRODUCAO' ? this.productionUrl : this.homologationUrl;
  }

  private toResult(body: FocusBody, base: string): FocusDocumentResult {
    const raw = String(body.status ?? '');
    const status: FiscalDocumentStatus = raw === 'autorizado' ? 'AUTHORIZED' : raw === 'cancelado' ? 'CANCELLED' : raw.startsWith('processando') ? 'PROCESSING' : 'ERROR';
    const link = (value: unknown) => (typeof value === 'string' && value ? (value.startsWith('http') ? value : `${base}${value.startsWith('/') ? '' : '/'}${value}`) : undefined);
    const text = (value: unknown) => (value === undefined || value === null || value === '' ? undefined : String(value));
    const issuedAt = typeof body.data_emissao === 'string' ? new Date(body.data_emissao) : undefined;
    return {
      status,
      number: text(body.numero),
      series: text(body.serie),
      verificationCode: text(body.codigo_verificacao),
      accessKey: text(body.chave_nfe)?.replace(/^NFe/, ''),
      issuedAt: issuedAt && !Number.isNaN(issuedAt.getTime()) ? issuedAt : undefined,
      pdfUrl: link(body.caminho_danfe) ?? link(body.url_danfse) ?? link(body.url),
      xmlUrl: link(body.caminho_xml_nota_fiscal),
      errorMessage: status === 'ERROR' ? describeErrors(body) ?? 'O emissor recusou a nota.' : undefined,
    };
  }

  private async request(method: string, url: string, token: string, body?: Record<string, unknown>): Promise<FocusBody> {
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: { Authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`Emissor fiscal indisponível (${method} ${new URL(url).pathname}): ${error instanceof Error ? error.message : String(error)}`);
      // 503, never 502/504: Cloudflare would replace the body.
      throw new ServiceUnavailableException('O emissor de notas não respondeu. Tente de novo em alguns minutos.');
    }
    const parsed = (await response.json().catch(() => ({}))) as FocusBody;
    if (response.status === 404) throw new FocusNotFoundError(describeErrors(parsed) ?? 'Nota não encontrada no emissor.');
    if (response.status === 401 || response.status === 403) throw new UnprocessableEntityException('O emissor recusou o acesso da oficina. Envie o certificado e salve as configurações fiscais de novo.');
    if (response.status >= 500) throw new ServiceUnavailableException('O emissor de notas está com instabilidade. Tente de novo em alguns minutos.');
    // 4xx with a document status (e.g. rejected NF-e) is a normal answer; other 4xx are validation errors.
    if (!response.ok && !parsed.status) throw new UnprocessableEntityException(describeErrors(parsed) ?? 'O emissor recusou os dados enviados.');
    return parsed;
  }
}

export function describeErrors(body: FocusBody): string | undefined {
  const fromList = (body.erros ?? []).map((error) => [error.mensagem, error.correcao].filter(Boolean).join(' ')).filter(Boolean);
  const sefaz = typeof body.mensagem_sefaz === 'string' ? body.mensagem_sefaz : undefined;
  const message = [...fromList, sefaz, typeof body.mensagem === 'string' ? body.mensagem : undefined].filter(Boolean);
  return message.length ? [...new Set(message)].join(' · ').slice(0, 1000) : undefined;
}
