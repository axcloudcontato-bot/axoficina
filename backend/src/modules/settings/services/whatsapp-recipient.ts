export function whatsappRecipient(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  const normalized = [10, 11].includes(digits.length) ? `55${digits}` : /^55\d{10,11}$/.test(digits) ? digits : null;
  return normalized ? `${normalized}@s.whatsapp.net` : null;
}
