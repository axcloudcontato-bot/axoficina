import type { AgendaHours, AppointmentResponse } from '@oficina/contracts';

// Numbers for the visible period: how full it is and how reliable the bookings are.
export function agendaIndicators(items: AppointmentResponse[], start: Date, end: Date, hours: AgendaHours, now = new Date()) {
  const booked = items.filter((item) => item.status !== 'CANCELLED');
  const occupying = booked.filter((item) => item.status !== 'NO_SHOW');
  const past = booked.filter((item) => Date.parse(item.startsAt) <= now.getTime());
  const noShows = past.filter((item) => item.status === 'NO_SHOW').length;
  let openDays = 0;
  for (const day = new Date(start); day < end; day.setDate(day.getDate() + 1)) if (hours.workDays.includes(day.getDay())) openDays++;
  const capacityMinutes = openDays * (hours.closeHour - hours.openHour) * 60 * (hours.bays ?? 1);
  const bookedMinutes = occupying.reduce((sum, item) => sum + Math.max(0, Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60_000, 0);
  return {
    booked: booked.length,
    converted: booked.filter((item) => item.serviceOrderId).length,
    noShows,
    pastBooked: past.length,
    noShowRate: past.length ? Math.round((noShows / past.length) * 100) : null,
    occupancy: capacityMinutes ? Math.round((bookedMinutes / capacityMinutes) * 100) : null,
  };
}
