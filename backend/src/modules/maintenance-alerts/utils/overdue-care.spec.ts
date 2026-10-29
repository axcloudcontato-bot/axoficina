import { overdueCare } from './overdue-care';

const NOW = new Date('2026-10-29T12:00:00Z');
const plan = (over: Record<string, unknown>) => ({ serviceKey: 'OIL_CHANGE', completedAt: new Date('2026-09-01T12:00:00Z'), mileage: null, intervalMonths: null, intervalKm: null, ...over });

describe('overdueCare', () => {
  it('flags a care whose time since it was done is up, using the campaign default when the plan has none', () => {
    expect(overdueCare([plan({ completedAt: new Date('2026-03-01T12:00:00Z') })], null, NOW)).toEqual([{ serviceName: 'Óleo e filtro do motor', reason: 'TIME' }]);
    expect(overdueCare([plan({})], null, NOW)).toEqual([]);
  });

  it('flags a care whose mileage is up when the car odometer is known, and not otherwise', () => {
    const byKm = plan({ mileage: 90000, intervalKm: 10000 });
    expect(overdueCare([byKm], 100000, NOW)).toEqual([{ serviceName: 'Óleo e filtro do motor', reason: 'KM' }]);
    expect(overdueCare([byKm], 99999, NOW)).toEqual([]);
    expect(overdueCare([byKm], null, NOW)).toEqual([]);
  });

  it('puts the one waiting the longest first and ignores unknown services', () => {
    const result = overdueCare([
      plan({ serviceKey: 'BRAKES', completedAt: new Date('2026-02-01T12:00:00Z') }),
      plan({ serviceKey: 'OIL_CHANGE', completedAt: new Date('2025-12-01T12:00:00Z') }),
      plan({ serviceKey: 'NOT_A_SERVICE', completedAt: new Date('2020-01-01T12:00:00Z') }),
    ], null, NOW);
    expect(result.map((item) => item.serviceName)).toEqual(['Óleo e filtro do motor', 'Pastilhas, discos e freios']);
  });
});
