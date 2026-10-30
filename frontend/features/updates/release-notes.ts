export const RELEASE_NOTES = [
  {
    id: '2026-10-30-conta-historico', date: '2026-10-30', title: "Conta da oficina: aparelhos conectados, assinatura, exportação e histórico",
    items: [
      "Minha conta mostra os aparelhos em que a sua conta está aberta. Dá para desconectar um deles ou sair de todos os outros de uma vez, útil depois de perder um celular.",
      "Assinatura e dados: o administrador vê o plano, o valor, o vencimento e se o pagamento está em dia.",
      "Exportar os dados da oficina: clientes, veículos, ordens de serviço e financeiro em planilha, para guardar uma cópia ou levar para outro lugar. Cada exportação fica registrada.",
      "Histórico de alterações: o administrador vê quem fez o quê e quando (preços, equipe, configurações, exclusões, acessos), com filtro por área e por período.",
    ],
  },
  {
    id: '2026-10-30-configuracoes-padroes', date: '2026-10-30', title: "Configurações: padrões da OS, horário por dia e documentos com a marca da oficina",
    items: [
      "Padrões da OS, em Configurações, Operação: garantia que já vem em toda OS nova, validade do orçamento, termos e condições impressos e as formas de pagamento que a oficina aceita.",
      "O orçamento em PDF agora traz o nome, a logo, o CPF/CNPJ e o contato da oficina, a validade, os termos e o rodapé. A OS impressa também passa a mostrar os termos e o rodapé, que antes não apareciam em nenhum documento.",
      "Horário por dia da semana (por exemplo, sábado até o meio-dia) e dias fechados, como feriados e férias coletivas. A Agenda, a ocupação e o cronômetro dos técnicos passam a respeitar esse horário.",
      "O valor da hora da oficina e o prazo dos alertas de manutenção agora também podem ser ajustados em Operação, junto com os outros padrões.",
      "Empresa: CPF/CNPJ, telefone e CEP ficam formatados, o endereço é preenchido pelo CEP e há um botão para baixar um orçamento de exemplo e ver como o cliente vai receber.",
      "E-mail: escolha o provedor (Gmail, Outlook, Titan, Zoho, Hostinger, Locaweb) e servidor, porta e SSL são preenchidos sozinhos, com a dica de cada um, como a senha de app do Gmail.",
      "Equipe: nova coluna Último acesso, para ver quem nunca entrou ou não usa o sistema há tempo.",
      "A visão geral das Configurações mostra o quanto a oficina está pronta para usar o sistema e o próximo passo.",
    ],
  },
  {
    id: '2026-10-30-configuracoes-senha', date: '2026-10-30', title: "Configurações: recuperação de senha, Minha conta e envio da logo",
    items: [
      "Esqueci minha senha: na tela de login, informe o e-mail e receba um link para criar uma nova senha, válido por 1 hora.",
      "Minha conta, no menu do seu perfil: troque a sua senha informando a atual. Os outros aparelhos conectados à sua conta saem na hora.",
      "Em Configurações, Equipe, o administrador gera um link de nova senha para quem esqueceu e não recebe e-mail. Ele vale por 24 horas e pode ser enviado pelo WhatsApp.",
      "A logo da oficina (até 500 KB) e os comprovantes do financeiro (até 2 MB) voltam a ser enviados. Antes, arquivos acima de uns 70 KB eram recusados. Quando um arquivo passa do limite, a mensagem agora diz isso.",
      "E-mail: a porta virou uma lista com as opções que os provedores usam, a opção SSL acompanha a porta escolhida e o teste funciona antes de ligar o envio para os clientes.",
      "O CPF/CNPJ da empresa é conferido pelos dígitos já na tela, antes de ir para os documentos.",
      "A visão geral das Configurações mostra o que falta nos dados da empresa, o horário e as fotos exigidas, e lista os ajustes que ficam em outras telas: valor da hora, alertas, régua do Cuidado com o cliente, metas e comissões.",
    ],
  },
  {
    id: '2026-10-30-seguranca', date: '2026-10-30', title: "Segurança: e-mail, login e atualizações",
    items: [
      "O servidor de e-mail (SMTP) agora precisa ser o endereço público do seu provedor, nas portas 25, 465, 587 ou 2525. Se o teste de e-mail passar a recusar a configuração, confira o endereço e a porta indicados pelo provedor.",
      "O limite de tentativas de login passa a valer para cada aparelho separadamente, então o erro de senha de uma pessoa não bloqueia o acesso de outras.",
      "Atualizações de segurança nos componentes do sistema e proteções extras no navegador.",
    ],
  },
  {
    id: '2026-10-29-produtividade-retrabalho-comissao', date: '2026-10-29', title: "Produtividade: retornos em garantia, comissões e tempo parado",
    items: [
      "Retorno em garantia: quando o veículo volta e tem uma OS entregue ainda na garantia, a nova OS pergunta se é retorno. Marcado, conta como retrabalho para os técnicos da OS original, na coluna Retornos da Produtividade.",
      "Comissões do mês: defina o percentual sobre a mão de obra de cada técnico e um bônus quando a meta de mão de obra for atingida. O valor a pagar sai calculado e pode ser exportado em CSV. Só gerentes e administradores veem.",
      "Tempo parado: o mecânico registra quando não está em uma OS (esperando peça, limpeza, deslocamento, treinamento). Ao iniciar trabalho numa OS, o tempo parado encerra sozinho. A Produtividade mostra as horas paradas de cada técnico.",
      "Minha produtividade no painel do mecânico: OS entregues contra a meta, tempo em OS, eficiência, retornos em garantia e o botão de tempo parado, sem ver os números dos colegas.",
    ],
  },
  {
    id: '2026-10-29-produtividade-eficiencia', date: '2026-10-29', title: "Produtividade: eficiência, valor por hora, ocupação e gráficos",
    items: [
      "Eficiência por técnico: o tempo padrão dos serviços entregues (cadastrado no catálogo) comparado com o tempo registrado nessas OS. Acima de 100%, o serviço saiu no tempo ou mais rápido; abaixo de 80%, aparece em destaque.",
      "Valor por hora: a mão de obra das OS com tempo registrado dividida pelas horas, por técnico e da equipe, ao lado do valor da hora da oficina.",
      "Ocupação: o tempo em OS no mês comparado com as horas de funcionamento da agenda até hoje, para ver quem está ocioso ou sobrecarregado.",
      "Comparativo da equipe em barras (mão de obra, horas em OS ou eficiência) e a evolução da mão de obra e das OS entregues nos últimos 6 meses.",
      "No detalhe de cada técnico, cada OS mostra o tempo previsto e o real, destacando as que demoraram bem mais que o previsto.",
      "O CSV exportado inclui eficiência, valor por hora e ocupação.",
    ],
  },
  {
    id: '2026-10-29-produtividade', date: '2026-10-29', title: "Produtividade: tempo confiável, correção pelo gerente e visão do mecânico",
    items: [
      "O cronômetro da OS para de contar no horário de fechamento da oficina: um cronômetro esquecido ligado à noite não vira horas de trabalho. Se o técnico esquecer, ao iniciar o próximo trabalho o anterior é encerrado sozinho no fechamento.",
      "Gerentes e administradores podem corrigir ou excluir um registro de tempo na própria OS, informando o motivo. Se a OS já foi entregue, a mão de obra é redividida pelo tempo corrigido, sem mudar o total.",
      "A Produtividade avisa quando há cronômetro parecendo esquecido, com link para a OS.",
      "Botão Copiar metas do mês anterior: repete as metas para quem ainda não tem neste mês.",
      "Mecânicos agora veem a própria produtividade: OS entregues em que trabalharam, tempo registrado, OS com eles agora e o andamento da meta. Valores só aparecem para quem pode ver preços.",
      "Tabela mais clara: a coluna passou a se chamar OS em que trabalhou, há uma linha com o total da equipe (cada OS conta uma vez) e a variação em relação ao mês anterior aparece em cada número, inclusive no tempo registrado.",
    ],
  },
  {
    id: '2026-10-29-cuidado-cliente-equipe', date: '2026-10-29', title: "Cuidado com o cliente: lista para a equipe ligar e histórico com filtros",
    items: [
      "Nova aba Para a equipe ligar: os cuidados vencidos ou próximos de clientes que não autorizaram os lembretes automáticos, com WhatsApp (mensagem pronta para você editar), ligar, agendar já preenchido e registro de cada contato, mostrando o último e quantas tentativas houve.",
      "Histórico dos disparos com filtros por resultado (enviados, não enviados, para conferir, na fila), campanha, cliente e período.",
      "Botão Enviar teste para mim nas campanhas: a mensagem da tela chega no seu WhatsApp, marcada como teste, antes de ligar os envios para os clientes.",
      "Os números do topo abrem a lista correspondente: cuidados a acompanhar, envios do mês e aniversários.",
      "Canal, horários, limite diário e ativação dos envios agora ficam numa aba própria, Ajustes da régua, separada da apresentação.",
    ],
  },
  {
    id: '2026-10-29-cuidado-cliente', date: '2026-10-29', title: "Cuidado com o cliente: ninguém fica de fora sem aviso",
    items: [
      "Novo aviso de clientes que autorizaram os lembretes mas não vão receber, com o motivo de cada um: telefone sem WhatsApp válido, e-mail faltando, canal da oficina desconectado ou preferência por ligação. Antes eles ficavam de fora sem ninguém saber.",
      "Envios com resultado incerto (\"Conferir envio\") agora podem ser resolvidos: depois de conferir a conversa, marque se a mensagem chegou ou não. O que não chegou pode ser enviado de novo.",
      "Planos por veículo em ordem do que vence primeiro, com busca por placa, modelo ou cliente, filtro de vencidos e dos que vencem em 30 dias, e o total certo. Cada plano mostra se o cliente recebe o lembrete sozinho ou precisa de contato da equipe.",
      "A ficha do veículo e os Alertas de manutenção passaram a usar os prazos que a oficina definiu em cada campanha, e não os prazos padrão.",
      "O botão Agendar dos Alertas de manutenção já abre o agendamento com o cliente e o carro preenchidos.",
      "O módulo passa a ter um nome só em todas as telas: Cuidado com o cliente.",
    ],
  },
  {
    id: '2026-10-29-alertas-contato', date: '2026-10-29', title: "Alertas de manutenção: contato com o cliente e prazo da oficina",
    items: [
      "Cada alerta agora tem atalhos para falar com o cliente: WhatsApp com uma mensagem pronta (você lê e edita antes de enviar), ligar, agendar e abrir uma OS já com o cliente e o carro.",
      "Novo botão Registrar contato: anote se mandou mensagem, se o cliente não atendeu, se vai agendar ou se não quer agora. A lista mostra o último contato, quem fez e quantas tentativas houve, para a equipe não ligar duas vezes para o mesmo cliente.",
      "A lista destaca os cuidados que já venceram no carro (por prazo ou por quilometragem), como óleo e freios, e avisa quando o cliente não autorizou lembretes automáticos e precisa de contato manual.",
      "Filtros por tempo sem visita (6 a 9, 9 a 12 e mais de 12 meses) e por contato (ainda sem contato ou já contatados).",
      "Administradores definem em quantos meses sem OS entregue um carro entra na lista, em vez do valor fixo de 6 meses. A mudança vale a partir da próxima varredura diária.",
    ],
  },
  {
    id: '2026-10-29-alertas-manutencao', date: '2026-10-29', title: "Alertas de manutenção: adiar, dispensar com motivo e buscar",
    items: [
      "Em vez de só marcar como resolvido, agora dá para adiar o alerta por 30, 60 ou 90 dias (ele volta sozinho se o carro continuar sem revisão) ou dispensar com um motivo: vendeu o carro, mudou de cidade, não quer ser contatado ou outro.",
      "Novas abas Adiados e Dispensados, e a aba Resolvidos mostra quem resolveu e quando, ou que foi a entrega de uma OS. O que uma pessoa fechou pode ser reaberto.",
      "Busca por placa, modelo ou cliente e o total de alertas no topo da lista.",
      "O veículo e o cliente agora levam direto às fichas deles.",
      "Quem só pode consultar, como o mecânico, não vê mais botões que dariam erro.",
      "Ao transferir um veículo para outro dono, o alerta em aberto passa junto para o novo dono.",
    ],
  },
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
