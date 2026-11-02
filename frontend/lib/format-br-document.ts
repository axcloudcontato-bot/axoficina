export function onlyDigits(value = ''): string {
  return value.replace(/\D/g, '');
}

export function formatCPF(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatCNPJ(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formatRG(value: string): string {
  const digits = onlyDigits(value).slice(0, 9);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export function formatCEP(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
}

// "Smart" masks for fields shown the way people read them once the field is left: they format only when the digits
// make a complete CPF/CNPJ, phone or CEP, and leave anything else as typed.
export function maskDocument(value: string): string {
  const digits = onlyDigits(value);
  return digits.length === 11 ? formatCPF(digits) : digits.length === 14 ? formatCNPJ(digits) : value;
}

export function maskPhone(value: string): string {
  const digits = onlyDigits(value);
  return [10, 11].includes(digits.length) ? formatPhone(digits) : value;
}

export function maskPostalCode(value: string): string {
  const digits = onlyDigits(value);
  return digits.length === 8 ? formatCEP(digits) : value;
}
