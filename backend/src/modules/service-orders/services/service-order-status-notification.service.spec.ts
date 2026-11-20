import { ServiceUnavailableException } from '@nestjs/common';
import { ServiceOrderStatusNotificationService } from './service-order-status-notification.service';
import { WhatsAppNumberNotFoundException, WhatsAppSessionNotReadyException } from '../../settings/services/wa-akg.service';

const recipient = '5512991289525@s.whatsapp.net';
const record = { id: 'n1', tenantId: 't1', serviceOrderId: 'o1', customerId: 'c1', kind: 'STATUS', recipient, message: 'OS aberta', customerMessageId: null, responseToken: null };

function build(sendNotice: jest.Mock) {
  const notifications = {
    expireClaims: jest.fn(),
    claimNext: jest.fn().mockResolvedValueOnce(record).mockResolvedValue(null),
    finish: jest.fn(),
  };
  const prisma = { unscoped: {
    customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', phone: '(12) 99128-9525', notifyServiceOrderUpdates: true }) },
    serviceOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'o1', status: 'OPEN' }) },
    tenant: { findFirst: jest.fn().mockResolvedValue({ id: 't1' }) },
  } };
  const whatsapp = { getConnection: jest.fn().mockResolvedValue({ baseUrl: 'https://chat.example.com/api', sessionId: '135266', apiKey: 'k' }), sendNotice };
  const service = new ServiceOrderStatusNotificationService(notifications as never, prisma as never, whatsapp as never, {} as never, {} as never, {} as never);
  return { service, notifications };
}

describe('ServiceOrderStatusNotificationService dispatch', () => {
  it('marks a confirmed notice as sent', async () => {
    const { service, notifications } = build(jest.fn().mockResolvedValue(undefined));
    await service.dispatchPending();
    expect(notifications.finish).toHaveBeenCalledWith(record, 'SENT');
  });

  it.each([
    ['NOT_ON_WHATSAPP', new WhatsAppNumberNotFoundException()],
    ['SESSION_DISCONNECTED', new WhatsAppSessionNotReadyException()],
    ['DELIVERY_UNCONFIRMED', new ServiceUnavailableException('timeout')],
  ])('records %s as the failure reason', async (reason, error) => {
    const { service, notifications } = build(jest.fn().mockRejectedValue(error));
    await service.dispatchPending();
    expect(notifications.finish).toHaveBeenCalledWith(record, 'FAILED', reason);
  });
});
