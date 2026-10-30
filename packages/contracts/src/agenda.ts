import type { AgendaHours, DayHours } from './response/settings.response';

// The hours of one day: null when the workshop is closed (not a work day, or a date marked closed, like a holiday).
// A weekday with its own hours (Saturday until noon) overrides the general opening and closing.
export function hoursOn(hours: AgendaHours, weekday: number, ymd?: string): DayHours | null {
  if (!hours.workDays.includes(weekday)) return null;
  if (ymd && hours.closedDates?.includes(ymd)) return null;
  return hours.dayHours?.[String(weekday)] ?? { openHour: hours.openHour, closeHour: hours.closeHour };
}

// The rows the agenda grid needs: from the earliest opening to the latest closing of the week.
export function agendaSpan(hours: AgendaHours): DayHours {
  const days = hours.workDays.map((day) => hours.dayHours?.[String(day)] ?? { openHour: hours.openHour, closeHour: hours.closeHour });
  if (!days.length) return { openHour: hours.openHour, closeHour: hours.closeHour };
  return { openHour: Math.min(...days.map((day) => day.openHour)), closeHour: Math.max(...days.map((day) => day.closeHour)) };
}

// YYYY-MM-DD of a date in the device's own time zone (the workshop's, for the agenda screens).
export function localYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
