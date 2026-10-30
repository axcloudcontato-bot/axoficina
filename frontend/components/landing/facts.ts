import { PLANS, TRIAL_DAYS } from '@oficina/contracts';
import { formatCurrencyBRL } from '@/lib/format-currency';

// Fatos do produto conferidos no código (contratos, seed e DTOs do backend).
// Se algum número mudar no sistema, atualize aqui: a home e o JSON-LD leem deste arquivo.

/** [valor, rótulo, detalhe] */
export const STATS: Array<[string, string, string]> = [
  ['7', 'status da ordem de serviço', 'Aberta, aguardando aprovação, em andamento, aguardando peças, concluída, entregue e cancelada.'],
  ['3', 'respostas por botão no WhatsApp', 'O cliente escolhe entre aprovar, não aprovar ou falar com a oficina, e a resposta fica na ordem.'],
  ['5', 'perfis prontos de acesso', 'Administrador, gestor, mecânico, recepção e financeiro, além de perfis personalizados.'],
  ['20', 'permissões configuráveis', 'Define quem vê preços, financeiro, equipe e configurações da oficina.'],
  ['7', 'formas de pagamento', 'Pix, dinheiro, cartão de débito, cartão de crédito, transferência, boleto e outras.'],
  ['24', 'parcelas no máximo por ordem', 'O parcelamento vai de 1 a 24 vezes e gera as parcelas no contas a receber.'],
  ['3', 'planos de contratação', `Essencial, Profissional e Completo, de ${formatCurrencyBRL(PLANS.essencial.monthlyPriceCents)} a ${formatCurrencyBRL(PLANS.completo.monthlyPriceCents)} por mês.`],
  [`${TRIAL_DAYS}`, 'dias de teste grátis', 'Sem cartão e com todos os recursos do plano Completo. Depois do teste, você escolhe um plano para continuar.'],
  ['CSV', 'importação e exportação', 'Clientes, veículos e catálogo entram por planilha; clientes, veículos, ordens de serviço e financeiro saem em planilha.'],
];

/** [característica, valor] — ficha técnica para leitura por pessoas e por IAs. */
export const SPEC: Array<[string, string]> = [
  ['Tipo de sistema', 'Software de gestão para oficinas mecânicas (SaaS), em português do Brasil'],
  ['Acesso', 'Pelo navegador, no computador, tablet e celular, sem instalação'],
  ['Ordem de serviço', '7 status, com itens, fotos de até 8 MB cada e histórico de cada mudança'],
  ['Orçamento', 'Enviado pelo WhatsApp, com aprovação por botão registrada na ordem'],
  ['Clientes e veículos', 'Ficha completa com histórico, total gasto e próximos cuidados; dados da tabela FIPE; até 20 fotos por veículo; importação por planilha CSV e junção de cadastros duplicados'],
  ['Catálogo e estoque', 'Peças e serviços com custo, margem e estoque mínimo, baixa automática na entrega da OS, pacotes de serviço e relatório de mais vendidos'],
  ['Agenda', 'Agendamentos com 6 situações: agendado, confirmado, em atendimento, concluído, cancelado e não compareceu'],
  ['Financeiro', 'Contas a pagar e a receber, parcelamento em até 24 vezes, 7 formas de pagamento, fornecedores, fluxo de caixa e relatórios'],
  ['Produtividade', 'Tempo por técnico, eficiência, valor por hora, ocupação, metas, comissões, retornos em garantia e tempo parado'],
  ['Cuidado com o cliente', 'Alertas de manutenção, régua de lembretes por WhatsApp ou e-mail, aniversários e lista para a equipe ligar'],
  ['Documentos', 'Orçamento em PDF e OS impressa com logo, CPF/CNPJ, validade, garantia e termos da oficina'],
  ['Equipe e acesso', '5 perfis prontos, 20 permissões e perfis personalizados'],
  ['Avaliação do cliente', 'Nota de 1 a 5 estrelas pedida pelo WhatsApp depois da entrega'],
  ['Segurança dos dados', 'Ambiente isolado por oficina, acesso por permissão, recuperação de senha, aparelhos conectados, histórico de alterações e documentos de privacidade publicados'],
  ['Planos', `Essencial (${formatCurrencyBRL(PLANS.essencial.monthlyPriceCents)} por mês), Profissional (${formatCurrencyBRL(PLANS.profissional.monthlyPriceCents)}) e Completo (${formatCurrencyBRL(PLANS.completo.monthlyPriceCents)}); ${TRIAL_DAYS} dias de teste grátis, sem cartão`],
];
