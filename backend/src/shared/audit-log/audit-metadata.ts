// Lista positiva: texto livre, e-mails, documentos, placas e assuntos de
// mensagens não devem ser duplicados na fila de auditoria ou no banco.
const ALLOWED_KEYS = new Set(['role', 'vehicleId', 'customerId', 'status', 'fromStatus', 'toStatus', 'method', 'installments', 'anticipated', 'serviceOrderId', 'amountCents', 'category', 'mimeType', 'sizeBytes', 'enabled', 'legalVersion', 'requestId', 'careMessagesEnabled', 'serviceKey', 'completedAt', 'channel', 'reason', 'itemAction', 'previousAmountCents', 'technicianId', 'month', 'completedTarget', 'laborCentsTarget', 'workedMinutesTarget', 'productivityBeforeCents', 'productivityAfterCents', 'openHour', 'closeHour', 'workDays', 'bays', 'remindersEnabled', 'photoEntry', 'photoExit', 'photoItems', 'emailSent', 'plan', 'cycle']);
export function minimizeAuditMetadata(metadata: Record<string, unknown> = {}): Record<string, string | number | boolean> {
  return Object.fromEntries(Object.entries(metadata).filter(([key, value]) => ALLOWED_KEYS.has(key) && ['string', 'number', 'boolean'].includes(typeof value))) as Record<string, string | number | boolean>;
}
