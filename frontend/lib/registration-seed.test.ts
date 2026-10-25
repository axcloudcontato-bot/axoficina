import { describe, expect, it } from 'vitest';
import { inferRegistrationField, registrationSeed } from './registration-seed';

describe('registration seed', () => {
  it.each([
    ['Maria de Souza', 'name'], ['11144477735', 'cpf'], ['111.444.777-35', 'cpf'],
    ['12.345.678/0001-90', 'cnpj'], ['(11) 99999-8888', 'phone'], ['+5511999998888', 'phone'],
    ['cliente@example.invalid', 'email'], ['abc-1234', 'plate'], ['abc1d23', 'plate'],
    ['9BWZZZ377VT004251', 'chassis'], ['2020', 'year'],
  ] as const)('recognizes %s as %s', (text, field) => expect(inferRegistrationField(text)).toBe(field));
  it('keeps a plate for the vehicle, without putting it in the customer name', () => {
    expect(registrationSeed('abc-1234')).toEqual({ customer: {}, vehicle: { plate: 'ABC1234' } });
  });
  it('allows the operator to resolve ambiguous numbers and names', () => {
    expect(registrationSeed('11999998888', 'phone')).toEqual({ customer: { phone: '11999998888' }, vehicle: {} });
    expect(registrationSeed('Corolla', 'model')).toEqual({ customer: {}, vehicle: { model: 'Corolla' } });
  });
  it('prepares the company type and formatted CNPJ without silently saving it', () => {
    expect(registrationSeed('12345678000190')).toEqual({ customer: { type: 'PJ', document: '12.345.678/0001-90' }, vehicle: {} });
    expect(registrationSeed('')).toEqual({ customer: {}, vehicle: {} });
  });
});
