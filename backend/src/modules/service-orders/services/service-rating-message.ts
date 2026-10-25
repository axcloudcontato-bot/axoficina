const plain = (value: string) => value.replace(/[*_`~\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, 240);

export function serviceRatingMessage(input: { customerName: string; companyName: string; orderNumber: number; vehicle: string; plate: string }) {
  return [
    '⭐ *AVALIE NOSSO SERVIÇO*', '', `👋 Olá, ${plain(input.customerName)}!`,
    'Seu veículo foi entregue. Obrigado por confiar na nossa oficina!', '',
    `📋 *OS:* #${String(input.orderNumber).padStart(5, '0')}`,
    `🚗 *Veículo:* ${plain(input.vehicle)}`, `🔖 *Placa:* ${plain(input.plate)}`, '',
    'Sua opinião nos ajuda a melhorar. Toque em *Avaliar serviço* e escolha de *1 a 5 estrelas*, sendo *1 — Ruim* e *5 — Ótimo*.',
    '', `*${plain(input.companyName)}*`,
  ].join('\n');
}
