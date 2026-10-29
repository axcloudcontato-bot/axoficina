import { CATALOG_UNITS, type CatalogUnit, type ImportCatalogRow } from '@oficina/contracts';
import { parseMoneyToCents } from '@/lib/parse-money';

export const MAX_IMPORT_ROWS = 500;

export interface CatalogImportParse { rows: ImportCatalogRow[]; errors: string[] }

type Field = 'type' | 'name' | 'category' | 'price' | 'cost' | 'code' | 'brand' | 'unit';

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function fieldOf(header: string): Field | undefined {
  const key = plain(header);
  if (key.includes('custo')) return 'cost';
  if (key.startsWith('preco') || key === 'valor' || key === 'venda') return 'price';
  if (key === 'tipo') return 'type';
  if (['nome', 'descricao', 'item'].includes(key)) return 'name';
  if (['categoria', 'grupo'].includes(key)) return 'category';
  if (['codigo', 'cod', 'referencia', 'sku'].includes(key)) return 'code';
  if (['marca', 'fabricante'].includes(key)) return 'brand';
  if (['unidade', 'un'].includes(key)) return 'unit';
  return undefined;
}

function typeOf(value: string): ImportCatalogRow['type'] | undefined {
  const key = plain(value);
  if (['peca', 'pecas', 'part'].includes(key)) return 'PART';
  if (['produto', 'produtos', 'product'].includes(key)) return 'PRODUCT';
  if (['servico', 'servicos', 'maodeobra', 'labor'].includes(key)) return 'LABOR';
  return undefined;
}

// A small CSV reader: quoted fields, doubled quotes, and ";" "," or tab as the separator (Excel in pt-BR saves with ";").
function readRows(text: string): string[][] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [';', '\t', ','].map(candidate => ({ candidate, count: firstLine.split(candidate).length })).sort((a, b) => b.count - a.count)[0].candidate;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (quoted) {
      if (char === '"' && clean[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[index + 1] === '\n') index += 1;
      row.push(field); field = '';
      if (row.some(cell => cell.trim() !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some(cell => cell.trim() !== '')) rows.push(row);
  return rows;
}

export function parseCatalogCsv(text: string): CatalogImportParse {
  const table = readRows(text);
  if (table.length < 2) return { rows: [], errors: ['A planilha precisa de uma linha de títulos e pelo menos um item.'] };
  const columns = table[0].map(fieldOf);
  if (!columns.includes('name')) return { rows: [], errors: ['Não encontrei a coluna "Nome" na primeira linha.'] };
  if (!columns.includes('price')) return { rows: [], errors: ['Não encontrei a coluna "Preço" na primeira linha.'] };
  if (table.length - 1 > MAX_IMPORT_ROWS) return { rows: [], errors: [`Envie no máximo ${MAX_IMPORT_ROWS} itens por vez. A planilha tem ${table.length - 1}.`] };

  const rows: ImportCatalogRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((cells, offset) => {
    const line = offset + 2;
    const value = (field: Field) => (cells[columns.indexOf(field)] ?? '').trim();
    const name = value('name');
    if (!name) return void errors.push(`Linha ${line}: falta o nome.`);
    const type = columns.includes('type') && value('type') ? typeOf(value('type')) : 'PART';
    if (!type) return void errors.push(`Linha ${line}: tipo "${value('type')}" não reconhecido. Use Peça, Produto ou Serviço.`);
    const price = value('price') === '' ? 0 : parseMoneyToCents(value('price'));
    if (Number.isNaN(price)) return void errors.push(`Linha ${line}: preço "${value('price')}" inválido.`);
    const cost = value('cost') === '' ? undefined : parseMoneyToCents(value('cost'));
    if (cost !== undefined && Number.isNaN(cost)) return void errors.push(`Linha ${line}: custo "${value('cost')}" inválido.`);
    const unitText = value('unit');
    const unit = unitText ? CATALOG_UNITS.find(candidate => candidate.toLowerCase() === unitText.toLowerCase()) as CatalogUnit | undefined : undefined;
    if (unitText && !unit) return void errors.push(`Linha ${line}: unidade "${unitText}" não aceita. Use ${CATALOG_UNITS.join(', ')}.`);
    rows.push({
      type, name, unitPriceCents: price,
      ...(value('category') ? { category: value('category') } : {}), ...(cost !== undefined ? { costCents: cost } : {}),
      ...(value('code') ? { code: value('code') } : {}), ...(value('brand') ? { brand: value('brand') } : {}), ...(unit ? { unit } : {}),
    });
  });
  return { rows, errors };
}

// Opens in Excel and Google Sheets; the semicolon is what Excel in Portuguese expects.
export const CATALOG_IMPORT_TEMPLATE = [
  'Tipo;Nome;Categoria;Preço;Custo;Código;Marca;Unidade',
  'Peça;Filtro de óleo;Motor;45,00;22,00;FO-100;Tecfil;un',
  'Produto;Óleo 5W30 sintético;Lubrificantes;60,00;38,00;;Mobil;L',
  'Serviço;Troca de óleo e filtro;Motor;80,00;;;;h',
].join('\r\n');
