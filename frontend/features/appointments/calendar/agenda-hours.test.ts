import { describe, expect, it } from 'vitest';
import { agendaSpan, hoursOn, type AgendaHours } from '@oficina/contracts';
import { agendaIndicators } from './indicators';
import { slotsOf, withinHours } from './time-grid';

// Monday to Friday 8h-18h, Saturday 8h-12h, closed on 2026-11-20 (a Friday).
const hours: AgendaHours = { openHour: 8, closeHour: 18, workDays: [1, 2, 3, 4, 5, 6], bays: 1, dayHours: { '6': { openHour: 8, closeHour: 12 } }, closedDates: ['2026-11-20'] };

describe('agenda with hours per day and closed dates', () => {
  it('knows the hours of each day', () => {
    expect(hoursOn(hours, 1, '2026-11-16')).toEqual({ openHour: 8, closeHour: 18 });
    expect(hoursOn(hours, 6, '2026-11-21')).toEqual({ openHour: 8, closeHour: 12 });
    expect(hoursOn(hours, 5, '2026-11-20')).toBeNull();
    expect(hoursOn(hours, 0, '2026-11-22')).toBeNull();
  });

  it('draws the grid from the earliest opening to the latest closing', () => {
    expect(agendaSpan({ ...hours, dayHours: { '6': { openHour: 7, closeHour: 12 }, '5': { openHour: 8, closeHour: 20 } } })).toEqual({ openHour: 7, closeHour: 20 });
    expect(slotsOf(hours)).toHaveLength(20);
  });

  it('flags a Saturday afternoon and a holiday as outside the hours', () => {
    expect(withinHours(new Date(2026, 10, 21, 9), new Date(2026, 10, 21, 11), hours)).toBe(true);
    expect(withinHours(new Date(2026, 10, 21, 13), new Date(2026, 10, 21, 15), hours)).toBe(false);
    expect(withinHours(new Date(2026, 10, 20, 9), new Date(2026, 10, 20, 10), hours)).toBe(false);
  });

  it('counts each day by its own hours in the occupancy', () => {
    // Week of 16 to 22 November: four 10-hour days (the 20th is closed) and a 4-hour Saturday = 44 hours.
    const items = [{ id: 'a', status: 'SCHEDULED', startsAt: new Date(2026, 10, 16, 8).toISOString(), endsAt: new Date(2026, 10, 16, 19).toISOString() }] as never;
    const result = agendaIndicators(items, new Date(2026, 10, 16), new Date(2026, 10, 23), hours, new Date(2026, 10, 15));
    expect(result.occupancy).toBe(Math.round(11 * 100 / 44));
  });
});
