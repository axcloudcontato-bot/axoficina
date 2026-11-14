import { ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describeErrors, FocusNfeClient, FocusNotFoundError } from './focus-nfe.client';
import { IbgeCityService, normalizeCityName } from './ibge-city.service';

const config = (values: Record<string, string | undefined>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;
const reply = (status: number, body: unknown) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);

describe('FocusNfeClient', () => {
  const fetchMock = jest.fn();
  beforeEach(() => { fetchMock.mockReset(); global.fetch = fetchMock as unknown as typeof fetch; });

  const client = () => new FocusNfeClient(config({ FOCUS_NFE_TOKEN: 'reseller' }));

  it('is unavailable without the reseller token and refuses to register companies', async () => {
    const off = new FocusNfeClient(config({}));
    expect(off.available).toBe(false);
    await expect(off.saveCompany(null, {})).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('creates and updates the company with the reseller token and returns its tokens', async () => {
    fetchMock.mockReturnValueOnce(reply(200, { id: 77, token_producao: 'prod', token_homologacao: 'homo', certificado_valido_ate: '2027-05-01T00:00:00-03:00' }));
    const created = await client().saveCompany(null, { cnpj: '1' });
    expect(created).toEqual({ id: '77', tokenProduction: 'prod', tokenHomologation: 'homo', certificateValidUntil: new Date('2027-05-01T03:00:00Z') });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.focusnfe.com.br/v2/empresas');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('reseller:').toString('base64')}`);
    fetchMock.mockReturnValueOnce(reply(200, { certificado_valido_ate: 'invalid' }));
    expect(await client().saveCompany('77', {})).toEqual({ id: '77', tokenProduction: undefined, tokenHomologation: undefined, certificateValidUntil: undefined });
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.focusnfe.com.br/v2/empresas/77');
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    fetchMock.mockReturnValueOnce(reply(200, {}));
    await expect(client().saveCompany(null, {})).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('issues in homologation and maps an authorized NF-e with absolute links', async () => {
    fetchMock.mockReturnValueOnce(reply(201, { status: 'autorizado', numero: 15, serie: '1', chave_nfe: 'NFe3526', caminho_danfe: '/arquivos/danfe.pdf', caminho_xml_nota_fiscal: 'arquivos/nota.xml', data_emissao: '2026-11-13T10:00:00-03:00' }));
    const result = await client().issue('NFE', 'HOMOLOGACAO', 'company', 'ofix-1', { a: 1 });
    expect(fetchMock.mock.calls[0][0]).toBe('https://homologacao.focusnfe.com.br/v2/nfe?ref=ofix-1');
    expect(result).toMatchObject({ status: 'AUTHORIZED', number: '15', series: '1', accessKey: '3526', pdfUrl: 'https://homologacao.focusnfe.com.br/arquivos/danfe.pdf', xmlUrl: 'https://homologacao.focusnfe.com.br/arquivos/nota.xml' });
    expect(result.issuedAt?.toISOString()).toBe('2026-11-13T13:00:00.000Z');
  });

  it('maps processing, rejected NFS-e and status reads in production', async () => {
    fetchMock.mockReturnValueOnce(reply(202, { status: 'processando_autorizacao' }));
    expect((await client().issue('NFSE', 'PRODUCAO', 'company', 'r', {})).status).toBe('PROCESSING');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.focusnfe.com.br/v2/nfse?ref=r');
    fetchMock.mockReturnValueOnce(reply(200, { status: 'erro_autorizacao', erros: [{ mensagem: 'Inscrição municipal inválida', correcao: 'Confira o cadastro.' }] }));
    const rejected = await client().status('NFSE', 'PRODUCAO', 'company', 'r');
    expect(rejected).toMatchObject({ status: 'ERROR', errorMessage: 'Inscrição municipal inválida Confira o cadastro.' });
    expect(fetchMock.mock.calls[1][1].method).toBe('GET');
    fetchMock.mockReturnValueOnce(reply(200, { status: 'autorizado', numero: '9', codigo_verificacao: 'ABC', url: 'https://prefeitura.test/nota/9' }));
    expect(await client().status('NFSE', 'PRODUCAO', 'company', 'r')).toMatchObject({ status: 'AUTHORIZED', verificationCode: 'ABC', pdfUrl: 'https://prefeitura.test/nota/9' });
    fetchMock.mockReturnValueOnce(reply(422, { status: 'erro_autorizacao', mensagem_sefaz: 'Rejeição: NCM inexistente' }));
    expect(await client().issue('NFCE', 'PRODUCAO', 'company', 'r', {})).toMatchObject({ status: 'ERROR', errorMessage: 'Rejeição: NCM inexistente' });
  });

  it('cancels with the justification and refuses when the provider does not confirm', async () => {
    fetchMock.mockReturnValueOnce(reply(200, { status: 'cancelado', caminho_xml_cancelamento: '/x.xml' }));
    expect((await client().cancel('NFE', 'PRODUCAO', 'company', 'r', 'Cliente desistiu da compra')).status).toBe('CANCELLED');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ justificativa: 'Cliente desistiu da compra' });
    fetchMock.mockReturnValueOnce(reply(200, { status: 'erro_cancelamento', mensagem: 'Prazo de cancelamento expirado' }));
    await expect(client().cancel('NFE', 'PRODUCAO', 'company', 'r', 'Cliente desistiu da compra')).rejects.toThrow('Prazo de cancelamento expirado');
    fetchMock.mockReturnValueOnce(reply(200, { status: 'autorizado' }));
    await expect(client().cancel('NFE', 'PRODUCAO', 'company', 'r', 'Cliente desistiu da compra')).rejects.toThrow('prazo de cancelamento');
  });

  it('translates transport and HTTP failures into 422/503 and 404 into a not-found error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(client().status('NFE', 'PRODUCAO', 't', 'r')).rejects.toBeInstanceOf(ServiceUnavailableException);
    fetchMock.mockReturnValueOnce(reply(404, { mensagem: 'Nota fiscal não encontrada' }));
    await expect(client().status('NFE', 'PRODUCAO', 't', 'r')).rejects.toBeInstanceOf(FocusNotFoundError);
    fetchMock.mockReturnValueOnce(reply(401, {}));
    await expect(client().status('NFE', 'PRODUCAO', 't', 'r')).rejects.toBeInstanceOf(UnprocessableEntityException);
    fetchMock.mockReturnValueOnce(reply(500, {}));
    await expect(client().status('NFE', 'PRODUCAO', 't', 'r')).rejects.toBeInstanceOf(ServiceUnavailableException);
    fetchMock.mockReturnValueOnce(reply(400, { mensagem: 'CNPJ inválido' }));
    await expect(client().saveCompany(null, {})).rejects.toThrow('CNPJ inválido');
    fetchMock.mockReturnValueOnce(Promise.resolve({ ok: false, status: 400, json: () => Promise.reject(new Error('html')) } as unknown as Response));
    await expect(client().saveCompany(null, {})).rejects.toThrow('recusou os dados');
  });

  it('uses custom URLs and describes errors without duplicates', () => {
    const custom = new FocusNfeClient(config({ FOCUS_NFE_TOKEN: 't', FOCUS_NFE_URL: 'https://prod.test/', FOCUS_NFE_HOMOLOGATION_URL: 'https://homo.test/' }));
    fetchMock.mockReturnValueOnce(reply(200, { status: 'autorizado' }));
    void custom.status('NFE', 'HOMOLOGACAO', 't', 'r');
    expect(fetchMock.mock.calls[0][0]).toBe('https://homo.test/v2/nfe/r');
    expect(describeErrors({ mensagem: 'A', erros: [{ mensagem: 'A' }] })).toBe('A');
    expect(describeErrors({})).toBeUndefined();
  });
});

describe('IbgeCityService', () => {
  const fetchMock = jest.fn();
  beforeEach(() => { fetchMock.mockReset(); global.fetch = fetchMock as unknown as typeof fetch; });

  it('finds the city code ignoring accents and caches each state', async () => {
    fetchMock.mockReturnValueOnce(reply(200, [{ id: 3550308, nome: 'São Paulo' }, { id: 3509502, nome: 'Campinas' }]));
    const service = new IbgeCityService();
    expect(await service.codeFor('sao paulo', 'sp')).toBe('3550308');
    expect(await service.codeFor('CAMPINAS', 'SP')).toBe('3509502');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await service.codeFor('', 'SP')).toBeUndefined();
    expect(await service.codeFor('Rio', 'XYZ')).toBeUndefined();
  });

  it('returns nothing when the IBGE API fails', async () => {
    const service = new IbgeCityService();
    fetchMock.mockReturnValueOnce(reply(500, {}));
    expect(await service.codeFor('Niterói', 'RJ')).toBeUndefined();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await service.codeFor('Niterói', 'RJ')).toBeUndefined();
    expect(normalizeCityName("  Santa Bárbara d'Oeste ")).toBe('santa barbara d oeste');
  });
});
