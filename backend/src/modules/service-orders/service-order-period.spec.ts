import { serviceOrderPeriod, startOfWorkshopDay } from './service-order-period';

describe('service order calendar period', () => {
  it('includes the whole final day in Brasília, independently of server TZ', () => {
    expect(serviceOrderPeriod('2026-10-24', '2026-10-24')).toEqual({
      gte: new Date('2026-10-24T03:00:00Z'), lt: new Date('2026-10-25T03:00:00Z'),
    });
    expect(serviceOrderPeriod(undefined, '2026-12-31').lt).toEqual(new Date('2027-01-01T03:00:00Z'));
  });

  it('handles historical daylight saving time, including skipped midnight', () => {
    expect(startOfWorkshopDay('2018-11-04')).toEqual(new Date('2018-11-04T03:00:00Z'));
    expect(serviceOrderPeriod('2018-11-04', '2018-11-04').lt).toEqual(new Date('2018-11-05T02:00:00Z'));
  });
});
