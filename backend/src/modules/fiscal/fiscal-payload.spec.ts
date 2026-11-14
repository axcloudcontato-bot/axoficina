import { allocateDiscount, buildCompanyPayload, buildMerchandisePayload, buildNfsePayload, fiscalReadiness, previewDocument, type FiscalConfig, type FiscalCustomer, type FiscalOrder, type FiscalTenant } from './fiscal-payload';

const tenant: FiscalTenant = {
  name: 'Oficina Boa', legalName: 'Oficina Boa LTDA', document: '11.222.333/0001-81', stateRegistration: '123.456.789', phone: '(11) 99999-0000', email: 'contato@oficina.test',
  addressStreet: 'Rua A', addressNumber: '10', addressDistrict: 'Centro', addressCity: 'São Paulo', addressState: 'SP', addressPostalCode: '01001-000',
};

const config: FiscalConfig = {
  environment: 'HOMOLOGACAO', taxRegime: 'SIMPLES_NACIONAL', municipalRegistration: '1234567', cityIbgeCode: '3550308', cnae: '4520-0/01',
  nfseEnabled: true, nfeEnabled: true, nfceEnabled: true, serviceListItem: '14.01', issRatePercent: 2, issWithheld: false,
  defaultNcm: '87089990', defaultCfop: '5102', csosn: '102', pisCofinsCst: '49', nfceCscId: '1', hasNfceCsc: true, certificateUploaded: true, companyRegistered: true,
};

const customer: FiscalCustomer = {
  type: 'PF', document: '529.982.247-25', name: 'Maria Cliente', email: 'maria@cliente.test', phone: '11988887777',
  address: { street: 'Rua B', number: '20', neighborhood: 'Vila', city: 'São Paulo', state: 'SP', zipCode: '02002-000' },
};

const order: FiscalOrder = {
  orderNumber: 42, vehicleLabel: 'VW Gol', vehiclePlate: 'ABC1D23', discountCents: 1000, paymentMethod: 'PIX',
  items: [
    { id: 'labor-1', type: 'LABOR', description: 'Troca de óleo', quantity: 1, unitPriceCents: 6000 },
    { id: 'part-1', type: 'PART', description: 'Filtro de óleo', quantity: 2, unitPriceCents: 2000, ncm: '84212300', unit: 'un', code: 'FO-1' },
    { id: 'part-2', type: 'PRODUCT', description: 'Óleo 5W30', quantity: 1, unitPriceCents: 0 },
  ],
};

describe('allocateDiscount', () => {
  it('splits the order discount in proportion to each item and never loses a cent', () => {
    const shares = allocateDiscount(order.items, 1000);
    expect(shares.get('labor-1')).toBe(600);
    expect(shares.get('part-1')).toBe(400);
    expect(shares.get('part-2')).toBe(0);
    const odd = allocateDiscount([{ id: 'a', type: 'LABOR', description: 'a', quantity: 1, unitPriceCents: 100 }, { id: 'b', type: 'LABOR', description: 'b', quantity: 1, unitPriceCents: 100 }, { id: 'c', type: 'LABOR', description: 'c', quantity: 1, unitPriceCents: 100 }], 100);
    expect([...odd.values()].reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it('caps the discount at the gross value and handles empty orders', () => {
    expect(allocateDiscount([{ id: 'a', type: 'LABOR', description: 'a', quantity: 1, unitPriceCents: 500 }], 9999).get('a')).toBe(500);
    expect(allocateDiscount([], 100).size).toBe(0);
  });
});

describe('previewDocument', () => {
  it('puts labor on the NFS-e and parts on the NF-e, each with its share of the discount', () => {
    const nfse = previewDocument('NFSE', order, customer, config);
    expect(nfse.items.map((item) => item.id)).toEqual(['labor-1']);
    expect(nfse.amountCents).toBe(5400);
    expect(nfse.problems).toEqual([]);
    const nfe = previewDocument('NFE', order, customer, config);
    expect(nfe.items.map((item) => item.id)).toEqual(['part-1', 'part-2']);
    expect(nfe.amountCents).toBe(3600);
    expect(nfe.items[1].ncm).toBe('87089990');
    expect(nfe.warnings.some((warning) => warning.includes('NCM padrão'))).toBe(true);
    expect(nfe.warnings.some((warning) => warning.includes('homologação'))).toBe(true);
  });

  it('blocks an NF-e without the customer document or full address and an empty note', () => {
    const preview = previewDocument('NFE', order, { ...customer, document: '', address: { city: 'São Paulo' } }, config);
    expect(preview.problems).toEqual(expect.arrayContaining(['A NF-e exige o CPF ou CNPJ do cliente.', 'A NF-e exige o endereço completo do cliente, com CEP.']));
    expect(previewDocument('NFSE', { ...order, items: order.items.filter((item) => item.type !== 'LABOR') }, customer, config).problems[0]).toContain('mão de obra');
    expect(previewDocument('NFSE', { ...order, items: [{ id: 'z', type: 'LABOR', description: 'x', quantity: 1, unitPriceCents: 0 }] }, customer, config).problems[0]).toContain('zerado');
  });

  it('warns but allows an NFS-e for a customer without document, and checks company address and large NFC-e', () => {
    const preview = previewDocument('NFSE', order, { ...customer, document: '', email: '' }, { ...config, environment: 'PRODUCAO' });
    expect(preview.problems).toEqual([]);
    expect(preview.warnings).toEqual(expect.arrayContaining([expect.stringContaining('sem CPF/CNPJ'), expect.stringContaining('sem e-mail')]));
    expect(previewDocument('NFSE', order, { ...customer, document: '11222333000181', address: null }, config).problems[0]).toContain('CNPJ');
    expect(previewDocument('NFSE', order, { ...customer, document: '123' }, config).problems[0]).toContain('incompleto');
    const big: FiscalOrder = { ...order, discountCents: 0, items: [{ id: 'p', type: 'PART', description: 'Motor', quantity: 1, unitPriceCents: 2_000_000 }] };
    expect(previewDocument('NFCE', big, { ...customer, document: '' }, config).problems[0]).toContain('10.000');
  });
});

describe('fiscalReadiness', () => {
  it('is ready when everything is configured', () => {
    expect(fiscalReadiness(tenant, config, true)).toEqual({ NFSE: [], NFE: [], NFCE: [] });
  });

  it('lists what is missing for each document', () => {
    const readiness = fiscalReadiness({ ...tenant, document: '52998224725', stateRegistration: '', addressPostalCode: '' }, { ...config, municipalRegistration: '', cityIbgeCode: '', certificateUploaded: false, taxRegime: 'NORMAL', nfceCscId: '', nfeEnabled: false }, false);
    expect(readiness.NFSE).toEqual(expect.arrayContaining([expect.stringContaining('não está ativa'), expect.stringContaining('CNPJ'), expect.stringContaining('endereço'), expect.stringContaining('certificado'), 'Informe a inscrição municipal.', expect.stringContaining('IBGE')]));
    expect(readiness.NFE[0]).toBe('NF-e desativada nas configurações.');
    expect(readiness.NFE).toEqual(expect.arrayContaining([expect.stringContaining('inscrição estadual'), expect.stringContaining('Simples Nacional')]));
    expect(readiness.NFCE).toEqual(expect.arrayContaining([expect.stringContaining('CSC')]));
    expect(fiscalReadiness(tenant, { ...config, companyRegistered: false, nfseEnabled: false }, true).NFSE).toEqual(['NFS-e desativada nas configurações.', expect.stringContaining('cadastro da oficina')]);
  });
});

describe('payloads', () => {
  const issuedAt = new Date('2026-11-13T12:00:00Z');

  it('builds the NFS-e with provider, customer, discount and description', () => {
    const preview = previewDocument('NFSE', order, customer, config);
    const payload = buildNfsePayload({ tenant, config, order, customer, preview, customerCityIbgeCode: '3550308', issuedAt });
    expect(payload).toMatchObject({
      prestador: { cnpj: '11222333000181', inscricao_municipal: '1234567', codigo_municipio: '3550308' },
      optante_simples_nacional: true,
      regime_especial_tributacao: '6',
      tomador: { cpf: '52998224725', razao_social: 'Maria Cliente', email: 'maria@cliente.test', endereco: { codigo_municipio: '3550308', cep: '02002000', uf: 'SP' } },
      servico: { valor_servicos: 60, desconto_incondicionado: 6, aliquota: 2, item_lista_servico: '14.01', codigo_cnae: '4520001', iss_retido: false, discriminacao: expect.stringContaining('OS 00042') },
    });
    expect(payload).toHaveProperty('servico.discriminacao', expect.stringContaining('Troca de óleo'));
  });

  it('builds the NFS-e for MEI and normal regimes and leaves the address out without a city code', () => {
    const preview = previewDocument('NFSE', { ...order, discountCents: 0 }, { ...customer, document: '11222333000181', email: '', phone: '' }, { ...config, issRatePercent: null, cnae: null });
    const mei = buildNfsePayload({ tenant, config: { ...config, taxRegime: 'MEI' }, order, customer: { ...customer, document: '11222333000181' }, preview, issuedAt });
    expect(mei).toMatchObject({ regime_especial_tributacao: '5', tomador: { cnpj: '11222333000181' } });
    expect(mei).not.toHaveProperty('tomador.endereco');
    const normal = buildNfsePayload({ tenant, config: { ...config, taxRegime: 'NORMAL', issRatePercent: null, cnae: null, municipalTaxCode: '0101' }, order, customer: { ...customer, document: '' }, preview, issuedAt });
    expect(normal).toMatchObject({ optante_simples_nacional: false, servico: { codigo_tributario_municipio: '0101' } });
    expect(normal).not.toHaveProperty('regime_especial_tributacao');
    expect(normal).not.toHaveProperty('servico.aliquota');
  });

  it('builds the NF-e with items, CFOP, payment and recipient', () => {
    const preview = previewDocument('NFE', order, customer, config);
    const payload = buildMerchandisePayload('NFE', { tenant, config, order, customer, preview, issuedAt });
    expect(payload).toMatchObject({
      cnpj_emitente: '11222333000181', local_destino: 1, cpf_destinatario: '52998224725', indicador_inscricao_estadual_destinatario: 9,
      items: [{ numero_item: 1, codigo_produto: 'FO-1', cfop: '5102', codigo_ncm: '84212300', unidade_comercial: 'UN', quantidade_comercial: 2, valor_bruto: 40, valor_desconto: 4, icms_situacao_tributaria: '102', pis_situacao_tributaria: '49' }, expect.anything()],
      formas_pagamento: [{ forma_pagamento: '17', valor_pagamento: 36 }],
    });
  });

  it('switches to interstate CFOP for another state and flags a contributor company', () => {
    const company: FiscalCustomer = { ...customer, document: '11222333000181', stateRegistration: '111.222.333', address: { ...customer.address, state: 'RJ' }, phone: '', email: '' };
    const preview = previewDocument('NFE', order, company, config);
    const payload = buildMerchandisePayload('NFE', { tenant, config, order: { ...order, paymentMethod: null }, customer: company, preview, issuedAt });
    expect(payload).toMatchObject({
      local_destino: 2, cnpj_destinatario: '11222333000181', indicador_inscricao_estadual_destinatario: 1, consumidor_final: 0,
      items: [{ cfop: '6102' }, expect.anything()],
      formas_pagamento: [{ forma_pagamento: '99', valor_pagamento: 36, descricao_pagamento: 'Outros' }],
    });
  });

  it('builds an NFC-e without recipient when the customer has no document', () => {
    const anonymous = { ...customer, document: '' };
    const preview = previewDocument('NFCE', order, anonymous, config);
    const payload = buildMerchandisePayload('NFCE', { tenant, config, order, customer: anonymous, preview, issuedAt });
    expect(payload).toMatchObject({ consumidor_final: 1, items: [expect.anything(), { codigo_produto: 'part-2' }] });
    expect(payload).not.toHaveProperty('nome_destinatario');
    expect(payload).not.toHaveProperty('tipo_documento');
    const identified = buildMerchandisePayload('NFCE', { tenant, config, order, customer, preview, issuedAt });
    expect(identified).toMatchObject({ cpf_destinatario: '52998224725' });
    expect(identified).not.toHaveProperty('logradouro_destinatario');
  });

  it('builds the company registration with certificate and NFC-e CSC only when given', () => {
    const payload = buildCompanyPayload({ tenant, config, nfceCsc: 'CSC-SECRET', certificate: { dataBase64: 'AAA=', password: 'senha' } });
    expect(payload).toMatchObject({ nome: 'Oficina Boa LTDA', nome_fantasia: 'Oficina Boa', cnpj: '11222333000181', inscricao_estadual: '123456789', inscricao_municipal: '1234567', regime_tributario: 1, cep: '01001000', codigo_municipio: '3550308', habilita_nfse: true, csc_nfce_producao: 'CSC-SECRET', id_token_nfce_producao: '1', arquivo_certificado_base64: 'AAA=', senha_certificado: 'senha' });
    const minimal = buildCompanyPayload({ tenant: { ...tenant, legalName: null, stateRegistration: null, email: null, phone: null }, config: { ...config, taxRegime: 'NORMAL', municipalRegistration: null, cityIbgeCode: null, nfceEnabled: false } });
    expect(minimal).toMatchObject({ nome: 'Oficina Boa', regime_tributario: 3 });
    for (const key of ['inscricao_estadual', 'arquivo_certificado_base64', 'csc_nfce_producao']) expect(minimal).not.toHaveProperty(key);
  });
});
