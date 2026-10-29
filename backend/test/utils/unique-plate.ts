const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// A valid Mercosul plate (ABC1D23): the API refuses any other format. Random enough
// (26^4 x 10^3 combinations) not to repeat within a test run.
export function uniquePlate(): string {
  const letter = () => LETTERS[Math.floor(Math.random() * LETTERS.length)];
  const digit = () => String(Math.floor(Math.random() * 10));
  return `${letter()}${letter()}${letter()}${digit()}${letter()}${digit()}${digit()}`;
}
