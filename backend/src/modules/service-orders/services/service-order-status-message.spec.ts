import { serviceOrderStatusMessage } from './service-order-status-message';
import { SERVICE_ORDER_STATUSES } from '@oficina/contracts';

const event = { companyName: 'AX Oficina', customerName: 'João Silva', orderNumber: 4, vehicle: 'Honda HR-V', plate: 'ABC1D23', openedAt: new Date('2026-10-25T03:00:00Z'), occurredAt: new Date('2026-10-25T15:30:00Z'), expectedDeliveryAt: new Date('2026-10-26T19:00:00Z'), complaint: 'Ruído ao frear', fromStatus: null, toStatus: 'OPEN' as const };
describe('WhatsApp movement messages', () => {
  it.each(SERVICE_ORDER_STATUSES)('formats %s with WhatsApp bold, order data and Brasília timestamps', toStatus => {
    const text = serviceOrderStatusMessage({ ...event, toStatus });
    expect(text).toMatch(/^\*[^*\n]+\*\n/); expect(text).not.toContain('**');
    expect(text).toContain('*OS:* #00004'); expect(text).toContain('*Veículo:* Honda HR-V'); expect(text).toContain('*Placa:* ABC1D23');
    expect(text).toContain('25/10/2026, 12:30 (Brasília)');
  });
  it('distinguishes opening, resumed service and actual delivery without claiming payment', () => {
    expect(serviceOrderStatusMessage(event)).toContain('*Solicitação:* Ruído ao frear');
    expect(serviceOrderStatusMessage({ ...event, fromStatus: 'WAITING_PARTS', toStatus: 'IN_PROGRESS' })).toContain('*SERVIÇO RETOMADO*');
    expect(serviceOrderStatusMessage({ ...event, fromStatus: 'COMPLETED', toStatus: 'DELIVERED' })).not.toContain('Previsão');
    expect(serviceOrderStatusMessage({ ...event, toStatus: 'DELIVERED' })).not.toMatch(/pago|quitado|recebido/i);
  });
  it('keeps client data from adding new formatting or forged status lines', () => {
    const text = serviceOrderStatusMessage({ ...event, customerName: '*João*\n_Status: Entregue_', complaint: '`Falha`\nno freio' });
    expect(text).toContain('*Cliente:* João Status: Entregue');
    expect(text).toContain('*Solicitação:* Falha no freio');
    expect(text).not.toContain('\n_Status');
  });
});
