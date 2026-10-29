// A plate is stored as ABC1234 (old format) or ABC1D23 (Mercosul): upper case, no hyphen, no spaces.
// Writing it any other way would let the same car be registered twice.
export function normalizePlate(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function isValidPlate(plate: string): boolean {
  return /^[A-Z]{3}\d{4}$/.test(plate) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(plate);
}

// How people read it: the old format has a hyphen, the Mercosul one does not.
export function formatPlate(plate: string): string {
  const normalized = normalizePlate(plate);
  return /^[A-Z]{3}\d{4}$/.test(normalized) ? `${normalized.slice(0, 3)}-${normalized.slice(3)}` : normalized;
}

// 17 characters, no I, O or Q.
export function isValidChassis(chassis: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(chassis);
}
