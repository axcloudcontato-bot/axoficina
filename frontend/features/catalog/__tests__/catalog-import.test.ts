import { describe, expect, it } from 'vitest';
import { CATALOG_IMPORT_TEMPLATE, parseCatalogCsv } from '../catalog-import';
import { isLowStock } from '../catalog-stock';

describe('parseCatalogCsv', () => {
  it('reads an Excel-style sheet: semicolons, accents in the titles, decimal comma and thousands dot', () => {
    const result = parseCatalogCsv('Tipo;Nome;Categoria;Preço (R$);Custo;Código;Marca;Unidade\r\nPeça;Filtro de óleo;Motor;1.234,50;600,00;FO-1;Tecfil;un\r\nServiço;Alinhamento;Rodas;120;;;;h\r\n');
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { type: 'PART', name: 'Filtro de óleo', category: 'Motor', unitPriceCents: 123450, costCents: 60000, code: 'FO-1', brand: 'Tecfil', unit: 'un' },
      { type: 'LABOR', name: 'Alinhamento', category: 'Rodas', unitPriceCents: 12000, unit: 'h' },
    ]);
  });

  it('accepts commas, quoted fields with separators, a BOM, and treats a missing type column as parts', () => {
    const result = parseCatalogCsv('﻿nome,preco\n"Vela, iridium",39.90\nPastilha,"1.000,00"\n');
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { type: 'PART', name: 'Vela, iridium', unitPriceCents: 3990 },
      { type: 'PART', name: 'Pastilha', unitPriceCents: 100000 },
    ]);
  });

  it('reports each bad line with its number and keeps the good ones', () => {
    const result = parseCatalogCsv('tipo;nome;preco;unidade\npeça;;10;un\ncarro;Algo;10;un\npeça;Óleo;abc;un\npeça;Graxa;10;barril\nproduto;Aditivo;15,00;L\n');
    expect(result.errors).toEqual([
      'Linha 2: falta o nome.',
      'Linha 3: tipo "carro" não reconhecido. Use Peça, Produto ou Serviço.',
      'Linha 4: preço "abc" inválido.',
      expect.stringContaining('Linha 5: unidade "barril" não aceita'),
    ]);
    expect(result.rows).toEqual([{ type: 'PRODUCT', name: 'Aditivo', unitPriceCents: 1500, unit: 'L' }]);
  });

  it('asks for the required columns and an actual item', () => {
    expect(parseCatalogCsv('nome;marca\nFiltro;X').errors[0]).toMatch(/Preço/);
    expect(parseCatalogCsv('preco;marca\n10;X').errors[0]).toMatch(/Nome/);
    expect(parseCatalogCsv('nome;preco').errors[0]).toMatch(/pelo menos um item/);
  });

  it('refuses more rows than the server takes', () => {
    const sheet = ['nome;preco', ...Array.from({ length: 501 }, (_, index) => `Item ${index};1`)].join('\n');
    expect(parseCatalogCsv(sheet).errors[0]).toMatch(/no máximo 500/);
  });

  it('reads its own template without errors', () => {
    const result = parseCatalogCsv(CATALOG_IMPORT_TEMPLATE);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(3);
  });
});

describe('isLowStock', () => {
  it('flags tracked items at or under the minimum, or at zero without one', () => {
    expect(isLowStock({ trackStock: true, stockQuantity: 2, minStock: 3 })).toBe(true);
    expect(isLowStock({ trackStock: true, stockQuantity: 3, minStock: 3 })).toBe(true);
    expect(isLowStock({ trackStock: true, stockQuantity: 4, minStock: 3 })).toBe(false);
    expect(isLowStock({ trackStock: true, stockQuantity: 0 })).toBe(true);
    expect(isLowStock({ trackStock: true, stockQuantity: 1 })).toBe(false);
    expect(isLowStock({ trackStock: false, stockQuantity: 0, minStock: 5 })).toBe(false);
  });
});
