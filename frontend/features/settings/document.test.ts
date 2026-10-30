import { describe, expect, it } from 'vitest';
import { isValidCnpj, isValidCpf, isValidDocument } from '@oficina/contracts';

describe('CPF and CNPJ check digits', () => {
  it('accepts real numbers with or without punctuation', () => {
    expect(isValidCpf('111.444.777-35')).toBe(true);
    expect(isValidCnpj('11.444.777/0001-61')).toBe(true);
    expect(isValidDocument('11444777000161')).toBe(true);
  });

  it('refuses typos, repeated digits and wrong lengths', () => {
    expect(isValidCpf('111.444.777-36')).toBe(false);
    expect(isValidCnpj('11.444.777/0001-62')).toBe(false);
    expect(isValidDocument('00000000000')).toBe(false);
    expect(isValidDocument('123')).toBe(false);
  });
});
