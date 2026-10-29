// One way to read an amount typed in reais, shared by every screen that takes money.
// Accepts "12,50", "12.50", "1.234,56", "1,234.56", "1234" and "R$ 12,50".
// Returns whole cents, or NaN when the text is not a valid non-negative amount.

// "1.234.567" is only a number when every group after the first has exactly three digits.
const validGroups = (groups: string[]) => groups.length > 0 && groups[0].length >= 1 && groups[0].length <= 3 && groups.slice(1).every((group) => group.length === 3);

export function parseMoneyToCents(raw: string): number {
  const text = raw.replace(/R\$/gi, '').replace(/\s/g, '');
  if (text === '' || !/^\d[\d.,]*$/.test(text)) return NaN;
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: the one that comes last is the decimal mark.
    const decimalMark = lastDot > lastComma ? '.' : ',';
    const thousandsMark = decimalMark === '.' ? ',' : '.';
    const [integer, ...rest] = text.split(decimalMark);
    if (rest.length !== 1 || !validGroups(integer.split(thousandsMark))) return NaN;
    normalized = `${integer.split(thousandsMark).join('')}.${rest[0]}`;
  } else if (lastComma >= 0 || lastDot >= 0) {
    const mark = lastComma >= 0 ? ',' : '.';
    const parts = text.split(mark);
    // "12,5" / "12.50" are decimals; "1.234" / "1.234.567" are thousands; a lone comma is always decimal.
    const isDecimal = parts.length === 2 && (mark === ',' || parts[1].length <= 2);
    if (isDecimal) normalized = `${parts[0]}.${parts[1]}`;
    else if (validGroups(parts)) normalized = parts.join('');
    else return NaN;
  } else normalized = text;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100);
}
