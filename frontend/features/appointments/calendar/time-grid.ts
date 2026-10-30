import { agendaSpan, hoursOn, localYmd, type AgendaHours, type AppointmentResponse } from '@oficina/contracts';

export const SLOT_MINUTES = 30;

export interface PlacedAppointment {
  item: AppointmentResponse;
  // Fractions of the visible day (0 = opening, 1 = closing), clamped so off-hours items stay visible.
  top: number;
  height: number;
  lane: number;
  lanes: number;
  outsideHours: boolean;
}

export function slotsOf(hours: AgendaHours): Array<{ hour: number; minute: number }> {
  const slots: Array<{ hour: number; minute: number }> = [];
  // The grid runs from the earliest opening to the latest closing of the week.
  const span = agendaSpan(hours);
  for (let minutes = span.openHour * 60; minutes < span.closeHour * 60; minutes += SLOT_MINUTES) slots.push({ hour: Math.floor(minutes / 60), minute: minutes % 60 });
  return slots;
}

// Places one day's appointments on the grid; overlapping ones share the width side by side.
export function placeDay(items: AppointmentResponse[], day: Date, hours: AgendaHours): PlacedAppointment[] {
  const grid = agendaSpan(hours);
  const open = new Date(day); open.setHours(grid.openHour, 0, 0, 0);
  const span = (grid.closeHour - grid.openHour) * 60;
  const sorted = [...items].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || Date.parse(b.endsAt) - Date.parse(a.endsAt));
  const laneEnds: number[] = [];
  const placed = sorted.map((item) => {
    const start = Date.parse(item.startsAt); const end = Date.parse(item.endsAt);
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(end); } else laneEnds[lane] = end;
    const fromOpen = (start - open.getTime()) / 60_000; const length = (end - start) / 60_000;
    const top = Math.min(Math.max(fromOpen / span, 0), 1 - SLOT_MINUTES / span);
    const height = Math.max(Math.min((fromOpen + length) / span, 1) - top, SLOT_MINUTES / span);
    return { item, top, height, lane, lanes: 0, outsideHours: fromOpen < 0 || fromOpen + length > span };
  });
  return placed.map((entry) => ({ ...entry, lanes: laneEnds.length }));
}

export function withinHours(start: Date, end: Date, hours: AgendaHours): boolean {
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const sameDay = start.toDateString() === end.toDateString();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const day = hoursOn(hours, start.getDay(), localYmd(start));
  return Boolean(day) && sameDay && startMinutes >= day!.openHour * 60 && endMinutes <= day!.closeHour * 60;
}
