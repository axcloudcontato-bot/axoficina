import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DEFAULT_CARE_SETTINGS } from '@oficina/contracts';
import { CustomerCareAutomationService } from './customer-care-automation.service';
import { CustomerCarePlansService } from './customer-care-plans.service';
import { CustomerCareService } from './customer-care.service';

const user = { tenantId: 't1', userId: 'u1' } as never;

describe('team contacts on care plans', () => {
  function build(plan: Record<string, unknown> | null) {
    const prisma = { unscoped: {
      customerCarePlan: { findFirst: jest.fn().mockResolvedValue(plan) },
      customerCareContact: { create: jest.fn().mockResolvedValue({ id: 'k1' }), findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1', name: 'Ana Recepção' }]) },
    } };
    const audit = { record: jest.fn() };
    return { service: new CustomerCarePlansService(prisma as never, audit as never), prisma, audit };
  }

  it('records an attempt on a plan of this workshop, with the note trimmed, and audits it', async () => {
    const { service, prisma, audit } = build({ id: 'p1' });
    expect(await service.recordContact(user, { id: 'p1', outcome: 'NO_ANSWER', note: ' Caixa postal ' })).toEqual({ id: 'k1' });
    expect(prisma.unscoped.customerCareContact.create).toHaveBeenCalledWith({ data: { tenantId: 't1', planId: 'p1', outcome: 'NO_ANSWER', note: 'Caixa postal', createdBy: 'u1' } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'customer_care.contact_recorded', entityId: 'p1' }));
  });

  it('refuses a plan of another workshop or unknown', async () => {
    const { service, prisma } = build(null);
    await expect(service.recordContact(user, { id: 'p9', outcome: 'NO_ANSWER' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.contacts('t1', 'p9')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.unscoped.customerCareContact.create).not.toHaveBeenCalled();
  });

  it('lists the attempts newest first with who made each one', async () => {
    const { service, prisma } = build({ id: 'p1' });
    prisma.unscoped.customerCareContact.findMany.mockResolvedValue([
      { id: 'k2', outcome: 'WILL_SCHEDULE', note: null, createdBy: 'u1', createdAt: new Date('2026-10-29T12:00:00Z') },
      { id: 'k1', outcome: 'NO_ANSWER', note: 'Caixa postal', createdBy: null, createdAt: new Date('2026-10-28T12:00:00Z') },
    ]);
    expect((await service.contacts('t1', 'p1')).contacts).toEqual([
      { id: 'k2', outcome: 'WILL_SCHEDULE', at: '2026-10-29T12:00:00.000Z', byName: 'Ana Recepção', note: undefined },
      { id: 'k1', outcome: 'NO_ANSWER', at: '2026-10-28T12:00:00.000Z', byName: undefined, note: 'Caixa postal' },
    ]);
  });
});

describe('filtered history', () => {
  function build() {
    const delivery = { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) };
    const prisma = { unscoped: { customerCareDelivery: delivery, customerCareSettings: { findFirst: jest.fn().mockResolvedValue(null) } } };
    return { service: new CustomerCareService(prisma as never, {} as never, {} as never, {} as never), delivery };
  }

  it('turns the chosen result, campaign, customer and period into the query', async () => {
    const { service, delivery } = build();
    await service.deliveries('t1', { status: 'NOT_SENT', campaignKey: 'OIL_CHANGE', search: ' mari ', from: '2026-10-01', to: '2026-10-31', offset: 30, limit: 30 });
    const where = delivery.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ tenantId: 't1', status: { in: ['FAILED', 'SKIPPED'] }, campaignKeys: { has: 'OIL_CHANGE' }, customerName: { contains: 'mari', mode: 'insensitive' } });
    // Days in São Paulo time: 1 Oct 00:00 to the end of 31 Oct.
    expect(where.createdAt.gte.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(where.createdAt.lt.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(delivery.findMany.mock.calls[0][0]).toMatchObject({ skip: 30, take: 30 });
  });

  it('groups the uncertain and the waiting ones, and shows everything when no result is chosen', async () => {
    const { service, delivery } = build();
    await service.deliveries('t1', { status: 'CHECK' });
    expect(delivery.findMany.mock.calls[0][0].where.status).toEqual({ in: ['UNKNOWN'] });
    await service.deliveries('t1', { status: 'QUEUED' });
    expect(delivery.findMany.mock.calls[1][0].where.status).toEqual({ in: ['PENDING', 'SENDING'] });
    await service.deliveries('t1', {});
    expect(delivery.findMany.mock.calls[2][0].where).toEqual({ tenantId: 't1' });
  });
});

describe('test send', () => {
  function build(connection: unknown) {
    const whatsapp = { getConnection: jest.fn().mockResolvedValue(connection), sendNotice: jest.fn() };
    const care = { preview: jest.fn().mockResolvedValue({ subject: 'x', message: 'Olá, Mariana! Lembrete de teste.' }), settings: jest.fn().mockResolvedValue(DEFAULT_CARE_SETTINGS) };
    return { service: new CustomerCareAutomationService({} as never, care as never, whatsapp as never, {} as never, {} as never), whatsapp, care };
  }

  it('sends the real campaign message, marked as a test, to the number given', async () => {
    const { service, whatsapp, care } = build({ sessionId: 's' });
    expect(await service.testSend('t1', { campaignKey: 'OIL_CHANGE', phone: '(11) 99999-8888', message: 'Texto editado da campanha de óleo' })).toEqual({ sent: true });
    expect(care.preview).toHaveBeenCalledWith('t1', { campaignKey: 'OIL_CHANGE', message: 'Texto editado da campanha de óleo' });
    expect(whatsapp.sendNotice).toHaveBeenCalledWith({ sessionId: 's' }, expect.stringContaining('11999998888'), expect.stringMatching(/^🧪 \*Mensagem de teste\*\n\nOlá, Mariana!/));
  });

  it('asks for a usable number and a connected WhatsApp before sending', async () => {
    const off = build(null);
    await expect(off.service.testSend('t1', { campaignKey: 'OIL_CHANGE', phone: '11999998888' })).rejects.toBeInstanceOf(ConflictException);
    const on = build({ sessionId: 's' });
    await expect(on.service.testSend('t1', { campaignKey: 'OIL_CHANGE', phone: '123' })).rejects.toBeInstanceOf(BadRequestException);
    expect(on.whatsapp.sendNotice).not.toHaveBeenCalled();
  });
});
