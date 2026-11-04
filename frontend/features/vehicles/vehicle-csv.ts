import { formatPlate, type FipeCategory, type ImportVehicleRow, type VehicleListItemResponse } from '@oficina/contracts';
import { readCsv } from '@/lib/csv';

export const MAX_VEHICLE_IMPORT_ROWS = 300;

export interface VehicleImportParse { rows: ImportVehicleRow[]; errors: string[] }
type Field = 'category' | 'plate' | 'brand' | 'model' | 'year' | 'color' | 'fuelType' | 'chassis' | 'mileage' | 'ownerDocument' | 'ownerPhone' | 'ownerName';

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function fieldOf(header: string): Field | undefined {
  const key = plain(header);
  if (['tipo', 'categoria', 'tipodeveiculo'].includes(key)) return 'category';
  if (key === 'placa') return 'plate';
  if (key === 'marca' || key === 'fabricante') return 'brand';
  if (key === 'modelo' || key === 'veiculo') return 'model';
  if (key === 'ano' || key === 'anomodelo') return 'year';
  if (key === 'cor') return 'color';
  if (['combustivel', 'combustiveis'].includes(key)) return 'fuelType';
  if (key === 'chassi') return 'chassis';
  if (['km', 'quilometragem', 'kmatual', 'odometro'].includes(key)) return 'mileage';
  if (['documentododono', 'documentocliente', 'cpfcnpj', 'cpf', 'cnpj', 'documento', 'documentodocliente'].includes(key)) return 'ownerDocument';
  if (['telefonedodono', 'telefonecliente', 'telefone', 'celular', 'whatsapp', 'telefonedocliente'].includes(key)) return 'ownerPhone';
  if (['dono', 'nomedodono', 'cliente', 'nomecliente', 'proprietario', 'nomedocliente'].includes(key)) return 'ownerName';
  return undefined;
}

// Plate, brand and model are required, and so is a way to find the owner (document or phone); the server checks
// the plate, the chassis, the year and who the owner is, and reports each row it could not import.
export function parseVehiclesCsv(text: string): VehicleImportParse {
  const table = readCsv(text);
  if (table.length < 2) return { rows: [], errors: ['A planilha precisa de uma linha de títulos e pelo menos um veículo.'] };
  const columns = table[0].map(fieldOf);
  for (const [field, label] of [['category', 'Tipo'], ['brand', 'Marca'], ['model', 'Modelo']] as const) {
    if (!columns.includes(field)) return { rows: [], errors: [`Não encontrei a coluna "${label}" na primeira linha.`] };
  }
  if (!columns.includes('plate') && !columns.includes('chassis')) return { rows: [], errors: ['Informe uma coluna "Placa" ou "Chassi" para identificar o veículo.'] };
  if (!columns.includes('ownerDocument') && !columns.includes('ownerPhone')) return { rows: [], errors: ['Preciso de uma coluna "Documento do dono" ou "Telefone do dono" para saber de quem é cada veículo.'] };
  if (table.length - 1 > MAX_VEHICLE_IMPORT_ROWS) return { rows: [], errors: [`Envie no máximo ${MAX_VEHICLE_IMPORT_ROWS} veículos por vez. A planilha tem ${table.length - 1}.`] };

  const rows: ImportVehicleRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((cells, offset) => {
    const line = offset + 2;
    const value = (field: Field) => (cells[columns.indexOf(field)] ?? '').trim();
    const number = (field: Field, label: string): number | undefined | null => {
      const raw = value(field).replace(/\./g, '').replace(/\s/g, '');
      if (!raw) return undefined;
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 0) { errors.push(`Linha ${line}: ${label} "${value(field)}" inválido.`); return null; }
      return parsed;
    };
    const year = number('year', 'ano');
    const mileage = number('mileage', 'km');
    if (year === null || mileage === null) return;
    const categoryValue = plain(value('category'));
    const categories: Record<string, FipeCategory> = { carro: 'CAR', car: 'CAR', moto: 'MOTORCYCLE', motocicleta: 'MOTORCYCLE', motorcycle: 'MOTORCYCLE', caminhao: 'TRUCK', truck: 'TRUCK' };
    if (!categories[categoryValue]) { errors.push(`Linha ${line}: tipo de veículo inválido. Use Carro, Moto ou Caminhão.`); return; }
    if (!value('plate') && !value('chassis')) { errors.push(`Linha ${line}: informe a placa ou o chassi.`); return; }
    rows.push({
      category: categories[categoryValue] ?? 'CAR',
      line, ...(value('plate') ? { plate: value('plate') } : {}), brand: value('brand'), model: value('model'),
      ...(year !== undefined ? { year } : {}), ...(mileage !== undefined ? { mileage } : {}),
      ...(value('color') ? { color: value('color') } : {}), ...(value('fuelType') ? { fuelType: value('fuelType') } : {}), ...(value('chassis') ? { chassis: value('chassis') } : {}),
      ...(value('ownerDocument') ? { ownerDocument: value('ownerDocument') } : {}), ...(value('ownerPhone') ? { ownerPhone: value('ownerPhone') } : {}), ...(value('ownerName') ? { ownerName: value('ownerName') } : {}),
    });
  });
  return { rows, errors };
}

export const VEHICLE_IMPORT_TEMPLATE = [
  'Tipo;Placa;Marca;Modelo;Ano;Cor;Combustível;Chassi;Km;Documento do dono;Telefone do dono;Nome do dono',
  'Carro;ABC1D23;Fiat;Uno;2012;Prata;Flex;;98000;111.444.777-35;;',
  'Moto;XYZ-9K88;Honda;CG 160;2018;Vermelha;Gasolina;;45000;;(11) 98888-7777;Maria Souza',
  'Caminhão;;Volvo;FH;2022;Branco;Diesel;9BWZZZ377VT004251;120000;111.444.777-35;;',
].join('\r\n');

const dateOnly = (value?: string) => (value ? new Date(value).toLocaleDateString('pt-BR') : '');

// The list as a spreadsheet.
export function vehiclesToRows(items: VehicleListItemResponse[]): string[][] {
  const header = ['Tipo', 'Placa', 'Marca', 'Modelo', 'Ano', 'Cor', 'Combustível', 'Chassi', 'Km', 'Dono', 'Ordens de serviço', 'Última visita', 'Cadastrado em'];
  return [header, ...items.map((item) => [
    item.category ? ({ CAR: 'Carro', MOTORCYCLE: 'Moto', TRUCK: 'Caminhão' } as const)[item.category] : 'A classificar', item.plate === 'Sem placa' ? '' : formatPlate(item.plate), item.brand, item.model, item.year ? String(item.year) : '', item.color ?? '', item.fuelType ?? '', item.chassis ?? '',
    item.mileage != null ? String(item.mileage) : '', item.customerName, String(item.stats?.orderCount ?? ''), dateOnly(item.stats?.lastVisitAt), dateOnly(item.createdAt),
  ])];
}
