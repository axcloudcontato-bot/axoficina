# Revisão do fluxo de atendimento e aprovação

## Diagnóstico

| Dificuldade encontrada | Comportamento aplicado |
| --- | --- |
| “Enviar para aprovação” só alterava o status, enquanto o envio real ficava separado | O envio da solicitação identifica o orçamento e, após confirmação do envio, coloca uma OS aberta em Aguardando aprovação |
| O formulário inteiro da mensagem aparecia antes da entrada e dos itens | A aprovação tem etapa própria; perguntas adicionais ficam em uma seção secundária |
| Clicar em uma etapa marcava as anteriores como concluídas | A navegação seleciona o conteúdo, sem registrar progresso fictício ou mudar o status |
| A tela sempre reabria na entrada | A abertura considera o status real: entrada, aprovação, execução ou entrega |
| Atualizações de fotos e itens podiam sobrescrever a digitação | O rascunho preserva campos alterados e mostra Salvar/Descartar; avançar salva os dados |
| A solicitação inicial era chamada de diagnóstico | O relato do cliente é registrado como solicitação; o diagnóstico fica no orçamento |
| Uma resposta antiga podia parecer aprovar itens novos | Solicitações de orçamento têm finalidade explícita e cópia dos itens e valores; respostas antigas não autorizam uma versão diferente |
| Conclusão, retirada e recebimento competiam com ações no cabeçalho | Cada momento tem sua ação: concluir após a conferência, avisar sobre a retirada, confirmar recebimento e registrar entrega |

## Sequência da equipe

1. **Entrada:** cliente e veículo já selecionados, relato, quilometragem e previsão. A inspeção fica disponível sem dominar a tela. As fotos de entrada permanecem nesta etapa.
2. **Orçamento:** diagnóstico, técnico e itens com quantidade e valor. As fotos de execução não se misturam à montagem do orçamento.
3. **Aprovação:** conferir uma prévia, escolher WhatsApp ou e-mail e confirmar o envio. A resposta aparece na etapa e nas notificações. Aprovado significa aguardando início; a equipe inicia explicitamente. Autorização por telefone ou presencial tem confirmação própria e não cria resposta em nome do cliente. Recusa e pedido de contato levam à revisão, sem cancelar automaticamente a OS.
4. **Execução:** fotos por item, pausa para aguardar peças e retomada. A conclusão leva à conferência de saída.
5. **Entrega:** fotos de saída, pendências por item e saldo. Marcar pronto para entrega não registra retirada. O aviso de retirada não encerra a OS. A entrega exige confirmação da retirada e conferência da condição de pagamento. Parcelas podem continuar pendentes conforme o combinado.

O quadro mantém os atalhos, mas encaminha aprovação, início, conclusão e entrega para a conferência correspondente. Consultar abas ou gerar um PDF não envia mensagens e não altera o andamento.

## Cliente e versões do orçamento

A página pública apresenta empresa, veículo, placa, itens, quantidades, total e opções de resposta. Clicar em um botão do e-mail apenas seleciona a opção; é necessário confirmar para registrar a decisão. A mensagem e os valores originais continuam disponíveis após a resposta.

Novas solicitações de aprovação usam `purpose: QUOTE`, pergunta e opções padronizadas e uma cópia do orçamento em `quote_snapshot`. A comparação inclui identidade, descrição, tipo, quantidade e preços de cada item, independentemente da ordem de apresentação. A revisão exibida na prévia é conferida no servidor antes de enviar. Ao iniciar pelo novo fluxo, o servidor confere novamente a aprovação e registra sua origem na auditoria: resposta do cliente ou confirmação manual da equipe, junto da revisão do orçamento. Uma solicitação anterior não recebe nova resposta quando há outra mais recente ou quando os itens mudaram. O WhatsApp avisa o cliente se uma aprovação antiga não estiver disponível.

Mensagens anteriores à migração continuam acessíveis. Quando não há cópia estruturada para comprovar a versão, a tela orienta a consultar a resposta antiga e conferir os valores atuais, sem apresentar uma aprovação verificada do orçamento atual.

## Envio e falhas

WhatsApp integrado e e-mail confirmados colocam uma OS aberta em Aguardando aprovação. No WhatsApp pelo aplicativo, preparar o link não conta como envio: a equipe conclui a mensagem na conversa e confirma que a enviou. Falha após envio confirmado mostra aviso de status, evitando sugerir um reenvio. Uma falha de e-mail remove a solicitação que não foi enviada. Entrega incerta pelo provedor mantém o registro para conferência na conversa.

A resposta do cliente não inicia serviço, cancela atendimento, altera agendamento, registra retirada ou lança dinheiro automaticamente. Essas ações pertencem à equipe e conservam os registros e permissões existentes.

## Persistência e compatibilidade

A migração `30_customer_message_quote_workflow` acrescenta finalidade e cópia do orçamento às mensagens. O deploy habitual executa a migração. Não reclassifica nem altera respostas antigas. Mantém os status operacionais existentes e os requisitos de seis fotos de entrada, seis de saída e antes/depois por item. Editar registros de uma OS encerrada continua disponível por ação explícita; não reabre o atendimento. A condição de pagamento e o recebimento têm explicações distintas, sem alterar as regras financeiras.

## Verificação

Testes de API com PostgreSQL cobrem envio, revisão da prévia, respostas antigas, mudança dos itens, confirmação manual de envio, isolamento de oficina, falha de e-mail, callback do WhatsApp, início explícito, evidências de conclusão e entrega. A navegação no navegador cobre a sequência completa com envio simulado, resposta, execução, recebimento e retirada; também verifica a preservação do rascunho, o bloqueio visual por fotos faltantes, a página do cliente e larguras de tela de celular a desktop. Nenhuma mensagem real é enviada pelos testes.
