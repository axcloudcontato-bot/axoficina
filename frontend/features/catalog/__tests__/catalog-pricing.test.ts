import { describe, expect, it } from 'vitest';
import { marginPercent, priceFromMinutes } from '../catalog-pricing';

describe('catalog pricing', () => {
  it('computes margin on the selling price, negative when selling below cost, none without a price', () => {
    expect(marginPercent(18000, 9000)).toBe(50);
    expect(marginPercent(10000, 7500)).toBe(25);
    expect(marginPercent(5000, 6000)).toBe(-20);
    expect(marginPercent(0, 100)).toBeNull();
  });

  it('prices a service by its time and the hourly rate', () => {
    expect(priceFromMinutes(12000, 60)).toBe(12000);
    expect(priceFromMinutes(12000, 90)).toBe(18000);
    expect(priceFromMinutes(9000, 40)).toBe(6000);
    expect(priceFromMinutes(null, 60)).toBeNull();
    expect(priceFromMinutes(12000, 0)).toBeNull();
    expect(priceFromMinutes(12000, Number.NaN)).toBeNull();
  });
});
