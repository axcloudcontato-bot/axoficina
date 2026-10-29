import { DEFAULT_CARE_CAMPAIGNS, DEFAULT_CARE_SETTINGS } from '@oficina/contracts';
import { careRecipient, addMonthsClamped, birthdayToday, contactWindow, localClock, localMidnight, maintenanceEvent, renderCareMessage } from './care-policy';

describe('customer care policy', () => {
  const settings = structuredClone(DEFAULT_CARE_SETTINGS);
  const oil = DEFAULT_CARE_CAMPAIGNS.find(item => item.key === 'OIL_CHANGE')!;
  const plan = { id: 'plan', vehicleId: 'vehicle', serviceKey: 'OIL_CHANGE', completedAt: new Date('2026-04-26T12:00:00Z'), mileage: 10000, intervalMonths: null, intervalKm: null };

  it('uses local dates, including when UTC has already moved to tomorrow', () => {
    expect(localClock(new Date('2026-10-27T01:00:00Z'), 'America/Sao_Paulo').date).toBe('2026-10-26');
    expect(localMidnight(new Date('2026-10-27T01:00:00Z'), 'America/Sao_Paulo').toISOString()).toBe('2026-10-26T03:00:00.000Z');
  });
  it('clamps end-of-month intervals without spilling into the following month', () => {
    expect(addMonthsClamped(new Date('2026-08-31T12:00:00Z'), 6).toISOString()).toBe('2027-02-28T12:00:00.000Z');
    expect(addMonthsClamped(new Date('2027-08-31T12:00:00Z'), 6).toISOString()).toBe('2028-02-29T12:00:00.000Z');
  });
  it('celebrates leap-day birthdays once, on Feb 28 in common years', () => {
    const birthday = new Date('2000-02-29T00:00:00Z');
    expect(birthdayToday(birthday, new Date('2027-02-28T13:00:00Z'), settings.timeZone)).toBe(true);
    expect(birthdayToday(birthday, new Date('2028-02-28T13:00:00Z'), settings.timeZone)).toBe(false);
    expect(birthdayToday(birthday, new Date('2028-02-29T13:00:00Z'), settings.timeZone)).toBe(true);
  });
  it('respects preferred hours, business days and the evening cutoff', () => {
    expect(contactWindow(settings, new Date('2026-10-26T13:00:00Z'), 'AFTERNOON')).toBe(false);
    expect(contactWindow(settings, new Date('2026-10-26T16:00:00Z'), 'AFTERNOON')).toBe(true);
    expect(contactWindow(settings, new Date('2026-10-26T22:00:00Z'), 'EVENING')).toBe(false);
    expect(contactWindow(settings, new Date('2026-10-25T13:00:00Z'))).toBe(false);
    expect(contactWindow(settings, new Date('2026-10-25T13:00:00Z'), null, true)).toBe(true);
  });
  it('issues distinct advance, due and follow-up events, never an endless weekly campaign', () => {
    expect(maintenanceEvent(plan, oil, new Date('2026-10-18T13:00:00Z'), settings.timeZone)).toBeNull();
    expect(maintenanceEvent(plan, oil, new Date('2026-10-19T13:00:00Z'), settings.timeZone)?.key).toMatch(/UPCOMING$/);
    expect(maintenanceEvent(plan, oil, new Date('2026-10-26T13:00:00Z'), settings.timeZone)?.key).toMatch(/DUE$/);
    const final = maintenanceEvent(plan, oil, new Date('2026-11-09T13:00:00Z'), settings.timeZone)?.key;
    expect(final).toMatch(/FOLLOW_UP$/);
    expect(maintenanceEvent(plan, oil, new Date('2027-01-26T13:00:00Z'), settings.timeZone)?.key).toBe(final);
  });
  it('never projects mileage, and triggers when a real recorded reading reaches the limit', () => {
    const now = new Date('2026-06-26T13:00:00Z');
    expect(maintenanceEvent(plan, oil, now, settings.timeZone, 19999)).toBeNull();
    expect(maintenanceEvent(plan, oil, now, settings.timeZone, 20000)?.key).toMatch(/DUE$/);
    expect(maintenanceEvent({ ...plan, mileage: null }, oil, now, settings.timeZone, 20000)).toBeNull();
  });
  it('groups services into one caring message with a protected preferences footer', () => {
    const content = renderCareMessage(settings, [{ key: '1', campaignKey: 'OIL_CHANGE', vehicleName: 'Honda Fit' }, { key: '2', campaignKey: 'BRAKES', vehicleName: 'Honda Fit' }], { customerName: 'Mariana Silva', workshopName: 'Oficina Exemplo', unsubscribeUrl: 'https://example.invalid/preferences' });
    expect(content.message).toContain('Olá, Mariana! 💛');
    expect(content.message).toContain('Honda Fit');
    expect(content.message).toContain('Só indicamos a troca');
    expect(content.message.match(/Preferências de contato/g)).toHaveLength(1);
    expect(content.message).toContain('manual do veículo');
  });

  describe('careRecipient', () => {
    const tenant = { waAkgEnabled: true, smtpEnabled: true };
    const customer = { phone: '(11) 99999-8888', email: 'cliente@example.com', preferredContactChannel: null };

    it('uses the customer preferred channel, or the workshop default', () => {
      expect(careRecipient(customer, { channel: 'WHATSAPP' }, tenant)).toEqual({ channel: 'WHATSAPP', recipient: expect.any(String) });
      expect(careRecipient({ ...customer, preferredContactChannel: 'EMAIL' }, { channel: 'WHATSAPP' }, tenant)).toEqual({ channel: 'EMAIL', recipient: 'cliente@example.com' });
    });

    it('says why a customer cannot be reached', () => {
      expect(careRecipient(customer, { channel: 'WHATSAPP' }, { ...tenant, waAkgEnabled: false })).toEqual({ reason: 'CHANNEL_OFF' });
      expect(careRecipient({ ...customer, phone: '9999' }, { channel: 'WHATSAPP' }, tenant)).toEqual({ reason: 'NO_WHATSAPP' });
      expect(careRecipient({ ...customer, preferredContactChannel: 'EMAIL', email: null }, { channel: 'WHATSAPP' }, tenant)).toEqual({ reason: 'NO_EMAIL' });
      expect(careRecipient({ ...customer, preferredContactChannel: 'EMAIL' }, { channel: 'WHATSAPP' }, { ...tenant, smtpEnabled: false })).toEqual({ reason: 'CHANNEL_OFF' });
      expect(careRecipient({ ...customer, preferredContactChannel: 'PHONE' }, { channel: 'WHATSAPP' }, tenant)).toEqual({ reason: 'PHONE_PREFERRED' });
      expect(careRecipient({ ...customer, preferredContactChannel: 'SMS' }, { channel: 'WHATSAPP' }, tenant)).toEqual({ reason: 'PHONE_PREFERRED' });
    });
  });
});
