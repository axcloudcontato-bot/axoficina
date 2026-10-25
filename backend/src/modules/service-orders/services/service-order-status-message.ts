import type { ServiceOrderStatus } from '@oficina/contracts';

export const MOVEMENT_STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  OPEN: 'Aberta', AWAITING_APPROVAL: 'Aguardando aprovação', IN_PROGRESS: 'Em andamento', WAITING_PARTS: 'Aguardando peças',
  COMPLETED: 'Pronto para entrega', DELIVERED: 'Entregue', CANCELLED: 'Cancelada',
};
const COPY: Record<ServiceOrderStatus, [string, string]> = {
  OPEN: ['ORDEM DE SERVIÇO ABERTA', 'Seu atendimento foi aberto. Vamos avaliar o veículo e preparar o orçamento.'],
  AWAITING_APPROVAL: ['ORÇAMENTO EM APROVAÇÃO', 'Estamos aguardando a autorização do orçamento. Em caso de dúvida, fale com a oficina.'],
  IN_PROGRESS: ['SERVIÇO INICIADO', 'Os serviços no seu veículo estão em andamento.'],
  WAITING_PARTS: ['AGUARDANDO PEÇAS', 'Os serviços estão aguardando as peças necessárias. Avisaremos sobre os próximos passos.'],
  COMPLETED: ['VEÍCULO PRONTO PARA RETIRADA', 'Os serviços foram concluídos. Entre em contato com a oficina para combinar a retirada.'],
  DELIVERED: ['VEÍCULO ENTREGUE', 'A entrega do seu veículo foi registrada. Obrigado pela preferência!'],
  CANCELLED: ['ORDEM DE SERVIÇO CANCELADA', 'O atendimento foi cancelado. Se precisar de esclarecimentos, fale com a oficina.'],
};
const ICONS: Record<ServiceOrderStatus, string> = { OPEN: '📝', AWAITING_APPROVAL: '💰', IN_PROGRESS: '🔧', WAITING_PARTS: '📦', COMPLETED: '🚗', DELIVERED: '🏁', CANCELLED: '❌' };
const plain = (value: string) => value.replace(/[*_`~\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, 240);
const date = (value: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(value);

export function serviceOrderStatusMessage(input: { companyName: string; customerName: string; orderNumber: number; vehicle: string; plate: string; openedAt: Date; expectedDeliveryAt: Date | null; complaint: string | null; fromStatus: ServiceOrderStatus | null; toStatus: ServiceOrderStatus; occurredAt: Date }) {
  const resumed = input.toStatus === 'IN_PROGRESS' && input.fromStatus === 'WAITING_PARTS';
  const [title, description] = resumed ? ['SERVIÇO RETOMADO', 'As peças estão disponíveis e retomamos os serviços no seu veículo.'] : COPY[input.toStatus];
  return [
    `${resumed ? '🔄' : ICONS[input.toStatus]} *${title}*`, '', `👋 Olá, ${plain(input.customerName)}!`, description, '',
    `📋 *OS:* #${String(input.orderNumber).padStart(5, '0')}`,
    `👤 *Cliente:* ${plain(input.customerName)}`, `🚗 *Veículo:* ${plain(input.vehicle)}`, `🔖 *Placa:* ${plain(input.plate)}`,
    ...(input.fromStatus ? [`*De:* ${MOVEMENT_STATUS_LABELS[input.fromStatus]}`] : []),
    `*Status registrado:* ${MOVEMENT_STATUS_LABELS[input.toStatus]}`,
    `🕒 *Movimentação em:* ${date(input.occurredAt)} (Brasília)`,
    ...(input.toStatus === 'OPEN' ? [`*Abertura:* ${date(input.openedAt)} (Brasília)`, ...(input.complaint ? [`*Solicitação:* ${plain(input.complaint)}`] : [])] : []),
    ...(!['DELIVERED', 'CANCELLED', 'COMPLETED'].includes(input.toStatus) && input.expectedDeliveryAt ? [`📅 *Previsão de entrega:* ${date(input.expectedDeliveryAt)} (Brasília)`] : []),
    '', `*${plain(input.companyName)}*`, '💬 Para falar sobre o atendimento ou ajustar os avisos, entre em contato com a oficina.',
  ].join('\n');
}
