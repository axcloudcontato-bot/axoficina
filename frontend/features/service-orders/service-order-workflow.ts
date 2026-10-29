import { QUOTE_APPROVAL_QUESTION, SERVICE_ORDER_PHOTO_ANGLES, type CustomerMessageResponse, type ServiceOrderPhotoResponse, type ServiceOrderResponse, type ServiceOrderStatus } from '@oficina/contracts';

export const WORKFLOW_STEPS = [
  { id: 'entry', label: 'Entrada' }, { id: 'quote', label: 'Orçamento' }, { id: 'approval', label: 'Aprovação' }, { id: 'execution', label: 'Execução' }, { id: 'delivery', label: 'Entrega' },
] as const;
export type WorkflowStep = typeof WORKFLOW_STEPS[number]['id'];

export function defaultWorkflowStep(status: ServiceOrderStatus): WorkflowStep {
  if (status === 'OPEN') return 'entry';
  if (status === 'AWAITING_APPROVAL') return 'approval';
  if (status === 'IN_PROGRESS' || status === 'WAITING_PARTS') return 'execution';
  return 'delivery';
}

export function workflowPhotoCoverage(order: ServiceOrderResponse, photos: ServiceOrderPhotoResponse[]) {
  const angles = (category: 'ENTRY' | 'EXIT') => SERVICE_ORDER_PHOTO_ANGLES.filter(angle => !photos.some(photo => photo.category === category && photo.angle === angle));
  const itemIds = (category: 'ISSUE' | 'RESOLVED') => new Set(photos.filter(photo => photo.category === category).map(photo => photo.serviceOrderItemId));
  const before = itemIds('ISSUE'); const after = itemIds('RESOLVED');
  return { entry: angles('ENTRY'), exit: angles('EXIT'), items: (order.items ?? []).filter(item => item.type === 'PART' && (!before.has(item.id) || !after.has(item.id))) };
}

export function quoteApprovalState(messages: CustomerMessageResponse[], now = Date.now(), order?: ServiceOrderResponse) {
  const latest = messages.find(message => message.purpose === 'QUOTE' || message.question === QUOTE_APPROVAL_QUESTION);
  if (!latest) return { state: 'not-sent' as const, latest };
  if (!latest.quote) return { state: 'legacy' as const, latest };
  const normalize = (items: NonNullable<ServiceOrderResponse['items']>) => JSON.stringify(items.map(({ id, description, type, quantity, unitPriceCents, lineTotalCents }) => ({ id, description, type, quantity, unitPriceCents, lineTotalCents })).sort((a, b) => a.id.localeCompare(b.id)));
  if (latest.quoteIsCurrent === false || order && normalize(latest.quote.items as NonNullable<ServiceOrderResponse['items']>) !== normalize(order.items ?? [])) return { state: 'changed' as const, latest };
  if (latest.answeredAt && latest.selectedOption !== undefined) return { state: latest.selectedOption === 0 ? 'approved' as const : latest.selectedOption === 1 ? 'declined' as const : 'contact' as const, latest };
  if (Date.parse(latest.expiresAt) <= now) return { state: 'expired' as const, latest };
  if (!latest.sentAt) return { state: latest.deliveryMode === 'WA_AKG' ? 'uncertain' as const : latest.channel === 'WHATSAPP' ? 'prepared' as const : 'waiting' as const, latest };
  return { state: 'waiting' as const, latest };
}
