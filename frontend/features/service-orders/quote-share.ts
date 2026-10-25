import type { ServiceOrderResponse } from '@oficina/contracts';
import { formatCurrencyBRL } from '@/lib/format-currency';

export function buildQuoteMessage(serviceOrder: ServiceOrderResponse, whatsapp = true): string {
  const items = serviceOrder.items ?? [];
  const lines = items.map((item) => {
    const type = item.type === 'PART' ? 'Peça' : 'Mão de obra';
    return whatsapp ? `${item.type === 'PART' ? '🔩' : '🔧'} *${type}:* ${item.description} — ${formatCurrencyBRL(item.lineTotalCents)}` : `• ${type}: ${item.description} — ${formatCurrencyBRL(item.lineTotalCents)}`;
  });

  return [
    ...(whatsapp ? [`💰 *ORÇAMENTO DA OS #${String(serviceOrder.orderNumber).padStart(5, '0')}*`, ''] : []),
    `${whatsapp ? '👋 ' : ''}Olá, ${serviceOrder.customerName}!`,
    '',
    ...(whatsapp ? [`🚗 *Veículo:* ${serviceOrder.vehicleBrand} ${serviceOrder.vehicleModel}`, `🔖 *Placa:* ${serviceOrder.vehiclePlate}`] : [`Segue o orçamento da OS #${String(serviceOrder.orderNumber).padStart(5, '0')}.`, `Veículo: ${serviceOrder.vehicleBrand} ${serviceOrder.vehicleModel} · ${serviceOrder.vehiclePlate}`]),
    '',
    ...(lines.length ? lines : ['Nenhum item lançado no orçamento.']),
    '',
    `${whatsapp ? '💰 *Total:*' : 'Total:'} ${formatCurrencyBRL(serviceOrder.totalAmountCents)}`,
    '',
    `${whatsapp ? '💬 ' : ''}Por favor, confirme a aprovação para prosseguirmos com o serviço.`,
  ].join('\n');
}

export function normalizeBrazilianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  return null;
}

export function buildWhatsAppQuoteUrl(phone: string, serviceOrder: ServiceOrderResponse): string | null {
  const normalized = normalizeBrazilianPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(buildQuoteMessage(serviceOrder))}`;
}

export function buildEmailQuoteUrl(email: string, serviceOrder: ServiceOrderResponse): string | null {
  const recipient = email.trim();
  if (!recipient || !recipient.includes('@')) return null;
  const subject = `Orçamento OS #${String(serviceOrder.orderNumber).padStart(5, '0')} — ${serviceOrder.vehiclePlate}`;
  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildQuoteMessage(serviceOrder, false))}`;
}
