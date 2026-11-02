import { describe, expect, it } from 'vitest';
import { maskDocument, maskPhone, maskPostalCode, onlyDigits } from '../format-br-document';

describe('smart masks', () => {
  it('onlyDigits keeps digits and tolerates a missing value', () => {
    expect(onlyDigits('(11) 99999-8888')).toBe('11999998888');
    expect(onlyDigits()).toBe('');
  });

  it('maskDocument formats a complete CPF or CNPJ and leaves anything else as typed', () => {
    expect(maskDocument('12345678909')).toBe('123.456.789-09');
    expect(maskDocument('12345678000195')).toBe('12.345.678/0001-95');
    expect(maskDocument('123456')).toBe('123456');
    expect(maskDocument('12.345')).toBe('12.345');
  });

  it('maskPhone formats landlines (10 digits) and mobiles (11 digits) only', () => {
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444');
    expect(maskPhone('11999998888')).toBe('(11) 99999-8888');
    expect(maskPhone('99999')).toBe('99999');
  });

  it('maskPostalCode formats a complete CEP only', () => {
    expect(maskPostalCode('01310100')).toBe('01310-100');
    expect(maskPostalCode('0131')).toBe('0131');
  });
});
