export const CUSTOMER_MESSAGE_PRESETS = {
  QUOTE: { label: 'Aprovação do orçamento', question: 'Você aprova este orçamento para realizarmos o serviço?', options: ['Aprovar orçamento', 'Não aprovar', 'Falar com a oficina'], includeQuote: true },
  SCHEDULE: { label: 'Confirmação de agendamento', question: 'Podemos confirmar o agendamento combinado?', options: ['Confirmar agendamento', 'Solicitar outro horário', 'Cancelar agendamento'], includeQuote: false },
  PICKUP: { label: 'Retirada do veículo', question: 'Seu veículo está pronto. Você poderá retirá-lo no horário combinado?', options: ['Confirmar retirada', 'Combinar outro horário'], includeQuote: false },
  CUSTOM: { label: 'Pergunta personalizada', question: '', options: ['Sim', 'Não'], includeQuote: false },
};
export type CustomerMessagePreset = keyof typeof CUSTOMER_MESSAGE_PRESETS;

export function validateCustomerMessage(question: string, options: string[]): string | null {
  if (!question.trim() || question.trim().length > 300) return 'Informe uma pergunta com até 300 caracteres.';
  if (options.length < 2 || options.length > 3 || options.some((option) => !option.trim() || option.trim().length > 60)) return 'Preencha de 2 a 3 botões, com até 60 caracteres cada.';
  if (new Set(options.map((option) => option.trim().toLocaleLowerCase('pt-BR'))).size !== options.length) return 'Cada botão deve ter uma resposta diferente.';
  return null;
}
