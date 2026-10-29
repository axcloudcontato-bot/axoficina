// Profit as a share of the selling price (so 50% means half of each sale is profit).
export function marginPercent(priceCents: number, costCents: number): number | null {
  if (priceCents <= 0) return null;
  return Math.round(((priceCents - costCents) / priceCents) * 100);
}

// Price of a job from its standard time and the workshop's hourly rate, in whole cents.
export function priceFromMinutes(rateCentsPerHour: number | null, minutes: number): number | null {
  if (rateCentsPerHour === null || !Number.isFinite(minutes) || minutes < 1) return null;
  return Math.round((rateCentsPerHour * minutes) / 60);
}
