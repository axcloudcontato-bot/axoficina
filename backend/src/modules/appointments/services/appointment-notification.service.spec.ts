import { AppointmentNotificationService, appointmentMessage } from './appointment-notification.service';
import { BadGatewayException } from '@nestjs/common';

const now = new Date('2026-10-27T15:00:00Z'); // 12:00 in São Paulo
const appointment = (over: Record<string, unknown> = {}) => ({
  id: 'a1', tenantId: 't1', customerId: 'c1', vehicleId: 'v1', serviceDescription: 'Revisão de 10 mil km', status: 'SCHEDULED',
  startsAt: new Date('2026-10-28T12:00:00Z'), reminderSentAt: null, ...over,
});

function setup(due = [appointment()]) {
  const prisma = {
    unscoped: {
      tenant: { findMany: jest.fn().mockResolvedValue([{ id: 't1' }]), findFirst: jest.fn().mockResolvedValue({ id: 't1', name: 'Oficina Boa' }) },
      customer: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue({ id: 'c1', name: 'Maria Souza', phone: '(11) 98888-7777', appointmentRemindersEnabled: true }) },
      vehicle: { findFirst: jest.fn().mockResolvedValue({ brand: 'Fiat', model: 'Uno', plate: 'ABC1D23' }) },
      customerCareSettings: { findFirst: jest.fn().mockResolvedValue(null) },
      appointment: { findMany: jest.fn().mockResolvedValue(due), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    },
    client: { customer: { findMany: jest.fn().mockResolvedValue([]) }, appointment: { findFirst: jest.fn().mockResolvedValue(appointment()), updateMany: jest.fn().mockResolvedValue({ count: 1 }) } },
  };
  const whatsapp = { getConnection: jest.fn().mockResolvedValue({ sessionId: 's' }), sendNotice: jest.fn().mockResolvedValue(undefined) };
  return { prisma, whatsapp, service: new AppointmentNotificationService(prisma as never, whatsapp as never, { forTenant: jest.fn().mockResolvedValue({ modules: ['whatsapp'], access: { state: 'active' } }) } as never) };
}

describe('appointment WhatsApp messages', () => {
  it('writes the visit in the workshop time zone with service and vehicle', () => {
    const text = appointmentMessage('REMINDER', { customerName: 'Maria Souza', workshopName: 'Oficina Boa', startsAt: new Date('2026-10-28T12:00:00Z'), timeZone: 'America/Sao_Paulo', service: 'Revisão', vehicle: 'Fiat Uno · ABC1D23' });
    expect(text).toContain('Olá, Maria!');
    expect(text).toContain('09:00');
    expect(text).toContain('Fiat Uno · ABC1D23');
    expect(text).toContain('remarcar');
  });

  it('claims a due reminder and only marks it sent after provider confirmation', async () => {
    const { service, prisma, whatsapp } = setup();
    const result = await service.sendDueReminders(now);
    expect(result.sent).toBe(1);
    expect(prisma.unscoped.appointment.updateMany).toHaveBeenNthCalledWith(1, { where: { id: 'a1', tenantId: 't1', reminderSentAt: null, reminderAttempts: { lt: 4 }, OR: [{ reminderClaimedAt: null }, { reminderClaimedAt: { lt: new Date(now.getTime() - 15 * 60_000) } }] }, data: { reminderClaimedAt: now, reminderAttemptedAt: now, reminderAttempts: { increment: 1 } } });
    expect(prisma.unscoped.appointment.updateMany).toHaveBeenNthCalledWith(2, { where: { id: 'a1', tenantId: 't1', reminderClaimedAt: now }, data: { reminderSentAt: expect.any(Date), reminderClaimedAt: null, reminderLastError: null } });
    expect(whatsapp.sendNotice).toHaveBeenCalledWith({ sessionId: 's' }, '5511988887777@s.whatsapp.net', expect.stringContaining('lembrar'));

    prisma.unscoped.appointment.updateMany.mockResolvedValue({ count: 0 });
    whatsapp.sendNotice.mockClear();
    await service.sendDueReminders(now);
    expect(whatsapp.sendNotice).not.toHaveBeenCalled();
  });

  it('tells the customer how to refuse in the reminder, not in the confirmation', () => {
    const input = { customerName: 'Maria Souza', workshopName: 'Oficina Boa', startsAt: new Date('2026-10-28T12:00:00Z'), timeZone: 'America/Sao_Paulo', service: 'Revisão', vehicle: 'Fiat Uno' };
    expect(appointmentMessage('REMINDER', input)).toContain('Não quer receber lembretes? Avise a oficina.');
    expect(appointmentMessage('CONFIRMATION', input)).not.toContain('Não quer receber');
  });

  it('leaves out customers who refused, without spending an attempt', async () => {
    const { service, prisma, whatsapp } = setup([]);
    prisma.unscoped.customer.findMany.mockResolvedValue([{ id: 'c1' }]);
    await service.sendDueReminders(now);
    expect(prisma.unscoped.customer.findMany).toHaveBeenCalledWith({ where: { tenantId: 't1', appointmentRemindersEnabled: false }, select: { id: true } });
    expect(prisma.unscoped.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ customerId: { notIn: ['c1'] } }) }));
    expect(prisma.unscoped.appointment.updateMany).not.toHaveBeenCalled();
    expect(whatsapp.sendNotice).not.toHaveBeenCalled();
  });

  it('does not send when the refusal arrives while the batch is going out', async () => {
    const { service, prisma, whatsapp } = setup();
    prisma.unscoped.customer.findFirst.mockResolvedValue({ id: 'c1', name: 'Maria Souza', phone: '(11) 98888-7777', appointmentRemindersEnabled: false });
    const result = await service.sendDueReminders(now);
    expect(result.sent).toBe(0);
    expect(whatsapp.sendNotice).not.toHaveBeenCalled();
  });

  it('still lets the desk send a confirmation to a customer who refused reminders', async () => {
    const { service, prisma, whatsapp } = setup();
    prisma.unscoped.customer.findFirst.mockResolvedValue({ id: 'c1', name: 'Maria Souza', phone: '(11) 98888-7777', appointmentRemindersEnabled: false });
    await service.sendConfirmation(appointment() as never);
    expect(whatsapp.sendNotice).toHaveBeenCalledTimes(1);
  });

  it('records a failed attempt without marking the reminder sent', async () => {
    const { service, prisma, whatsapp } = setup();
    whatsapp.sendNotice.mockRejectedValue(new Error('Provedor indisponível'));
    const result = await service.sendDueReminders(now);
    expect(result.sent).toBe(0);
    expect(prisma.unscoped.appointment.updateMany).toHaveBeenNthCalledWith(2, { where: { id: 'a1', tenantId: 't1', reminderClaimedAt: now }, data: { reminderClaimedAt: null, reminderLastError: 'Provedor indisponível' } });
    expect(prisma.unscoped.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ reminderAttempts: { lt: 4 } }) }));
  });

  it('holds an uncertain provider result for manual review to avoid automatic duplicates', async () => {
    const { service, prisma, whatsapp } = setup();
    whatsapp.sendNotice.mockRejectedValue(new BadGatewayException('Provedor não confirmou o envio.'));
    await service.sendDueReminders(now);
    expect(prisma.unscoped.appointment.updateMany).toHaveBeenNthCalledWith(2, { where: { id: 'a1', tenantId: 't1', reminderClaimedAt: now }, data: { reminderClaimedAt: null, reminderLastError: 'Provedor não confirmou o envio.', reminderAttempts: 4 } });
  });

  it('shows a connection failure instead of silently skipping due appointments', async () => {
    const { service, prisma, whatsapp } = setup();
    whatsapp.getConnection.mockRejectedValue(new Error('Conexão indisponível'));
    await service.sendDueReminders(now);
    expect(whatsapp.sendNotice).not.toHaveBeenCalled();
    expect(prisma.unscoped.appointment.updateMany).toHaveBeenNthCalledWith(2, { where: { id: 'a1', tenantId: 't1', reminderClaimedAt: now }, data: { reminderClaimedAt: null, reminderLastError: 'Conexão indisponível' } });
  });

  it('lets an authorized operator retry a failed future reminder immediately', async () => {
    const { service, prisma, whatsapp } = setup();
    prisma.client.appointment.findFirst.mockResolvedValue(appointment({ startsAt: new Date(Date.now() + 3 * 3_600_000), reminderAttempts: 4, reminderClaimedAt: null }));
    await expect(service.retryReminder('t1', 'a1')).resolves.toEqual({ sent: true });
    expect(whatsapp.sendNotice).toHaveBeenCalledTimes(1);
    expect(prisma.client.appointment.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ reminderSentAt: expect.any(Date), reminderLastError: null }) }));
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
