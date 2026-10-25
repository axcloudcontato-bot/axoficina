import { describe, expect, it } from 'vitest';
import type { CustomerMessageResponse, ServiceOrderResponse } from '@oficina/contracts';
import { defaultWorkflowStep, quoteApprovalState } from '../service-order-workflow';

const item = { id: 'item', description: 'Revisão', type: 'LABOR', quantity: 1, unitPriceCents: 15000, lineTotalCents: 15000 };
const order = { items: [item] } as ServiceOrderResponse;
const message = { id: 'quote', purpose: 'QUOTE', quote: { items: [item], totalAmountCents: 15000 }, options: ['Aprovar', 'Não aprovar', 'Conversar'], question: 'Aprova?', sentAt: '2026-10-24T12:00:00Z', quoteIsCurrent: true, expiresAt: '2030-01-01T00:00:00Z' } as CustomerMessageResponse;

describe('service order workflow', () => {
  it('opens in the real operational stage, independently of tabs visited earlier', () => {
    expect(defaultWorkflowStep('OPEN')).toBe('entry'); expect(defaultWorkflowStep('AWAITING_APPROVAL')).toBe('approval');
    expect(defaultWorkflowStep('IN_PROGRESS')).toBe('execution'); expect(defaultWorkflowStep('WAITING_PARTS')).toBe('execution');
    expect(defaultWorkflowStep('COMPLETED')).toBe('delivery'); expect(defaultWorkflowStep('DELIVERED')).toBe('delivery');
  });
  it('only treats a current, explicit quote answer as approved', () => {
    expect(quoteApprovalState([message], 0, order).state).toBe('waiting');
    expect(quoteApprovalState([{ ...message, answeredAt: '2026-10-24T13:00:00Z', selectedOption: 0 }], 0, order).state).toBe('approved');
    expect(quoteApprovalState([{ ...message, purpose: 'PICKUP', question: 'Retirada' }], 0, order).state).toBe('not-sent');
  });
  it('detects item edits immediately even before the message history refreshes', () => {
    const approved = { ...message, answeredAt: '2026-10-24T13:00:00Z', selectedOption: 0 };
    expect(quoteApprovalState([approved], 0, { ...order, items: [{ ...item, description: 'Revisão ampliada' } as never] }).state).toBe('changed');
    expect(quoteApprovalState([{ ...approved, quote: undefined }], 0, order).state).toBe('legacy');
  });
  it('keeps prepared app handoffs separate from confirmed deliveries and provider uncertainty', () => {
    expect(quoteApprovalState([{ ...message, channel: 'WHATSAPP', sentAt: undefined, deliveryMode: 'LINK' }], 0).state).toBe('prepared');
    expect(quoteApprovalState([{ ...message, channel: 'WHATSAPP', sentAt: undefined, deliveryMode: 'WA_AKG' }], 0).state).toBe('uncertain');
    expect(quoteApprovalState([{ ...message, expiresAt: '2020-01-01T00:00:00Z' }]).state).toBe('expired');
  });
});
