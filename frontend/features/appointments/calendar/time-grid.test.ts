import { describe, expect, it } from 'vitest';
import type { AppointmentResponse } from '@oficina/contracts';
import { placeDay, slotsOf, withinHours } from './time-grid';

const hours = { openHour: 8, closeHour: 18, workDays: [1, 2, 3, 4, 5, 6] };
const day = new Date(2026, 9, 26); // Monday
const at = (h: number, m = 0) => new Date(2026, 9, 26, h, m).toISOString();
const item = (id: string, start: string, end: string) => ({ id, startsAt: start, endsAt: end }) as AppointmentResponse;

describe('agenda time grid', () => {
  it('splits opening hours into 30-minute slots', () => {
    const slots = slotsOf(hours);
    expect(slots).toHaveLength(20);
    expect(slots[0]).toEqual({ hour: 8, minute: 0 });
    expect(slots.at(-1)).toEqual({ hour: 17, minute: 30 });
  });

  it('positions an appointment by start and duration', () => {
    const [placed] = placeDay([item('a', at(13), at(15))], day, hours);
    expect(placed.top).toBeCloseTo(0.5);
    expect(placed.height).toBeCloseTo(0.2);
    expect(placed.outsideHours).toBe(false);
  });

  it('puts overlapping appointments side by side and reuses a lane once it is free', () => {
    const placed = placeDay([item('a', at(9), at(11)), item('b', at(10), at(12)), item('c', at(11), at(12))], day, hours);
    const lane = Object.fromEntries(placed.map((entry) => [entry.item.id, entry.lane]));
    expect(lane).toEqual({ a: 0, b: 1, c: 0 });
    expect(placed.every((entry) => entry.lanes === 2)).toBe(true);
  });

  it('keeps off-hours appointments visible and flags them', () => {
    const [early] = placeDay([item('a', at(6), at(7))], day, hours);
    expect(early.top).toBe(0);
    expect(early.outsideHours).toBe(true);
  });

  it('knows whether an interval fits the opening hours', () => {
    expect(withinHours(new Date(at(9)), new Date(at(10)), hours)).toBe(true);
    expect(withinHours(new Date(at(17)), new Date(at(19)), hours)).toBe(false);
    expect(withinHours(new Date(2026, 9, 25, 9), new Date(2026, 9, 25, 10), hours)).toBe(false); // Sunday
  });
});
