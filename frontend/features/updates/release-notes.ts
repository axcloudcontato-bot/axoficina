export const RELEASE_NOTES = [
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
