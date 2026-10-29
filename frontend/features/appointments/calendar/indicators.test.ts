import { describe, expect, it } from 'vitest';
import type { AppointmentResponse } from '@oficina/contracts';
import { agendaIndicators } from './indicators';

const hours = { openHour: 8, closeHour: 18, workDays: [1, 2, 3, 4, 5], bays: 2 };
const start = new Date(2026, 9, 26); const end = new Date(2026, 10, 2); // Monday to next Monday
const now = new Date(2026, 9, 28, 12);
const item = (id: string, day: number, h: number, length: number, status: AppointmentResponse['status'], serviceOrderId?: string) =>
  ({ id, startsAt: new Date(2026, 9, day, h).toISOString(), endsAt: new Date(2026, 9, day, h + length).toISOString(), status, serviceOrderId }) as AppointmentResponse;

describe('agenda indicators', () => {
  it('measures occupancy against open hours times bays, and no-shows only among past visits', () => {
    const result = agendaIndicators([
      item('a', 26, 9, 2, 'COMPLETED', 'so-1'), item('b', 27, 9, 1, 'NO_SHOW'), item('c', 27, 14, 3, 'CANCELLED'),
      item('d', 29, 9, 5, 'SCHEDULED'), item('e', 30, 9, 3, 'CONFIRMED'),
    ], start, end, hours, now);
    expect(result.booked).toBe(4);
    expect(result.converted).toBe(1);
    expect(result.pastBooked).toBe(2);
    expect(result.noShows).toBe(1);
    expect(result.noShowRate).toBe(50);
    // 10 booked hours (no-show and cancelled excluded) of 5 days × 10 h × 2 bays = 100 h
    expect(result.occupancy).toBe(10);
  });

  it('has no rates when there is nothing to measure', () => {
    expect(agendaIndicators([], start, end, hours, now)).toMatchObject({ booked: 0, noShowRate: null, occupancy: 0 });
  });
});
