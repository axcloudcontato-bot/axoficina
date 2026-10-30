// CPF and CNPJ check digits, so a typo is caught on screen and never printed on every quote.
const weightsFrom = (start: number, length: number) => Array.from({ length }, (_, index) => start - index);
const CNPJ_FIRST = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_SECOND = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function checkDigit(base: string, weights: number[]): number {
  const sum = base.split('').reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const first = checkDigit(digits.slice(0, 9), weightsFrom(10, 9));
  const second = checkDigit(digits.slice(0, 9) + first, weightsFrom(11, 10));
  return digits.endsWith(`${first}${second}`);
}

export function isValidCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const first = checkDigit(digits.slice(0, 12), CNPJ_FIRST);
  const second = checkDigit(digits.slice(0, 12) + first, CNPJ_SECOND);
  return digits.endsWith(`${first}${second}`);
}

export function isValidDocument(value: string): boolean {
  return isValidCpf(value) || isValidCnpj(value);
}
