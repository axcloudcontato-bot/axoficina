import { DEFAULT_CARE_CAMPAIGNS, DEFAULT_CARE_SETTINGS } from '@oficina/contracts';
import { addDays, birthdayDates, maintenanceContact } from './care-forecast';

describe('customer care forecast', () => {
  const settings = structuredClone(DEFAULT_CARE_SETTINGS);
  const oil = DEFAULT_CARE_CAMPAIGNS.find(item => item.key === 'OIL_CHANGE')!; // 6 meses, avisa 7 dias antes

  it('contacts the customer lead days before the due date', () => {
    // devido em 2026-10-26 (segunda) → aviso em 2026-10-19
    expect(maintenanceContact({ completedAt: new Date('2026-04-26T12:00:00Z'), intervalMonths: null }, oil, settings, '2026-10-01')).toEqual({ date: '2026-10-19', dueDate: '2026-10-26', late: false });
  });
  it('moves weekend contacts to Monday only when the workshop sends on weekdays', () => {
    const sunday = { completedAt: new Date('2026-04-25T12:00:00Z'), intervalMonths: 6 }; // devido 2026-10-25 (domingo), aviso sábado 10-18
    expect(maintenanceContact(sunday, oil, settings, '2026-10-01').date).toBe('2026-10-19');
    expect(maintenanceContact(sunday, oil, { ...settings, weekdaysOnly: false }, '2026-10-01').date).toBe('2026-10-18');
  });
  it('treats plans already inside their lead window as late and due today', () => {
    expect(maintenanceContact({ completedAt: new Date('2025-01-10T12:00:00Z'), intervalMonths: null }, oil, settings, '2026-10-28')).toMatchObject({ date: '2026-10-28', late: true });
  });
  it('places leap-day birthdays on Feb 28 in common years and across year boundaries', () => {
    const born = new Date('2000-02-29T00:00:00Z');
    expect(birthdayDates(born, '2027-01-01', '2027-12-31')).toEqual(['2027-02-28']);
    expect(birthdayDates(born, '2028-01-01', '2028-12-31')).toEqual(['2028-02-29']);
    expect(birthdayDates(new Date('1990-01-05T00:00:00Z'), '2026-12-20', '2027-01-20')).toEqual(['2027-01-05']);
  });
  it('adds days on calendar dates', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
