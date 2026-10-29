import type { CustomerListItemResponse, ImportCustomerRow } from '@oficina/contracts';
import { readCsv } from '@/lib/csv';
import { displayDocument, displayPhone } from './format-customer';

export const MAX_CUSTOMER_IMPORT_ROWS = 300;

export interface CustomerImportParse { rows: ImportCustomerRow[]; errors: string[] }
type Field = 'type' | 'name' | 'phone' | 'document' | 'email';

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function fieldOf(header: string): Field | undefined {
  const key = plain(header);
  if (key === 'tipo') return 'type';
  if (['nome', 'cliente', 'razaosocial', 'nomecompleto'].includes(key)) return 'name';
  if (['telefone', 'celular', 'whatsapp', 'fone', 'contato', 'telefonecelular'].includes(key)) return 'phone';
  if (['documento', 'cpf', 'cnpj', 'cpfcnpj', 'cnpjcpf'].includes(key)) return 'document';
  if (['email', 'emails'].includes(key)) return 'email';
  return undefined;
}

function typeOf(value: string): 'PF' | 'PJ' | undefined {
  const key = plain(value);
  if (['pf', 'pessoafisica', 'fisica'].includes(key)) return 'PF';
  if (['pj', 'pessoajuridica', 'juridica', 'empresa'].includes(key)) return 'PJ';
  return undefined;
}

// Only Name and Phone are required; the server validates documents and finds who is already registered.
export function parseCustomersCsv(text: string): CustomerImportParse {
  const table = readCsv(text);
  if (table.length < 2) return { rows: [], errors: ['A planilha precisa de uma linha de títulos e pelo menos um cliente.'] };
  const columns = table[0].map(fieldOf);
  if (!columns.includes('name')) return { rows: [], errors: ['Não encontrei a coluna "Nome" na primeira linha.'] };
  if (!columns.includes('phone')) return { rows: [], errors: ['Não encontrei a coluna "Telefone" na primeira linha.'] };
  if (table.length - 1 > MAX_CUSTOMER_IMPORT_ROWS) return { rows: [], errors: [`Envie no máximo ${MAX_CUSTOMER_IMPORT_ROWS} clientes por vez. A planilha tem ${table.length - 1}.`] };

  const rows: ImportCustomerRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((cells, offset) => {
    const line = offset + 2;
    const value = (field: Field) => (cells[columns.indexOf(field)] ?? '').trim();
    const typeText = columns.includes('type') ? value('type') : '';
    const type = typeText ? typeOf(typeText) : undefined;
    if (typeText && !type) return void errors.push(`Linha ${line}: tipo "${typeText}" não reconhecido. Use PF ou PJ.`);
    rows.push({ line, name: value('name'), phone: value('phone'), ...(type ? { type } : {}), ...(value('document') ? { document: value('document') } : {}), ...(value('email') ? { email: value('email') } : {}) });
  });
  return { rows, errors };
}

export const CUSTOMER_IMPORT_TEMPLATE = [
  'Tipo;Nome;Telefone;Documento;E-mail',
  'PF;Maria Souza;(11) 98888-7777;111.444.777-35;maria@example.com',
  'PJ;Frota Rápida LTDA;(11) 3333-4444;11.222.333/0001-81;compras@frota.example',
].join('\r\n');

const dateOnly = (value?: string) => (value ? new Date(value).toLocaleDateString('pt-BR') : '');

// The list as a spreadsheet; the columns with money only exist for those who were sent money.
export function customersToRows(items: CustomerListItemResponse[]): string[][] {
  const withSpend = items.some((item) => item.stats?.totalSpentCents !== undefined);
  const header = ['Tipo', 'Nome', 'Documento', 'Telefone', 'E-mail', 'Veículos', 'Ordens de serviço', 'Última visita', ...(withSpend ? ['Total gasto (R$)'] : []), 'Cadastrado em'];
  return [header, ...items.map((item) => [
    item.type,
    item.name,
    item.document ? displayDocument(item.document) : '',
    displayPhone(item.phone) === '—' ? '' : displayPhone(item.phone),
    item.email ?? '',
    (item.stats?.plates ?? []).join(' '),
    String(item.stats?.orderCount ?? ''),
    dateOnly(item.stats?.lastVisitAt),
    ...(withSpend ? [item.stats?.totalSpentCents === undefined ? '' : (item.stats.totalSpentCents / 100).toFixed(2).replace('.', ',')] : []),
    dateOnly(item.createdAt),
  ])];
}
