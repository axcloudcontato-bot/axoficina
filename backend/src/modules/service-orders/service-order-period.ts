const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

// Find the first instant of a calendar day, including historical DST changes
// that skipped midnight. This is independent of the server's timezone.
export function startOfWorkshopDay(day: string): Date {
  const reference = Date.parse(`${day}T00:00:00Z`);
  let low = reference - 12 * 3_600_000;
  let high = reference + 36 * 3_600_000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const parts = dayFormatter.formatToParts(middle);
    const value = (type: string) => parts.find((part) => part.type === type)!.value;
    const localDay = `${value('year')}-${value('month')}-${value('day')}`;
    if (localDay < day) low = middle + 1;
    else high = middle;
  }
  return new Date(low);
}

export function serviceOrderPeriod(startDate?: string, endDate?: string) {
  const nextDay = endDate ? new Date(`${endDate}T12:00:00Z`) : undefined;
  if (nextDay) nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return {
    ...(startDate ? { gte: startOfWorkshopDay(startDate) } : {}),
    ...(nextDay ? { lt: startOfWorkshopDay(nextDay.toISOString().slice(0, 10)) } : {}),
  };
}
