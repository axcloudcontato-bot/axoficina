export type ContentPage = {
  slug: string;
  navLabel: string;
  title: string;
  h1: string;
  description: string;
  /** Primeira frase da página: define o assunto de forma direta, para buscadores e assistentes de IA. */
  definition: string;
  sections: Array<{ h2: string; paragraphs: string[]; bullets?: string[] }>;
  faq: Array<[string, string]>;
  related: string[];
};

export const CONTENT_PAGES: ContentPage[] = [
  {
    slug: 'software-para-oficina-mecanica',
    navLabel: 'Software para oficina mecânica',
    title: 'Software para oficina mecânica',
    h1: 'Software para oficina mecânica: o que um sistema de gestão precisa ter',
    description: 'Veja o que um software para oficina mecânica deve reunir: ordens de serviço, clientes, veículos, agenda, financeiro e permissões. Conheça o Ofix.',
    definition: 'Um software para oficina mecânica é um sistema de gestão que reúne em um só lugar o atendimento, as ordens de serviço, o cadastro de clientes e veículos, a agenda e o financeiro da oficina.',
    sections: [
      {
        h2: 'Para que serve um sistema de gestão de oficina',
        paragraphs: [
          'Em muitas oficinas, a informação vive em cadernos, planilhas e conversas de WhatsApp. O orçamento se perde, o histórico do carro depende da memória de quem atendeu e o financeiro só fecha no fim do mês. Um sistema de gestão substitui essa rotina solta por um fluxo único, do cliente na porta até o carro entregue e cobrado.',
          'A vantagem não é só organização. Com os registros no mesmo lugar, a recepção responde ao cliente com o status em mãos, o mecânico trabalha pela ordem de serviço e o dono enxerga o que cada serviço rende.',
        ],
      },
      {
        h2: 'O que procurar ao escolher um software para oficina',
        paragraphs: ['Antes de decidir, confira se o sistema cobre o dia a dia real do pátio e do balcão:'],
        bullets: [
          'Ordens de serviço com itens, fotos e status acompanhados do início ao fim.',
          'Cadastro de clientes e histórico por veículo.',
          'Orçamento enviado ao cliente e aprovação registrada na própria ordem.',
          'Agenda de horários e alertas de manutenção para trazer o cliente de volta.',
          'Financeiro integrado: contas a pagar e a receber, parcelas e relatórios.',
          'Perfis de acesso por função, para que cada pessoa veja só o que precisa.',
          'Funcionamento no navegador, sem instalação, no computador do balcão e no tablet do pátio.',
        ],
      },
      {
        h2: 'Como o Ofix atende a oficina mecânica',
        paragraphs: [
          'O Ofix reúne esses recursos em um sistema simples e rápido. O cliente e o veículo são cadastrados com dados da tabela FIPE, a ordem de serviço recebe itens e fotos, e o orçamento segue para aprovação pelo WhatsApp, com a resposta registrada na ordem.',
          'Depois da entrega, o sistema gera as parcelas e o recibo, e permite pedir a avaliação do cliente. Cada oficina tem um ambiente isolado, com usuários e permissões próprios, e há papéis prontos para administrador, gestor, mecânico e recepção.',
        ],
      },
    ],
    faq: [
      ['Software para oficina mecânica precisa ser instalado?', 'No Ofix, não. O sistema funciona no navegador, no computador, no tablet e no celular, sem instalar nada.'],
      ['Quem da oficina usa o sistema?', 'Recepção, mecânicos, financeiro e dono ou gestor. Cada função tem papéis prontos e é possível criar perfis de acesso com permissões detalhadas.'],
      ['O Ofix substitui a planilha de controle?', 'Ele reúne ordens de serviço, clientes, veículos, agenda e financeiro no mesmo sistema, para que a oficina não dependa de planilhas separadas.'],
    ],
    related: ['ordem-de-servico-para-oficina', 'controle-financeiro-para-oficina'],
  },
  {
    slug: 'ordem-de-servico-para-oficina',
    navLabel: 'Ordem de serviço para oficina',
    title: 'Ordem de serviço para oficina mecânica',
    h1: 'Ordem de serviço para oficina mecânica: como organizar do orçamento à entrega',
    description: 'Entenda o que é a ordem de serviço de uma oficina mecânica, o que registrar e como acompanhar orçamento, aprovação, execução e entrega no Ofix.',
    definition: 'A ordem de serviço (OS) de uma oficina mecânica é o registro que acompanha o veículo da entrada até a entrega: problema relatado, itens e serviços, valores, aprovação do cliente e status da execução.',
    sections: [
      {
        h2: 'O que registrar em uma ordem de serviço',
        paragraphs: ['Uma boa OS evita retrabalho e discussões na entrega, porque deixa claro o que foi combinado e o que foi feito. Os registros essenciais são:'],
        bullets: [
          'Cliente e veículo, com o histórico de atendimentos anteriores.',
          'Problema relatado na chegada e fotos do estado do veículo.',
          'Peças e serviços, com quantidade e valor de cada item.',
          'Aprovação do orçamento pelo cliente.',
          'Status da execução e responsável pelo trabalho.',
          'Valor final, forma de pagamento e recibo.',
        ],
      },
      {
        h2: 'Do orçamento à aprovação pelo WhatsApp',
        paragraphs: [
          'Orçamento que só existe numa conversa se perde com facilidade. No Ofix, você conecta o WhatsApp da oficina nas configurações, e o cliente recebe o orçamento e responde com um botão. A resposta aparece na ordem de serviço, de modo que a aprovação fica registrada junto com os itens.',
        ],
      },
      {
        h2: 'Acompanhando o status e imprimindo a OS',
        paragraphs: [
          'O mecânico trabalha pela ordem: itens, status e fotos, inclusive no tablet. A recepção vê em que etapa cada carro está e informa o cliente sem precisar procurar o responsável. Quando for necessário um documento em papel, a ordem de serviço tem impressão em A4 pronta.',
        ],
      },
      {
        h2: 'Da entrega ao financeiro',
        paragraphs: [
          'Ao finalizar a ordem, o sistema gera as parcelas e o recibo, e os valores seguem para o contas a receber. Depois da entrega, é possível pedir ao cliente uma nota de cinco estrelas, e o histórico do veículo fica guardado para a próxima visita.',
        ],
      },
    ],
    faq: [
      ['O que é uma ordem de serviço em oficina mecânica?', 'É o documento digital ou impresso que registra o veículo, o problema, os itens e serviços, os valores, a aprovação do cliente e o andamento do trabalho até a entrega.'],
      ['Posso mandar o orçamento pelo WhatsApp?', 'Sim. Com o WhatsApp da oficina conectado, o cliente recebe o orçamento e responde com um botão; a resposta fica registrada na ordem de serviço.'],
      ['A ordem de serviço pode ser impressa?', 'Sim, o Ofix tem impressão em A4 pronta para a ordem de serviço.'],
    ],
    related: ['software-para-oficina-mecanica', 'controle-financeiro-para-oficina'],
  },
  {
    slug: 'controle-financeiro-para-oficina',
    navLabel: 'Controle financeiro para oficina',
    title: 'Controle financeiro para oficina mecânica',
    h1: 'Controle financeiro para oficina mecânica: contas, parcelas e fluxo de caixa',
    description: 'Como organizar o financeiro de uma oficina mecânica: contas a pagar e a receber, parcelas das ordens de serviço, fornecedores, fluxo de caixa e relatórios.',
    definition: 'O controle financeiro de uma oficina mecânica reúne contas a pagar e a receber, parcelas das ordens de serviço, fornecedores e fluxo de caixa, para que o dono saiba quanto entra, quanto sai e quanto sobra.',
    sections: [
      {
        h2: 'Por que separar o financeiro da planilha solta',
        paragraphs: [
          'Quando o financeiro mora em planilhas independentes das ordens de serviço, cada valor precisa ser digitado duas vezes e as diferenças só aparecem no fechamento. Com o financeiro ligado à OS, o que foi cobrado do cliente já chega ao contas a receber, sem retrabalho.',
        ],
      },
      {
        h2: 'O que acompanhar no dia a dia',
        paragraphs: ['Um controle financeiro útil para oficina cobre, no mínimo:'],
        bullets: [
          'Contas a pagar: peças, aluguel, impostos e demais despesas, com vencimento.',
          'Contas a receber: parcelas das ordens de serviço e valores em aberto.',
          'Fornecedores cadastrados, para conferir o que foi comprado de cada um.',
          'Categorias de receita e despesa, para saber onde o dinheiro entra e sai.',
          'Fluxo de caixa, com a visão do que já foi movimentado e do que ainda vai entrar ou sair.',
          'Relatórios, para decidir com números e não com impressão.',
        ],
      },
      {
        h2: 'Como o financeiro funciona no Ofix',
        paragraphs: [
          'No Ofix, ao finalizar uma ordem de serviço o sistema gera as parcelas e o recibo. O módulo financeiro traz contas a pagar e a receber, lançamentos, movimentações, categorias, fornecedores, fluxo de caixa e relatórios analíticos, com impressão em A4.',
          'O acesso ao financeiro pode ser limitado por perfil: quem trabalha na recepção ou no pátio não precisa ver valores e configurações da oficina.',
        ],
      },
    ],
    faq: [
      ['O Ofix controla contas a pagar e a receber?', 'Sim. O módulo financeiro tem contas a pagar e a receber, lançamentos, movimentações, categorias e fornecedores.'],
      ['As parcelas da ordem de serviço vão para o financeiro?', 'Sim. Ao finalizar a ordem, o sistema gera as parcelas e o recibo, e os valores seguem para o contas a receber.'],
      ['Posso limitar quem vê o financeiro?', 'Sim. Perfis de acesso definem quem vê preços, financeiro e configurações.'],
    ],
    related: ['software-para-oficina-mecanica', 'ordem-de-servico-para-oficina'],
  },
];

export const getContentPage = (slug: string) => CONTENT_PAGES.find((page) => page.slug === slug);
