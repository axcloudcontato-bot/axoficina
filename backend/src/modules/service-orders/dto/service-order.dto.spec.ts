import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateServiceOrderDto } from './service-order.dto';

describe('UpdateServiceOrderDto', () => {
  it('accepts the fields sent by the order draft when optional values are empty', () => {
    const dto = plainToInstance(UpdateServiceOrderDto, {
      id: '123e4567-e89b-42d3-a456-426614174000',
      technicianId: '123e4567-e89b-42d3-a456-426614174001',
      diagnosis: '',
      checklist: { version: 1, items: [] },
      entryMileage: 1000,
      exitMileage: null,
      warrantyDays: null,
      customerComplaint: 'Teste',
      receptionNotes: 'Teste',
      recommendedService: null,
      expectedDeliveryAt: '2026-11-04T12:00:00.000Z',
    });

    expect(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
  });
});
