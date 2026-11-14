import { FISCAL_KIND_ITEM_TYPES, type CustomerAddress, type FiscalDocumentKind, type FiscalPreviewItem, type FiscalReadiness, type FiscalTaxRegime, type PaymentMethod } from '@oficina/contracts';

// Plain shapes the payload builders work on, so they can be tested without the database.
export interface FiscalTenant {
  name: string;
  legalName?: string | null;
  document: string;
  stateRegistration?: string | null;
  phone?: string | null;
  email?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressDistrict?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostalCode?: string | null;
}

export interface FiscalConfig {
  environment: string;
  taxRegime: string;
  municipalRegistration?: string | null;
  cityIbgeCode?: string | null;
  cnae?: string | null;
  nfseEnabled: boolean;
  nfeEnabled: boolean;
  nfceEnabled: boolean;
  serviceListItem: string;
  municipalTaxCode?: string | null;
  issRatePercent?: number | null;
  issWithheld: boolean;
  defaultNcm: string;
  defaultCfop: string;
  csosn: string;
  pisCofinsCst: string;
  nfceCscId?: string | null;
  hasNfceCsc: boolean;
  certificateUploaded: boolean;
  companyRegistered: boolean;
}

export interface FiscalCustomer {
  type: string;
  document?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  stateRegistration?: string | null;
  address?: CustomerAddress | null;
}

export interface FiscalOrderItem {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  ncm?: string | null;
  unit?: string | null;
  code?: string | null;
}

export interface FiscalOrder {
  orderNumber: number;
  vehicleLabel: string;
  vehiclePlate: string;
  discountCents: number;
  paymentMethod?: PaymentMethod | null;
  items: FiscalOrderItem[];
}

export interface FiscalPreview {
  items: FiscalPreviewItem[];
  amountCents: number;
  discountCents: number;
  problems: string[];
  warnings: string[];
}

export const onlyDigits = (value?: string | null) => (value ?? '').replace(/\D/g, '');
const reais = (cents: number) => Number((cents / 100).toFixed(2));
const isSimples = (regime: string) => ['SIMPLES_NACIONAL', 'MEI', 'SIMPLES_EXCESSO'].includes(regime);
const itemTotal = (item: FiscalOrderItem) => Math.round(item.quantity * item.unitPriceCents);

// Splits the order discount across every item in proportion to its value, so each document carries its share.
export function allocateDiscount(items: FiscalOrderItem[], discountCents: number): Map<string, number> {
  const totals = items.map((item) => ({ id: item.id, total: itemTotal(item) }));
  const gross = totals.reduce((sum, item) => sum + item.total, 0);
  const result = new Map<string, number>(totals.map((item) => [item.id, 0]));
  const discount = Math.min(Math.max(0, discountCents), gross);
  if (!gross || !discount) return result;
  const shares = totals.map((item) => { const exact = (discount * item.total) / gross; return { id: item.id, base: Math.floor(exact), rest: exact - Math.floor(exact) }; });
  let left = discount - shares.reduce((sum, share) => sum + share.base, 0);
  for (const share of [...shares].sort((left, right) => right.rest - left.rest)) {
    if (left <= 0) break;
    share.base += 1;
    left -= 1;
  }
  for (const share of shares) result.set(share.id, share.base);
  return result;
}

function addressComplete(address?: CustomerAddress | null): boolean {
  return Boolean(address?.street?.trim() && address.number?.trim() && address.neighborhood?.trim() && address.city?.trim() && address.state?.trim() && onlyDigits(address.zipCode).length === 8);
}

function tenantAddressComplete(tenant: FiscalTenant): boolean {
  return Boolean(tenant.addressStreet?.trim() && tenant.addressNumber?.trim() && tenant.addressDistrict?.trim() && tenant.addressCity?.trim() && tenant.addressState?.trim() && onlyDigits(tenant.addressPostalCode).length === 8);
}

// What still blocks issuing each document from the Ofix. An empty list means ready.
export function fiscalReadiness(tenant: FiscalTenant, config: FiscalConfig, providerAvailable: boolean): FiscalReadiness {
  const common: string[] = [];
  if (!providerAvailable) common.push('A emissão pelo Ofix ainda não está ativa neste servidor. Registre as notas emitidas fora do sistema.');
  if (onlyDigits(tenant.document).length !== 14) common.push('O documento da oficina precisa ser um CNPJ (Configurações → Empresa e marca).');
  if (!tenantAddressComplete(tenant)) common.push('Complete o endereço da oficina, com CEP (Configurações → Empresa e marca).');
  if (!config.certificateUploaded) common.push('Envie o certificado digital A1 da oficina.');
  else if (!config.companyRegistered) common.push('O cadastro da oficina no emissor não foi concluído. Salve as configurações novamente.');
  const merchandise = (enabled: boolean, label: string) => {
    const list = [...common];
    if (!enabled) list.unshift(`${label} desativada nas configurações.`);
    if (!tenant.stateRegistration?.trim()) list.push('Informe a inscrição estadual da oficina (Configurações → Empresa e marca).');
    if (!isSimples(config.taxRegime)) list.push('A emissão de nota de peças pelo Ofix atende Simples Nacional e MEI. No lucro presumido ou real, emita pelo seu sistema fiscal e registre aqui.');
    return list;
  };
  const nfse = [...common];
  if (!config.nfseEnabled) nfse.unshift('NFS-e desativada nas configurações.');
  if (!config.municipalRegistration?.trim()) nfse.push('Informe a inscrição municipal.');
  if (onlyDigits(config.cityIbgeCode).length !== 7) nfse.push('Informe o código IBGE do município da oficina.');
  const nfce = merchandise(config.nfceEnabled, 'NFC-e');
  if (!config.nfceCscId?.trim() || !config.hasNfceCsc) nfce.push('Informe o CSC e o ID do CSC da NFC-e (fornecidos pela SEFAZ do seu estado).');
  return { NFSE: nfse, NFE: merchandise(config.nfeEnabled, 'NF-e'), NFCE: nfce };
}

export function previewDocument(kind: FiscalDocumentKind, order: FiscalOrder, customer: FiscalCustomer, config: FiscalConfig): FiscalPreview {
  const discounts = allocateDiscount(order.items, order.discountCents);
  const types = FISCAL_KIND_ITEM_TYPES[kind];
  const items: FiscalPreviewItem[] = order.items.filter((item) => types.includes(item.type)).map((item) => ({
    id: item.id, type: item.type, description: item.description, quantity: item.quantity, unitPriceCents: item.unitPriceCents,
    totalCents: itemTotal(item), discountCents: discounts.get(item.id) ?? 0,
    ...(kind === 'NFSE' ? {} : { ncm: onlyDigits(item.ncm) || config.defaultNcm }),
  }));
  const gross = items.reduce((sum, item) => sum + item.totalCents, 0);
  const discountCents = items.reduce((sum, item) => sum + item.discountCents, 0);
  const amountCents = gross - discountCents;
  const problems: string[] = [];
  const warnings: string[] = [];
  const document = onlyDigits(customer.document);
  if (!items.length) problems.push(kind === 'NFSE' ? 'A OS não tem mão de obra para colocar na nota de serviço.' : 'A OS não tem peças ou produtos para colocar na nota.');
  else if (amountCents <= 0) problems.push('O valor da nota ficou zerado. Confira os preços e o desconto da OS.');
  if (document && ![11, 14].includes(document.length)) problems.push('O CPF/CNPJ do cliente está incompleto.');
  if (kind === 'NFE') {
    if (!document) problems.push('A NF-e exige o CPF ou CNPJ do cliente.');
    if (!addressComplete(customer.address)) problems.push('A NF-e exige o endereço completo do cliente, com CEP.');
  }
  if (kind === 'NFSE') {
    if (!document) warnings.push('O cliente está sem CPF/CNPJ: a nota sairá sem identificar o tomador, se a prefeitura permitir.');
    if (document.length === 14 && !addressComplete(customer.address)) problems.push('Para cliente com CNPJ, complete o endereço com CEP.');
  }
  if (kind === 'NFCE' && amountCents > 1_000_000 && !document) problems.push('Acima de R$ 10.000,00 a NFC-e exige o CPF ou CNPJ do cliente.');
  if (kind !== 'NFSE' && items.some((item) => !onlyDigits(order.items.find((source) => source.id === item.id)?.ncm))) warnings.push(`Itens sem NCM no catálogo usarão o NCM padrão ${config.defaultNcm}.`);
  if (!customer.email?.trim()) warnings.push('O cliente está sem e-mail: a nota não será enviada automaticamente a ele.');
  if (config.environment === 'HOMOLOGACAO') warnings.push('Ambiente de homologação: a nota é de teste e não tem valor fiscal.');
  return { items, amountCents, discountCents, problems, warnings };
}

function serviceDescription(order: FiscalOrder, items: FiscalPreviewItem[]): string {
  const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const lines = items.map((item) => `- ${item.description} (${item.quantity.toLocaleString('pt-BR')} x ${brl(item.unitPriceCents)})`);
  return [`Serviços da OS ${String(order.orderNumber).padStart(5, '0')} - ${order.vehicleLabel} placa ${order.vehiclePlate}`, ...lines].join('\n').slice(0, 2000);
}

function customerIdentity(customer: FiscalCustomer): Record<string, string> {
  const document = onlyDigits(customer.document);
  if (document.length === 14) return { cnpj: document };
  if (document.length === 11) return { cpf: document };
  return {};
}

export function buildNfsePayload(input: { tenant: FiscalTenant; config: FiscalConfig; order: FiscalOrder; customer: FiscalCustomer; preview: FiscalPreview; customerCityIbgeCode?: string; issuedAt: Date }): Record<string, unknown> {
  const { tenant, config, order, customer, preview } = input;
  const address = customer.address;
  const gross = preview.items.reduce((sum, item) => sum + item.totalCents, 0);
  const regime = config.taxRegime as FiscalTaxRegime;
  return {
    data_emissao: input.issuedAt.toISOString(),
    natureza_operacao: '1',
    optante_simples_nacional: isSimples(regime),
    ...(regime === 'MEI' ? { regime_especial_tributacao: '5' } : isSimples(regime) ? { regime_especial_tributacao: '6' } : {}),
    prestador: { cnpj: onlyDigits(tenant.document), inscricao_municipal: onlyDigits(config.municipalRegistration) || config.municipalRegistration, codigo_municipio: onlyDigits(config.cityIbgeCode) },
    tomador: {
      ...customerIdentity(customer),
      razao_social: customer.name.slice(0, 115),
      ...(customer.email?.trim() ? { email: customer.email.trim() } : {}),
      ...(onlyDigits(customer.phone) ? { telefone: onlyDigits(customer.phone) } : {}),
      ...(addressComplete(address) && input.customerCityIbgeCode ? { endereco: {
        logradouro: address!.street!.trim(), numero: address!.number!.trim(), ...(address!.complement?.trim() ? { complemento: address!.complement.trim() } : {}),
        bairro: address!.neighborhood!.trim(), codigo_municipio: input.customerCityIbgeCode, uf: address!.state!.trim().toUpperCase(), cep: onlyDigits(address!.zipCode),
      } } : {}),
    },
    servico: {
      valor_servicos: reais(gross),
      ...(preview.discountCents ? { desconto_incondicionado: reais(preview.discountCents) } : {}),
      iss_retido: config.issWithheld,
      ...(config.issRatePercent ? { aliquota: Number(config.issRatePercent) } : {}),
      item_lista_servico: config.serviceListItem,
      ...(config.municipalTaxCode?.trim() ? { codigo_tributario_municipio: config.municipalTaxCode.trim() } : {}),
      ...(onlyDigits(config.cnae) ? { codigo_cnae: onlyDigits(config.cnae) } : {}),
      discriminacao: serviceDescription(order, preview.items),
      codigo_municipio: onlyDigits(config.cityIbgeCode),
    },
  };
}

const PAYMENT_CODES: Record<PaymentMethod, string> = { CASH: '01', CREDIT_CARD: '03', DEBIT_CARD: '04', BOLETO: '15', PIX: '17', BANK_TRANSFER: '18', OTHER: '99' };

export function buildMerchandisePayload(kind: 'NFE' | 'NFCE', input: { tenant: FiscalTenant; config: FiscalConfig; order: FiscalOrder; customer: FiscalCustomer; preview: FiscalPreview; issuedAt: Date }): Record<string, unknown> {
  const { tenant, config, order, customer, preview } = input;
  const address = customer.address;
  const document = onlyDigits(customer.document);
  const sameState = !address?.state || address.state.trim().toUpperCase() === (tenant.addressState ?? '').trim().toUpperCase();
  // Interstate sales swap the leading 5 of an internal CFOP for a 6.
  const cfop = !sameState && config.defaultCfop.startsWith('5') ? `6${config.defaultCfop.slice(1)}` : config.defaultCfop;
  const contributor = document.length === 14 && Boolean(customer.stateRegistration?.trim());
  const paymentCode = PAYMENT_CODES[order.paymentMethod ?? 'OTHER'] ?? '99';
  const sources = new Map(order.items.map((item) => [item.id, item]));
  const items = preview.items.map((item, index) => {
    const unit = (sources.get(item.id)?.unit || 'un').toUpperCase().slice(0, 6);
    return {
      numero_item: index + 1,
      codigo_produto: (sources.get(item.id)?.code || item.id.slice(0, 8)).slice(0, 60),
      descricao: item.description.slice(0, 120),
      cfop: kind === 'NFCE' ? '5102' : cfop,
      codigo_ncm: item.ncm,
      unidade_comercial: unit,
      quantidade_comercial: item.quantity,
      valor_unitario_comercial: reais(item.unitPriceCents),
      valor_bruto: reais(item.totalCents),
      ...(item.discountCents ? { valor_desconto: reais(item.discountCents) } : {}),
      unidade_tributavel: unit,
      quantidade_tributavel: item.quantity,
      valor_unitario_tributavel: reais(item.unitPriceCents),
      inclui_no_total: 1,
      icms_origem: 0,
      icms_situacao_tributaria: config.csosn,
      pis_situacao_tributaria: config.pisCofinsCst,
      cofins_situacao_tributaria: config.pisCofinsCst,
    };
  });
  const recipient = kind === 'NFCE' && !document ? {} : {
    nome_destinatario: customer.name.slice(0, 60),
    ...(document.length === 14 ? { cnpj_destinatario: document } : document.length === 11 ? { cpf_destinatario: document } : {}),
    ...(kind === 'NFE' ? {
      indicador_inscricao_estadual_destinatario: contributor ? 1 : 9,
      ...(contributor ? { inscricao_estadual_destinatario: onlyDigits(customer.stateRegistration) } : {}),
      logradouro_destinatario: address?.street?.trim(), numero_destinatario: address?.number?.trim(),
      ...(address?.complement?.trim() ? { complemento_destinatario: address.complement.trim() } : {}),
      bairro_destinatario: address?.neighborhood?.trim(), municipio_destinatario: address?.city?.trim(), uf_destinatario: address?.state?.trim().toUpperCase(),
      cep_destinatario: onlyDigits(address?.zipCode), pais_destinatario: 'Brasil',
      ...(onlyDigits(customer.phone) ? { telefone_destinatario: onlyDigits(customer.phone) } : {}),
      ...(customer.email?.trim() ? { email_destinatario: customer.email.trim() } : {}),
    } : {}),
  };
  return {
    natureza_operacao: 'Venda de mercadoria',
    data_emissao: input.issuedAt.toISOString(),
    ...(kind === 'NFE' ? { data_entrada_saida: input.issuedAt.toISOString(), tipo_documento: 1, finalidade_emissao: 1, local_destino: sameState ? 1 : 2 } : {}),
    cnpj_emitente: onlyDigits(tenant.document),
    consumidor_final: kind === 'NFCE' || !contributor ? 1 : 0,
    presenca_comprador: 1,
    modalidade_frete: 9,
    ...recipient,
    items,
    formas_pagamento: [{ forma_pagamento: paymentCode, valor_pagamento: reais(preview.amountCents), ...(paymentCode === '99' ? { descricao_pagamento: 'Outros' } : {}) }],
    informacoes_adicionais_contribuinte: `OS ${String(order.orderNumber).padStart(5, '0')} - ${order.vehicleLabel} placa ${order.vehiclePlate}`.slice(0, 500),
  };
}

const TAX_REGIME_CODES: Record<FiscalTaxRegime, number> = { SIMPLES_NACIONAL: 1, MEI: 1, SIMPLES_EXCESSO: 2, NORMAL: 3 };

// Registration of the workshop at the provider (one per CNPJ). The certificate goes only when a new one is uploaded.
export function buildCompanyPayload(input: { tenant: FiscalTenant; config: FiscalConfig; nfceCsc?: string | null; certificate?: { dataBase64: string; password: string } }): Record<string, unknown> {
  const { tenant, config } = input;
  return {
    nome: (tenant.legalName?.trim() || tenant.name).slice(0, 60),
    nome_fantasia: tenant.name.slice(0, 60),
    cnpj: onlyDigits(tenant.document),
    ...(onlyDigits(tenant.stateRegistration) ? { inscricao_estadual: onlyDigits(tenant.stateRegistration) } : {}),
    ...(config.municipalRegistration?.trim() ? { inscricao_municipal: onlyDigits(config.municipalRegistration) || config.municipalRegistration.trim() } : {}),
    regime_tributario: TAX_REGIME_CODES[config.taxRegime as FiscalTaxRegime] ?? 1,
    ...(tenant.email?.trim() ? { email: tenant.email.trim() } : {}),
    ...(onlyDigits(tenant.phone) ? { telefone: onlyDigits(tenant.phone) } : {}),
    logradouro: tenant.addressStreet?.trim(), numero: tenant.addressNumber?.trim(),
    ...(tenant.addressComplement?.trim() ? { complemento: tenant.addressComplement.trim() } : {}),
    bairro: tenant.addressDistrict?.trim(), municipio: tenant.addressCity?.trim(), uf: tenant.addressState?.trim().toUpperCase(), cep: onlyDigits(tenant.addressPostalCode),
    ...(onlyDigits(config.cityIbgeCode) ? { codigo_municipio: onlyDigits(config.cityIbgeCode) } : {}),
    habilita_nfse: config.nfseEnabled,
    habilita_nfe: config.nfeEnabled,
    habilita_nfce: config.nfceEnabled,
    enviar_email_destinatario: true,
    discrimina_impostos: true,
    ...(config.nfceEnabled && config.nfceCscId && input.nfceCsc ? { id_token_nfce_producao: config.nfceCscId, csc_nfce_producao: input.nfceCsc } : {}),
    ...(input.certificate ? { arquivo_certificado_base64: input.certificate.dataBase64, senha_certificado: input.certificate.password } : {}),
  };
}
