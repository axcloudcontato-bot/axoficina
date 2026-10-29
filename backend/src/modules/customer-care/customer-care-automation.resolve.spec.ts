import { ConflictException } from '@nestjs/common';
import { CustomerCareAutomationService } from './customer-care-automation.service';

function build(record: Record<string, unknown> | null) {
  const delivery = { findFirst: jest.fn().mockResolvedValue(record), updateMany: jest.fn().mockResolvedValue({ count: record ? 1 : 0 }) };
  const prisma = { unscoped: { customerCareDelivery: delivery } };
  const service = new CustomerCareAutomationService(prisma as never, {} as never, {} as never, {} as never, {} as never);
  return { service, delivery };
}

describe('CustomerCareAutomationService.resolveUnknown', () => {
  const now = new Date('2026-10-29T12:00:00Z');

  it('marks as sent what the team confirmed arrived, keeping the time it was attempted', async () => {
    const { service, delivery } = build({ id: 'd1', status: 'UNKNOWN', attemptedAt: new Date('2026-10-29T10:00:00Z') });
    expect(await service.resolveUnknown('t1', 'd1', 'DELIVERED', now)).toEqual({ status: 'SENT' });
    expect(delivery.updateMany).toHaveBeenCalledWith({ where: { id: 'd1', tenantId: 't1', status: 'UNKNOWN' }, data: { status: 'SENT', sentAt: new Date('2026-10-29T10:00:00Z'), reason: 'Entrega confirmada pela equipe.' } });
  });

  it('turns into a failure what did not arrive, so it can be tried again', async () => {
    const { service, delivery } = build({ id: 'd1', status: 'UNKNOWN', attemptedAt: null });
    expect(await service.resolveUnknown('t1', 'd1', 'NOT_DELIVERED', now)).toEqual({ status: 'FAILED' });
    expect(delivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'FAILED', reason: 'A equipe conferiu e a mensagem não chegou.' } }));
  });

  it('refuses anything that is not an uncertain delivery of this workshop', async () => {
    const { service, delivery } = build(null);
    await expect(service.resolveUnknown('t1', 'd1', 'DELIVERED', now)).rejects.toBeInstanceOf(ConflictException);
    expect(delivery.updateMany).not.toHaveBeenCalled();
  });
});
