export const RELEASE_NOTES = [
  {
    id: '2026-10-29-veiculos', date: '2026-10-29', title: "Veículos com ficha completa, troca de dono e planilhas",
    items: [
      "A placa passa a ser gravada no padrão ABC1D23 e validada (formato antigo e Mercosul). As placas já cadastradas foram corrigidas, e o mesmo carro não entra mais duas vezes com grafias diferentes.",
      "A quilometragem registrada na OS atualiza o veículo. Informar um km menor que o atual pede confirmação antes de salvar.",
      "Nova ficha do veículo: dono, quilometragem, histórico de OS, próximos cuidados (com os vencidos destacados), agendamentos e as leituras de km das OS. O cuidado já feito pode ser registrado ali mesmo.",
      "Transferência de veículo para outro dono, com agendamentos e lembretes seguindo o carro e as OS antigas preservadas.",
      "A lista mostra ano, km, número de OS e última visita; busca também pelo nome do dono; filtros de veículos em andamento e sem visita há 6 meses; ordenação por placa, ano ou km.",
      "Arquivar avisa sobre OS em andamento e agendamentos futuros, e a aba Arquivados permite reativar. Cor do veículo e combustível em lista.",
      "Importação de veículos por planilha CSV (o dono é encontrado pelo documento ou telefone) e exportação da lista em CSV.",
    ],
  },
  {
    id: '2026-10-29-clientes', date: '2026-10-29', title: "Clientes com ficha, planilhas e junção de cadastros duplicados",
    items: [
      "Novo cliente cadastra só o cliente, sem abrir uma OS. A busca por nome, telefone ou documento espera a digitação e a lista mostra documento e telefone formatados.",
      "Nova ficha do cliente: veículos, ordens de serviço, última visita, total gasto, ticket médio, pendências, agendamentos e atalhos de WhatsApp, ligar e Nova OS. Os valores só aparecem para quem pode ver preços.",
      "A lista mostra placas, última visita e total gasto, com filtros de clientes com valor a receber e sem visita há mais de 6 meses.",
      "Arquivar um cliente avisa sobre OS em andamento e valores a receber, e a aba Arquivados permite reativar. O tipo pessoa física ou jurídica pode ser corrigido, conferido com o documento.",
      "Aviso ao cadastrar um telefone que já existe, para evitar o mesmo cliente duas vezes.",
      "Juntar cadastros duplicados (administrador e gerente): veículos, OS, agendamentos e mensagens passam para o cadastro mantido.",
      "Importação de clientes por planilha CSV, sem duplicar quem já está cadastrado, e exportação da lista em CSV.",
      "O registro da autorização de lembretes agora guarda como o cliente autorizou, a data e quem registrou.",
    ],
  },
  {
    id: '2026-10-29-catalogo', date: '2026-10-29', title: "Peças e serviços com custo, estoque, pacotes e relatório",
    items: [
      "Preço editado direto na lista, filtro de itens sem preço, valor da hora da oficina e preço calculado pelo tempo padrão do serviço.",
      "Custo, margem de lucro, código, marca, unidade e fornecedor. O custo e a margem só aparecem para quem vê o financeiro.",
      "Controle de estoque de peças e produtos: estoque mínimo, entradas, contagem, baixa automática na entrega da OS e aviso de estoque baixo.",
      "Pacotes de serviço, como a revisão básica, lançados na OS com um clique pelos preços de hoje.",
      "Importação de itens por planilha CSV e a aba Mais vendidos, com faturamento e lucro por período.",
      "Ao lançar na OS um serviço do catálogo, o próximo cuidado do cliente já vem marcado para o Relacionamento.",
    ],
  },
  {
    id: '2026-10-29-agenda', date: '2026-10-29', title: "Agenda por horário, com capacidade e lembretes",
    items: [
      "Grade por horário com arrastar para remarcar, indicadores do dia e agendamento que acompanha a OS (entregue conclui, cancelada cancela).",
      "Horário de funcionamento e capacidade de atendimentos ao mesmo tempo configuráveis nas configurações.",
      "Lembretes e confirmação de agendamento enviados por WhatsApp quando a integração está ativa.",
    ],
  },
  {
    id: '2026-10-29-ordens-de-servico', date: '2026-10-29', title: "Ordens de serviço mais seguras e completas",
    items: [
      "Desconto na OS, com subtotal e desconto separados, e prazo de garantia.",
      "Motivo obrigatório ao cancelar uma OS. Mudanças em itens de OS encerrada pedem um motivo e ficam registradas com o valor antes e depois.",
      "Política de fotos configurável nas configurações e mais travas para impedir valores inconsistentes.",
    ],
  },
  {
    id: '2026-10-29-painel', date: '2026-10-29', title: "Visão da oficina com números exatos",
    items: [
      "Os números do dia passam a ser exatos e carregam juntos, mais rápido.",
      "Novos blocos de OS aguardando e da fila de cada mecânico.",
    ],
  },
  {
    id: '2026-10-29-previsao-contatos', date: '2026-10-29', title: "Previsão de contatos no Relacionamento",
    items: [
      "Nova aba que mostra quantos clientes serão contactados no mês, na semana e no dia, com a estimativa de possíveis agendamentos.",
    ],
  },
  {
    id: '2026-10-29-equipe', date: '2026-10-29', title: "Renomear usuários da equipe",
    items: [
      "Administradores podem corrigir o nome de um usuário nas configurações da equipe.",
    ],
  },
  {
    id: '2026-10-25-icones-whatsapp', date: '2026-10-25', title: 'Mensagens do WhatsApp com ícones por assunto',
    items: ['Emojis nas mensagens de abertura, orçamento, agendamento, execução, peças, retirada, entrega e avaliação.', 'Títulos em negrito e dados da OS organizados com ícones nativos do WhatsApp.'],
  },
  {
    id: '2026-10-25-relatorio-analitico', date: '2026-10-25', title: 'Relatório financeiro analítico em paisagem',
    items: ['Detalhamento de cada receita e despesa, incluindo cliente ou fornecedor, datas, categoria, situação, valores e observações.', 'Filtros por período, vencimento ou realização, natureza, situação e categoria, com busca por cliente, fornecedor, OS ou placa.', 'Impressão em A4 paisagem com todos os registros filtrados, totais e cabeçalho repetido nas páginas.'],
  },
  {
    id: '2026-10-25-cadastro-lancamento', date: '2026-10-25', title: 'Cadastre sem sair do lançamento',
    items: ['Novo botão + ao lado de Cliente e Fornecedor no lançamento financeiro.', 'O cadastro abre em um modal e o novo registro é selecionado automaticamente, preservando os dados da receita ou despesa.'],
  },
  {
    id: '2026-10-25-avaliacao-servico', date: '2026-10-25', title: 'Avaliação do serviço após a entrega',
    items: ['Ao registrar a entrega da OS, o cliente recebe pelo WhatsApp uma avaliação de 1 a 5 estrelas, de Ruim a Ótimo.', 'A nota fica registrada na OS e a resposta aparece no sino de notificações.'],
  },
  {
    id: '2026-10-25-confirmacao-resposta', date: '2026-10-25', title: 'Confirmações do WhatsApp mais objetivas',
    items: ['Após responder por um botão, o cliente recebe a confirmação da escolha sem repetir a pergunta original.'],
  },
  {
    id: '2026-10-25-largura-painel', date: '2026-10-25', title: 'Mais espaço para trabalhar no desktop',
    items: ['As telas do painel aproveitam toda a largura disponível, com margens laterais menores em monitores grandes.'],
  },
  {
    id: '2026-10-25-avisos-whatsapp-status', date: '2026-10-25', title: 'Cliente acompanha a OS pelo WhatsApp',
    items: [
      'Nova opção nas Preferências do cliente: receber avisos sobre toda movimentação da Ordem de Serviço.',
      'A abertura e cada mudança de status enviam uma mensagem estruturada, com títulos em negrito e dados da OS.',
      'Os avisos ficam registrados na OS, com acompanhamento do envio e nova tentativa após conferência da conversa.',
    ],
  },
  {
    id: '2026-10-24-fluxo-atendimento', date: '2026-10-24', title: 'Do atendimento à entrega, com etapas mais claras',
    items: [
      'A OS agora acompanha Entrada, Orçamento, Aprovação, Execução e Entrega, com as ações de cada momento.',
      'A aprovação tem prévia do orçamento, escolha do canal e acompanhamento da resposta. O início do serviço é confirmado pela equipe.',
      'Orçamentos alterados precisam de uma nova aprovação. O cliente vê os itens e valores da mensagem que recebeu.',
      'A conferência mostra as fotos pendentes antes da conclusão, e a retirada é registrada separadamente do aviso ao cliente.',
      'Alterações em digitação são preservadas durante as atualizações da OS e têm indicação de salvamento.',
    ],
  },
  {
    id: '2026-10-24-painel-mobile', date: '2026-10-24', title: 'Painel mais compacto no celular',
    items: ['Valores e ícones menores nos cards do painel, com títulos e descrições alinhados.', 'Valores monetários maiores ajustam o tamanho do texto para caber melhor na tela.'],
  },
  {
    id: '2026-10-24-historico-os', date: '2026-10-24', title: 'Entregas e histórico de ordens de serviço',
    items: [
      'Novo card Entregues, com os veículos entregues no dia ou período escolhido. Clique para consultar as respectivas ordens.',
      'Consulte o histórico por data de entrada ou de entrega e cancelamento, com atalhos de período e datas personalizadas.',
      'Os filtros consultam todo o histórico e os resultados têm paginação. A lista também mostra as datas de entrada e encerramento.',
    ],
  },
  {
    id: '2026-10-24-atendimento-busca', date: '2026-10-24', title: 'Atendimento com menos digitação',
    items: [
      'A busca aproveita o nome, CPF/CNPJ, telefone, e-mail ou dados do veículo ao abrir um novo cadastro. Você pode escolher o campo de destino.',
      'Os resultados destacam primeiro o cliente e depois o veículo.',
      'O campo de busca do cabeçalho fica sempre visível, inclusive no celular.',
      'Este ícone reúne o histórico das melhorias disponíveis no sistema.',
    ],
  },
  {
    id: '2026-10-24-fotos-celular', date: '2026-10-24', title: 'Envio de fotos pelo celular',
    items: ['Fotos preparadas para um envio mais leve, com indicação de preparação, envio e salvamento.', 'Falhas ficam visíveis na tela e permitem tentar enviar novamente sem tirar outra foto quando a imagem já foi preparada.'],
  },
  {
    id: '2026-10-24-respostas-sino', date: '2026-10-24', title: 'Respostas dos clientes no sino',
    items: ['Avisos no painel e contador de respostas não lidas no sino.', 'Histórico com cliente, OS e opção escolhida, com leitura individual para cada usuário.'],
  },
  {
    id: '2026-10-24-botoes-clientes', date: '2026-10-24', title: 'Perguntas com botões para os clientes',
    items: ['Envio de opções de resposta pelo WhatsApp integrado e por e-mail.', 'As escolhas ficam registradas na OS e o WhatsApp confirma o recebimento da resposta.'],
  },
] as const;
