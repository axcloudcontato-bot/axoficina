import { formatCNPJ, formatCPF } from './format-br-document';

export const REGISTRATION_FIELDS = [
  { value: 'name', label: 'Nome do cliente' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'plate', label: 'Placa do veículo' },
  { value: 'brand', label: 'Marca do veículo' },
  { value: 'model', label: 'Modelo do veículo' },
  { value: 'chassis', label: 'Chassi' },
  { value: 'year', label: 'Ano do veículo' },
] as const;
export type RegistrationField = typeof REGISTRATION_FIELDS[number]['value'];
export interface CustomerRegistrationSeed { type?: 'PF' | 'PJ'; name?: string; document?: string; phone?: string; email?: string }
export interface VehicleRegistrationSeed { plate?: string; brand?: string; model?: string; chassis?: string; year?: string }
export interface RegistrationSeed { customer: CustomerRegistrationSeed; vehicle: VehicleRegistrationSeed }

export function inferRegistrationField(query: string, context: 'customer' | 'vehicle' | 'all' = 'all'): RegistrationField {
  const value = query.trim();
  const compact = value.replace(/[\s-]/g, '').toUpperCase();
  if (context !== 'customer') {
    if (/^[A-Z]{3}\d[A-Z\d]\d{2}$/.test(compact)) return 'plate';
    if (/^[A-HJ-NPR-Z\d]{17}$/.test(compact)) return 'chassis';
    if (/^(19|20)\d{2}$/.test(value)) return 'year';
  }
  if (context === 'vehicle') return 'model';
  if (value.includes('@')) return 'email';
  if (/^[\d\s()+./-]+$/.test(value)) {
    const digits = value.replace(/\D/g, '');
    if (value.includes('(') || value.startsWith('+')) return 'phone';
    if (digits.length === 14) return 'cnpj';
    if (digits.length === 11 || /[.]/.test(value)) return 'cpf';
    if (digits.length === 10 || (digits.startsWith('55') && digits.length === 13)) return 'phone';
  }
  return 'name';
}

export function registrationSeed(query: string, field = inferRegistrationField(query)): RegistrationSeed {
  const value = query.trim();
  const seed: RegistrationSeed = { customer: {}, vehicle: {} };
  if (!value) return seed;
  if (field === 'cpf' || field === 'cnpj') seed.customer = { type: field === 'cnpj' ? 'PJ' : 'PF', document: (field === 'cnpj' ? formatCNPJ : formatCPF)(value) };
  else if (field === 'name' || field === 'email' || field === 'phone') seed.customer[field] = value;
  else seed.vehicle[field] = field === 'plate' ? value.replace(/[\s-]/g, '').toUpperCase() : field === 'chassis' ? value.toUpperCase() : value;
  return seed;
}
