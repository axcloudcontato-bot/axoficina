import type { CareCampaign, CareSettings } from '@oficina/contracts';
import { addMonthsClamped, DAY_MS, localClock } from './care-policy';

export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());

export interface ForecastPlanInput { completedAt: Date; intervalMonths: number | null }

// First contact for a plan: `leadDays` before the due date, pushed to the next
// business day when the workshop only sends on weekdays. A plan already inside
// its lead window is "late" and goes out on the next scan (today).
export function maintenanceContact(plan: ForecastPlanInput, campaign: CareCampaign, settings: CareSettings, today: string): { date: string; dueDate: string; late: boolean } {
  const dueDate = localClock(addMonthsClamped(plan.completedAt, plan.intervalMonths ?? campaign.intervalMonths), settings.timeZone).date;
  const planned = addDays(dueDate, -campaign.leadDays);
  const late = planned < today;
  let date = late ? today : planned;
  if (settings.weekdaysOnly) while (isWeekend(date)) date = addDays(date, 1);
  return { date, dueDate, late };
}

// Same rule as birthdayToday: born on Feb 29 → Feb 28 in common years.
export function birthdayDates(birthDate: Date, from: string, to: string): string[] {
  const month = birthDate.getUTCMonth() + 1; const day = birthDate.getUTCDate(); const result: string[] = [];
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year++) {
    const leap = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
    const date = `${year}-${String(month).padStart(2, '0')}-${String(month === 2 && day === 29 && !leap ? 28 : day).padStart(2, '0')}`;
    if (date >= from && date <= to) result.push(date);
  }
  return result;
}
