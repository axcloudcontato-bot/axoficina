import { describe, expect, it } from 'vitest';
import type { CustomerListItemResponse } from '@oficina/contracts';
import { toCsv } from '@/lib/csv';
import { CUSTOMER_IMPORT_TEMPLATE, customersToRows, parseCustomersCsv } from '../customer-csv';

describe('parseCustomersCsv', () => {
  it('reads an Excel-style sheet with accents, any column order and a type word in Portuguese', () => {
    const result = parseCustomersCsv('E-mail;Celular;Cliente;Tipo;CPF/CNPJ\r\nmaria@example.com;(11) 98888-7777;Maria Souza;Pessoa Física;111.444.777-35\r\n;1133334444;Frota LTDA;empresa;\r\n');
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { line: 2, name: 'Maria Souza', phone: '(11) 98888-7777', type: 'PF', document: '111.444.777-35', email: 'maria@example.com' },
      { line: 3, name: 'Frota LTDA', phone: '1133334444', type: 'PJ' },
    ]);
  });

  it('keeps rows with missing data for the server to report, but refuses an unknown type here', () => {
    const result = parseCustomersCsv('nome;telefone;tipo\n;11999998888;PF\nJoão;;PF\nCarlos;11999998888;moto\n');
    expect(result.rows.map((row) => row.line)).toEqual([2, 3]);
    expect(result.errors).toEqual(['Linha 4: tipo "moto" não reconhecido. Use PF ou PJ.']);
  });

  it('asks for the required columns, an actual customer, and respects the limit', () => {
    expect(parseCustomersCsv('nome;email\nA;a@b.c').errors[0]).toMatch(/Telefone/);
    expect(parseCustomersCsv('telefone;email\n1;a@b.c').errors[0]).toMatch(/Nome/);
    expect(parseCustomersCsv('nome;telefone').errors[0]).toMatch(/pelo menos um cliente/);
    const big = ['nome;telefone', ...Array.from({ length: 301 }, (_, index) => `C${index};119999${String(index).padStart(5, '0')}`)].join('\n');
    expect(parseCustomersCsv(big).errors[0]).toMatch(/no máximo 300/);
  });

  it('reads its own template without errors', () => {
    const result = parseCustomersCsv(CUSTOMER_IMPORT_TEMPLATE);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
  });
});

describe('exporting customers', () => {
  const customer: CustomerListItemResponse = {
    id: 'c1', tenantId: 't', type: 'PF', document: '11144477735', name: 'João "Zé" da Silva', phone: '11999998888', email: 'joao@example.com', createdAt: '2026-01-05T12:00:00Z',
    stats: { plates: ['ABC1D23', 'XYZ9K88'], orderCount: 3, lastVisitAt: '2026-09-10T12:00:00Z', totalSpentCents: 123450 },
  };

  it('writes the list as rows, with the money column only when money was sent', () => {
    const rows = customersToRows([customer]);
    expect(rows[0]).toContain('Total gasto (R$)');
    expect(rows[1]).toEqual(['PF', 'João "Zé" da Silva', '111.444.777-35', '(11) 99999-8888', 'joao@example.com', 'ABC1D23 XYZ9K88', '3', '10/09/2026', '1234,50', '05/01/2026']);
    const withoutMoney = customersToRows([{ ...customer, stats: { plates: [], orderCount: 0 } }]);
    expect(withoutMoney[0]).not.toContain('Total gasto (R$)');
    expect(withoutMoney[1][5]).toBe('');
  });

  it('escapes quotes and separators, and defuses cells that a spreadsheet would run as a formula', () => {
    const csv = toCsv([['=HYPERLINK("http://x")', '+55 11', 'Silva; Filho', 'Zé "Bom"', 'normal']]);
    expect(csv).toBe(`"'=HYPERLINK(""http://x"")";'+55 11;"Silva; Filho";"Zé ""Bom""";normal`);
  });
});
