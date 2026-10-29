import { describe, expect, it } from 'vitest';
import type { VehicleListItemResponse } from '@oficina/contracts';
import { VEHICLE_IMPORT_TEMPLATE, parseVehiclesCsv, vehiclesToRows } from '../vehicle-csv';

describe('parseVehiclesCsv', () => {
  it('reads an Excel-style sheet: accents, dotted thousands, owner by document or by phone and name', () => {
    const result = parseVehiclesCsv('Placa;Marca;Modelo;Ano;Cor;Combustível;Km;Documento do dono;Telefone do dono;Nome do dono\r\nabc-1d23;Fiat;Uno;2012;Prata;Flex;98.000;111.444.777-35;;\r\nXYZ9K88;VW;Gol;;;;;;(11) 98888-7777;Maria Souza\r\n');
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { line: 2, plate: 'abc-1d23', brand: 'Fiat', model: 'Uno', year: 2012, mileage: 98000, color: 'Prata', fuelType: 'Flex', ownerDocument: '111.444.777-35' },
      { line: 3, plate: 'XYZ9K88', brand: 'VW', model: 'Gol', ownerPhone: '(11) 98888-7777', ownerName: 'Maria Souza' },
    ]);
  });

  it('keeps rows with missing data for the server to report, but flags numbers it cannot read here', () => {
    const result = parseVehiclesCsv('placa;marca;modelo;ano;km;telefone\n;Fiat;Uno;2012;100;11999998888\nABC1D23;Fiat;Uno;dois mil;100;11999998888\nDEF2E34;Fiat;Uno;2010;muito;11999998888\n');
    expect(result.rows.map((row) => row.line)).toEqual([2]);
    expect(result.errors).toEqual(['Linha 3: ano "dois mil" inválido.', 'Linha 4: km "muito" inválido.']);
  });

  it('asks for the required columns, a way to find the owner, an actual vehicle, and respects the limit', () => {
    expect(parseVehiclesCsv('marca;modelo;telefone\nA;B;1').errors[0]).toMatch(/Placa/);
    expect(parseVehiclesCsv('placa;modelo;telefone\nA;B;1').errors[0]).toMatch(/Marca/);
    expect(parseVehiclesCsv('placa;marca;modelo\nA;B;C').errors[0]).toMatch(/Documento do dono.*Telefone do dono/);
    expect(parseVehiclesCsv('placa;marca;modelo;telefone').errors[0]).toMatch(/pelo menos um veículo/);
    const big = ['placa;marca;modelo;telefone', ...Array.from({ length: 301 }, (_, index) => `A${index};F;U;11999998888`)].join('\n');
    expect(parseVehiclesCsv(big).errors[0]).toMatch(/no máximo 300/);
  });

  it('reads its own template without errors', () => {
    const result = parseVehiclesCsv(VEHICLE_IMPORT_TEMPLATE);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
  });
});

describe('vehiclesToRows', () => {
  const vehicle: VehicleListItemResponse = {
    id: 'v1', tenantId: 't', customerId: 'c1', customerName: 'João da Silva', brand: 'Fiat', model: 'Uno', year: 2012, color: 'Prata', fuelType: 'Flex',
    plate: 'ABC1234', mileage: 98000, photos: [], createdAt: '2026-01-05T12:00:00Z', stats: { orderCount: 3, lastVisitAt: '2026-09-20T12:00:00Z' },
  };

  it('writes the list as rows, with the plate the way people read it', () => {
    const rows = vehiclesToRows([vehicle, { ...vehicle, id: 'v2', plate: 'XYZ9K88', year: undefined, mileage: undefined, stats: undefined }]);
    expect(rows[0]).toContain('Placa');
    expect(rows[1]).toEqual(['ABC-1234', 'Fiat', 'Uno', '2012', 'Prata', 'Flex', '', '98000', 'João da Silva', '3', '20/09/2026', '05/01/2026']);
    expect(rows[2].slice(0, 8)).toEqual(['XYZ9K88', 'Fiat', 'Uno', '', 'Prata', 'Flex', '', '']);
  });
});
