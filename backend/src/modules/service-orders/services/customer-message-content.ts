import { SERVICE_ORDER_ITEM_TYPE_LABELS, type CustomerMessagePurpose, type ServiceOrderResponse } from '@oficina/contracts';

const currency = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const escapeMessageHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!);

export function customerMessageContent(order: ServiceOrderResponse, includeQuote: boolean, whatsappPurpose?: CustomerMessagePurpose) {
  if (whatsappPurpose) {
    const title = whatsappPurpose === 'SCHEDULE' ? '📅 *AGENDAMENTO' : whatsappPurpose === 'PICKUP' ? '🚗 *RETIRADA DO VEÍCULO' : includeQuote ? '💰 *ORÇAMENTO' : '💬 *ATENDIMENTO';
    return [
      `${title} · OS #${String(order.orderNumber).padStart(5, '0')}*`, '', `👋 Olá, ${order.customerName}!`, '',
      `🚗 *Veículo:* ${order.vehicleBrand} ${order.vehicleModel}`, `🔖 *Placa:* ${order.vehiclePlate}`,
      ...(includeQuote ? ['', ...(order.items ?? []).map(item => `${item.type === 'PART' ? '🔩' : item.type === 'PRODUCT' ? '🧴' : '🔧'} *${SERVICE_ORDER_ITEM_TYPE_LABELS[item.type]}:* ${item.description} — ${currency(item.lineTotalCents)}`), ...(order.discountCents > 0 ? [`💸 *Desconto:* -${currency(order.discountCents)}`] : []), '', `💰 *Total:* ${currency(order.totalAmountCents)}`] : []),
    ].join('\n');
  }
  return [
    `Olá, ${order.customerName}!`, '',
    `${includeQuote ? 'Orçamento da' : 'Sobre a'} OS #${String(order.orderNumber).padStart(5, '0')}.`,
    `Veículo: ${order.vehicleBrand} ${order.vehicleModel} · ${order.vehiclePlate}`,
    ...(includeQuote ? ['', ...(order.items ?? []).map((item) => `• ${SERVICE_ORDER_ITEM_TYPE_LABELS[item.type]}: ${item.description} — ${currency(item.lineTotalCents)}`), ...(order.discountCents > 0 ? [`Desconto: -${currency(order.discountCents)}`] : []), '', `Total: ${currency(order.totalAmountCents)}`] : []),
  ].join('\n');
}

export function customerMessageEmail(message: string, question: string, options: string[], responseUrl: string) {
  const buttons = options.map((option, index) => `<a href="${escapeMessageHtml(`${responseUrl}?option=${index}`)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 18px;background:#1d4ed8;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold">${escapeMessageHtml(option)}</a>`).join('');
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033"><p style="white-space:pre-wrap">${escapeMessageHtml(message)}</p><h2>${escapeMessageHtml(question)}</h2><p>Escolha uma opção e confirme sua resposta na página que abrir.</p>${buttons}<p>Link válido por 7 dias. Se os botões não aparecerem, acesse: <a href="${escapeMessageHtml(responseUrl)}">Responder à oficina</a>.</p></div>`;
}
