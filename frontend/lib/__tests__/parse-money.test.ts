import { describe, expect, it } from 'vitest';
import { parseMoneyToCents } from '../parse-money';

describe('parseMoneyToCents', () => {
  it.each([
    ['12,50', 1250], ['12.50', 1250], ['12,5', 1250], ['12', 1200], ['0', 0], ['0,99', 99],
    ['1.234,56', 123456], ['1,234.56', 123456], ['1.234', 123400], ['1.234.567', 123456700], ['1234,5', 123450],
    ['R$ 12,50', 1250], [' 7 ', 700],
  ])('reads %s as %i cents', (text, cents) => expect(parseMoneyToCents(text)).toBe(cents));

  it.each(['', '   ', 'abc', '-5', '12,345', '1,2,3', '12..5', '1.234,567', ',50'])('rejects %j', (text) => expect(parseMoneyToCents(text)).toBeNaN());

  it('never turns a decimal typed with a dot into a hundredfold amount', () => {
    expect(parseMoneyToCents('180.00')).toBe(18000);
    expect(parseMoneyToCents('12.50')).not.toBe(125000);
  });
});
