import { PLANS, TRIAL_DAYS } from '@oficina/contracts';
import { formatCurrencyBRL } from '@/lib/format-currency';

const price = (code: keyof typeof PLANS) => formatCurrencyBRL(PLANS[code].monthlyPriceCents);

export const FAQ: Array<[string, string]> = [
  ['O Ofix serve para a minha oficina?', 'Ele foi feito para oficinas mecânicas: da recepção ao financeiro, passando por ordens de serviço, agenda, clientes e veículos.'],
  ['Preciso instalar alguma coisa?', 'Não. O Ofix funciona no navegador, no computador do balcão e no tablet do pátio. Basta cadastrar sua oficina e começar.'],
  ['Quanto custa o Ofix?', `Há três planos, cobrados por oficina: Essencial por ${price('essencial')} por mês, Profissional por ${price('profissional')} e Completo por ${price('completo')}. Você testa ${TRIAL_DAYS} dias grátis antes de pagar.`],
  ['Tem teste grátis?', `Sim: ${TRIAL_DAYS} dias grátis, sem pedir cartão, com todos os recursos do plano Completo. Ao fim do teste o sistema fica só para consulta, com os seus dados guardados, até você escolher um plano e pagar.`],
  ['Qual plano devo escolher?', 'O Essencial cobre o dia a dia: clientes, veículos, ordens de serviço, agenda e catálogo. O Profissional soma Financeiro, Produtividade e Cuidado com o cliente. O Completo traz também o WhatsApp, o histórico de alterações e a exportação dos dados, e não limita usuários nem ordens de serviço.'],
  ['Posso trocar de plano depois?', 'Sim, pelo próprio sistema. Subir de plano vale na hora e o valor proporcional é cobrado. Descer vale a partir do próximo pagamento, sem perder nada antes.'],
  ['Como é feito o pagamento?', 'A assinatura é paga com cartão, na página segura do Stripe. As faturas e os recibos ficam disponíveis dentro do sistema, e o cartão pode ser trocado quando você quiser.'],
  ['Meus dados ficam separados dos de outras oficinas?', 'Sim. Cada oficina é um ambiente isolado, com seus próprios usuários, clientes e registros.'],
  ['Posso controlar o que cada pessoa da equipe vê?', 'Sim. Há 5 perfis prontos (administrador, gestor, mecânico, recepção e financeiro) e perfis personalizados, com 20 permissões que definem quem vê preços, financeiro, equipe e configurações.'],
  ['Como funciona a aprovação pelo WhatsApp?', 'No plano Completo, você conecta o WhatsApp da oficina nas configurações. O cliente recebe o orçamento e responde com um botão, e a resposta aparece na ordem de serviço. Nos outros planos, o orçamento sai em PDF para você enviar como preferir.'],
  ['Posso migrar os dados da minha planilha?', 'Sim, para clientes, veículos e itens do catálogo: o sistema importa planilhas CSV sem duplicar o que já está cadastrado. Outros dados, como ordens de serviço antigas, não são importados automaticamente. Se a sua base for grande, escreva para contato@axcloud.com.br para avaliarmos o seu caso.'],
  ['Posso levar meus dados embora?', 'Sim. No plano Completo, o administrador exporta clientes, veículos, ordens de serviço e financeiro em planilha quando quiser. Nos demais, a exportação pode ser pedida pelo e-mail de contato.'],
  ['Como tratam a privacidade dos dados?', 'Política de privacidade, termos de uso, cookies e política de reembolso estão publicados e acessíveis no rodapé deste site.'],
  ['O Ofix funciona no celular e no tablet?', 'Sim. O sistema funciona no navegador do computador, do tablet e do celular, sem instalar nada. O mecânico pode trabalhar pela ordem de serviço direto no tablet do pátio.'],
  ['Como funciona o suporte?', 'O atendimento é por e-mail, em contato@axcloud.com.br. Pedidos de privacidade também podem ser feitos pela Central de privacidade, dentro do sistema.'],
  ['Posso cancelar quando quiser?', 'Sim. O administrador cancela em Assinatura e dados, e o sistema continua funcionando até o fim do período já pago. Depois disso fica só para consulta e os dados continuam guardados. As condições estão nos Termos de uso e na política de reembolso.'],
];
