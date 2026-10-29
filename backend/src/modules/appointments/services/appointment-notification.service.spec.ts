import { AppointmentNotificationService, appointmentMessage } from './appointment-notification.service';

const now = new Date('2026-10-27T15:00:00Z'); // 12:00 in São Paulo
const appointment = (over: Record<string, unknown> = {}) => ({
  id: 'a1', tenantId: 't1', customerId: 'c1', vehicleId: 'v1', serviceDescription: 'Revisão de 10 mil km', status: 'SCHEDULED',
  startsAt: new Date('2026-10-28T12:00:00Z'), reminderSentAt: null, ...over,
});

function setup(due = [appointment()]) {
  const prisma = {
    unscoped: {
      tenant: { findMany: jest.fn().mockResolvedValue([{ id: 't1' }]), findFirst: jest.fn().mockResolvedValue({ id: 't1', name: 'Oficina Boa' }) },
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', name: 'Maria Souza', phone: '(11) 98888-7777' }) },
      vehicle: { findFirst: jest.fn().mockResolvedValue({ brand: 'Fiat', model: 'Uno', plate: 'ABC1D23' }) },
      customerCareSettings: { findFirst: jest.fn().mockResolvedValue(null) },
      appointment: { findMany: jest.fn().mockResolvedValue(due), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    },
    client: { appointment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } },
  };
  const whatsapp = { getConnection: jest.fn().mockResolvedValue({ sessionId: 's' }), sendNotice: jest.fn().mockResolvedValue(undefined) };
  return { prisma, whatsapp, service: new AppointmentNotificationService(prisma as never, whatsapp as never) };
}

describe('appointment WhatsApp messages', () => {
  it('writes the visit in the workshop time zone with service and vehicle', () => {
    const text = appointmentMessage('REMINDER', { customerName: 'Maria Souza', workshopName: 'Oficina Boa', startsAt: new Date('2026-10-28T12:00:00Z'), timeZone: 'America/Sao_Paulo', service: 'Revisão', vehicle: 'Fiat Uno · ABC1D23' });
    expect(text).toContain('Olá, Maria!');
    expect(text).toContain('09:00');
    expect(text).toContain('Fiat Uno · ABC1D23');
    expect(text).toContain('remarcar');
  });

  it('sends each due reminder once, claiming it before calling the provider', async () => {
    const { service, prisma, whatsapp } = setup();
    const result = await service.sendDueReminders(now);
    expect(result.sent).toBe(1);
    expect(prisma.unscoped.appointment.updateMany).toHaveBeenCalledWith({ where: { id: 'a1', tenantId: 't1', reminderSentAt: null }, data: { reminderSentAt: now } });
    expect(whatsapp.sendNotice).toHaveBeenCalledWith({ sessionId: 's' }, '5511988887777@s.whatsapp.net', expect.stringContaining('lembrar'));

    prisma.unscoped.appointment.updateMany.mockResolvedValue({ count: 0 });
    whatsapp.sendNotice.mockClear();
    await service.sendDueReminders(now);
    expect(whatsapp.sendNotice).not.toHaveBeenCalled();
  });

  it('stays quiet at night in the workshop time zone', async () => {
    const { service, whatsapp, prisma } = setup();
    await service.sendDueReminders(new Date('2026-10-28T02:00:00Z')); // 23:00 in São Paulo
    expect(prisma.unscoped.appointment.findMany).not.toHaveBeenCalled();
    expect(whatsapp.sendNotice).not.toHaveBeenCalled();
  });

  it('refuses a manual confirmation when the workshop WhatsApp is off', async () => {
    const { service, whatsapp } = setup();
    whatsapp.getConnection.mockResolvedValue(null);
    await expect(service.sendConfirmation(appointment() as never)).rejects.toThrow('WhatsApp da oficina');
  });
});
