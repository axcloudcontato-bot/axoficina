import { DEFAULT_CARE_CAMPAIGNS, DEFAULT_CARE_SETTINGS, type CareCampaign, type CareCampaignKey, type CareSettings } from '@oficina/contracts';

export const DAY_MS = 86_400_000;
export interface CareEvent { key: string; campaignKey: CareCampaignKey; planId?: string; vehicleId?: string; completedAt?: string; vehicleName?: string; plate?: string }
export function careSettings(record?: { enabled: boolean; channel: string; timeZone: string; sendHour: number; weekdaysOnly: boolean; minGapDays: number; dailyLimit: number; campaigns: unknown } | null): CareSettings {
  if (!record) return structuredClone(DEFAULT_CARE_SETTINGS);
  const saved = Array.isArray(record.campaigns) ? record.campaigns as CareCampaign[] : [];
  return { enabled: record.enabled, channel: record.channel as CareSettings['channel'], timeZone: record.timeZone, sendHour: record.sendHour, weekdaysOnly: record.weekdaysOnly, minGapDays: record.minGapDays, dailyLimit: record.dailyLimit,
    campaigns: DEFAULT_CARE_CAMPAIGNS.map(base => ({ ...base, ...saved.find(item => item.key === base.key), name: base.name, description: base.description, emoji: base.emoji })) };
}
export function localClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), hour: Number(get('hour')), weekend: ['Sat', 'Sun'].includes(get('weekday')) };
}
export function localMidnight(now: Date, timeZone: string): Date {
  const date = localClock(now, timeZone).date;
  let result = new Date(`${date}T00:00:00Z`);
  for (let pass = 0; pass < 3; pass++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(result);
    const get = (key: string) => parts.find(part => part.type === key)!.value;
    const wallTime = Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
    result = new Date(result.getTime() + Date.parse(`${date}T00:00:00Z`) - wallTime);
  }
  return result;
}
export function addMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date); const day = result.getUTCDate();
  result.setUTCDate(1); result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay)); return result;
}
export function birthdayToday(birthDate: Date | null | undefined, now: Date, timeZone: string): boolean {
  if (!birthDate) return false;
  const clock = localClock(now, timeZone);
  const isLeapYear = new Date(Date.UTC(clock.year, 1, 29)).getUTCMonth() === 1;
  const day = birthDate.getUTCMonth() === 1 && birthDate.getUTCDate() === 29 && !isLeapYear ? 28 : birthDate.getUTCDate();
  return birthDate.getUTCMonth() + 1 === clock.month && day === clock.day;
}
export function contactWindow(settings: CareSettings, now: Date, preference?: string | null, birthday = false): boolean {
  const clock = localClock(now, settings.timeZone);
  if (clock.hour < settings.sendHour || clock.hour >= 19 || (settings.weekdaysOnly && clock.weekend && !birthday)) return false;
  if (preference === 'MORNING') return clock.hour < 12;
  if (preference === 'AFTERNOON') return clock.hour >= 12 && clock.hour < 17;
  if (preference === 'EVENING') return clock.hour >= 17;
  return true;
}
export function maintenanceEvent(plan: { id: string; vehicleId: string; serviceKey: string; completedAt: Date; mileage: number | null; intervalMonths: number | null; intervalKm: number | null }, campaign: CareCampaign, now: Date, timeZone: string, currentMileage?: number | null): CareEvent | null {
  if (!campaign.enabled) return null;
  const dueAt = addMonthsClamped(plan.completedAt, plan.intervalMonths ?? campaign.intervalMonths);
  const dueDate = localClock(dueAt, timeZone).date;
  const today = localClock(now, timeZone).date;
  const daysUntil = Math.round((Date.parse(`${dueDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY_MS);
  const intervalKm = plan.intervalKm ?? campaign.intervalKm;
  const mileageDue = plan.mileage !== null && intervalKm !== null && currentMileage != null && currentMileage >= plan.mileage + intervalKm;
  if (daysUntil > campaign.leadDays && !mileageDue) return null;
  const stage = daysUntil <= -14 ? 'FOLLOW_UP' : daysUntil <= 0 || mileageDue ? 'DUE' : 'UPCOMING';
  return { key: `${plan.id}:${plan.completedAt.toISOString()}:${stage}`, campaignKey: campaign.key, planId: plan.id, vehicleId: plan.vehicleId, completedAt: plan.completedAt.toISOString() };
}
export function renderCareMessage(settings: CareSettings, events: CareEvent[], input: { customerName: string; workshopName: string; contact?: string | null; unsubscribeUrl: string }) {
  const firstName = input.customerName.trim().split(/\s+/)[0];
  const render = (event: CareEvent) => {
    const campaign = settings.campaigns.find(item => item.key === event.campaignKey)!;
    const values: Record<string, string> = { cliente: firstName, oficina: input.workshopName, veiculo: event.vehicleName || 'carro', placa: event.plate || '', cuidados: campaign.name };
    return campaign.message.replace(/\{(cliente|oficina|veiculo|placa|cuidados)\}/g, (_match, key: string) => values[key]);
  };
  const birthday = events[0]?.campaignKey === 'BIRTHDAY';
  const body = birthday ? render(events[0]) : `Olá, ${firstName}! 💛 Aqui é a equipe da ${input.workshopName}.\n\nSeparamos estes cuidados para você se programar:\n\n${events.map(render).join('\n\n')}\n\n📅 Quer combinar um horário? Responda a esta mensagem${input.contact ? ` ou fale com a gente: ${input.contact}` : ''}. Estamos por aqui!\n\n🔎 Os prazos são lembretes de avaliação. A necessidade de troca segue o manual do veículo e a inspeção da equipe.`;
  return { subject: birthday ? `🎂 ${firstName}, um carinho da ${input.workshopName}!` : `💛 ${input.workshopName}: próximos cuidados com seu carro`, message: `${body}\n\n${birthday ? `Com carinho, ${input.workshopName}.\n\n` : ''}Preferências de contato: ${input.unsubscribeUrl}` };
}
export function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!); }
