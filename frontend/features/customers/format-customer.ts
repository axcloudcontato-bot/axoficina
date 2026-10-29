import { formatCNPJ, formatCPF, formatPhone } from '@/lib/format-br-document';

// Documents and phones are stored as digits (phones sometimes with the country code); show them the way people read them.
export function displayDocument(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return formatCPF(digits);
  if (digits.length === 14) return formatCNPJ(digits);
  return value.trim() || '—';
}

export function displayPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('55') && [12, 13].includes(digits.length)) digits = digits.slice(2);
  return [10, 11].includes(digits.length) ? formatPhone(digits) : value.trim() || '—';
}

// Same number whatever the mask or country code, for spotting a customer that is already registered.
export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('55') && [12, 13].includes(digits.length) ? digits.slice(2) : digits;
}

// wa.me wants the full international number.
export function whatsappHref(phone: string): string {
  const digits = phoneDigits(phone);
  return `https://wa.me/55${digits}`;
}

// Where "Nova OS" leads for this customer (and, optionally, one of their vehicles).
export function newServiceOrderHref(customer: { id: string; name: string }, vehicle?: { id: string; label: string }): string {
  const params = new URLSearchParams({ customerId: customer.id, customerName: customer.name });
  if (vehicle) { params.set('vehicleId', vehicle.id); params.set('vehicleLabel', vehicle.label); }
  return `/ordens-de-servico/nova?${params.toString()}`;
}
