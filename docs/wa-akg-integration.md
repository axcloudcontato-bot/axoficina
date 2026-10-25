# WhatsApp com botões pelo WA-AKG

A integração envia os botões diretamente para a conversa pelo endpoint interativo do WA-AKG 1.7.0. As escolhas recebidas por webhook ficam no histórico de respostas da OS. Os modelos de pergunta e os textos dos botões continuam editáveis antes do disparo.

## Configurar

1. No backend, aplicar `28_wa_akg_integration`, gerar o cliente Prisma e reconstruir a aplicação.
2. Definir `PUBLIC_API_URL` com a URL HTTPS pública do backend. Essa URL precisa ser acessível pelo WA-AKG. O endereço do frontend, `FRONTEND_URL`, continua usado para respostas de e-mail e compartilhamentos por link.
   Na implantação Debian com Compose, informe `PUBLIC_BACKEND_URL` em `deploy/debian/.env.production`: o Compose repassa esse valor como `PUBLIC_API_URL` para a API.
3. Acessar **Configurações → WhatsApp** (`/settings/whatsapp`).
4. Informar `https://chat.axcloud.com.br`, o **sessionId** da sessão do número desejado e uma chave de API que tenha acesso à sessão. Esse é o identificador lógico `sessionId`, não o ID interno do registro no banco do WA-AKG.
5. Gerar um segredo, copiá-lo antes de salvar e usar o mesmo valor no webhook do WA-AKG. Chave e segredo são criptografados na base e não são retornados pela API de configuração. Campos vazios preservam os segredos existentes.
6. Salvar e usar **Testar conexão**. O teste consulta as sessões sem enviar mensagem. A sessão deve estar conectada ao WhatsApp.
7. No WA-AKG, criar um webhook para essa sessão, com o evento `message.received`, o segredo salvo e a URL exibida no Ofix: `https://SUA-API/api/v1/webhooks/wa-akg/ID-DA-OFICINA`. O teste de webhook do WA-AKG é aceito após validar a assinatura.
   No Ofix, use **Testar recebimento** com a integração ativa. Esse teste envia um evento assinado à URL pública e exige o JSON `{"received":true,"recorded":false}`. Uma página HTML, mesmo com status 200, indica que o destino não confirmou o webhook. Depois, confirme que a mesma URL, segredo e evento estão cadastrados no WA-AKG; o teste do AX não consulta o cadastro externo do gateway.
8. Ativar o envio pelo WA-AKG. Na OS, manter **Solicitar resposta por botões** ativado e clicar em WhatsApp. Com a integração ativa, o envio ocorre pelo backend, sem abrir o WhatsApp Web.

O domínio de saída permitido é `chat.axcloud.com.br`. Outras instalações precisam ser autorizadas no backend com `WA_AKG_ALLOWED_HOSTS`, uma lista de domínios separados por vírgula. Não há redirecionamento de requisições contendo a chave. O endpoint fica em `/api`; o campo de endereço aceita o domínio com ou sem esse sufixo.

## Recebimento e histórico

Cada botão contém um identificador aleatório da pergunta e o índice da opção. O callback valida o HMAC SHA-256 (`X-Webhook-Signature`) sobre os bytes originais, a oficina, a sessão, o destinatário e o tipo da resposta. Texto livre, grupos, mensagens da própria sessão e escolhas de outras perguntas não são registrados como resposta.

Os eventos `INTERACTIVE_RESPONSE` e `BUTTON_RESPONSE` são reconhecidos conforme o payload normalizado do WA-AKG 1.7.0. A primeira escolha é mantida; repetições idênticas são idempotentes e escolhas posteriores diferentes são ignoradas. As opções expiram após 7 dias. Respostas de WhatsApp integrado não podem ser gravadas pela página pública de links.

Após gravar uma nova escolha, o AX tenta enviar uma confirmação em texto ao mesmo cliente e pela mesma sessão. Eventos duplicados não enviam outra confirmação. A mensagem confirma o registro da opção; não altera automaticamente o status da OS. Se o gateway falhar, a escolha permanece gravada e o callback retorna `recorded: true` com `confirmation: "failed"`; a confirmação não é reenviada automaticamente. Um aceite do gateway é retornado como `confirmation: "sent"` e uma repetição como `confirmation: "already_recorded"`.

Callbacks ignorados retornam `recorded: false` com `reason`, sem expor conteúdo ou credenciais: `SESSION_MISMATCH`, `NOT_A_BUTTON_RESPONSE`, `UNRESOLVED_SENDER_OR_INVALID_CONTENT`, `UNRECOGNIZED_BUTTON`, `MESSAGE_OR_SENDER_MISMATCH`, `EXPIRED` ou `ALREADY_ANSWERED_DIFFERENTLY`, entre outros. Consulte esse JSON nos logs do WA-AKG. Uma resposta HTML não foi gerada por esse endpoint do Ofix.

O histórico distingue envio aceito pelo WA-AKG de compartilhamento manual preparado. Se houver falha ou timeout, o registro permanece como **envio não confirmado**: confira a conversa antes de reenviar, pois o gateway pode ter aceitado a mensagem antes da conexão cair. Não há reenvio automático nem conversão silenciosa para outro canal. O aceite do gateway não certifica entrega ou leitura pelo cliente.

Se a integração estiver desativada, o WhatsApp mantém o compartilhamento manual com link para a página de botões. Mensagens sem a opção de botões continuam no compartilhamento manual. E-mails mantêm os botões HTML com confirmação na página pública. As escolhas registradas não alteram automaticamente a OS ou a agenda.

## Notificações no painel

O sino do cabeçalho também mostra **Respostas dos clientes**. Cada resposta registrada, por WhatsApp ou e-mail, aparece com cliente, OS, pergunta, opção escolhida e data. Ao abrir a OS pela notificação, ela é marcada como lida; também é possível usar **Marcar como lida** sem abrir a ordem. A entrada continua no histórico do sino e há paginação para respostas anteriores.

Com o painel aberto, a consulta é atualizada a cada 10 segundos e novas respostas exibem um aviso com **Ver notificações**. Ao entrar novamente, o usuário recebe um resumo das respostas ainda não lidas. O contador do sino soma respostas não lidas e os alertas de manutenção e financeiros existentes. Não há notificação do sistema operacional com o navegador fechado.

A leitura é persistida por usuário em `customer_reply_reads` (migração `29_customer_reply_notifications`): a leitura de um atendente não apaga o aviso dos demais. A fonte da notificação é a resposta já gravada em `customer_messages`, evitando duplicação e a necessidade de uma segunda escrita no webhook. Respostas anteriores à migração também aparecem, inclusive após a expiração do link. Clientes e OS excluídos não são incluídos no painel. O acesso exige `service_orders.view` e `service_orders.prices`, como o histórico de perguntas da OS.

Rotas autenticadas: `GET /api/v1/customer-reply-notifications` (cursor opcional) e `POST /api/v1/customer-reply-notifications/:id/read`. Ambas usam a oficina e o usuário da sessão; uma resposta de outra oficina não pode ser consultada nem marcada como lida.

## Referências e validação

- [WA-AKG v1.7.0](https://github.com/mrifqidaffaaditya/WA-AKG/releases/tag/v1.7.0).
- [Contrato do envio interativo](https://github.com/mrifqidaffaaditya/WA-AKG/blob/v1.7.0/src/app/api/messages/%5BsessionId%5D/%5Bjid%5D/interactive/route.ts).
- [Formato dos botões](https://github.com/mrifqidaffaaditya/WA-AKG/blob/v1.7.0/src/modules/whatsapp/interactive.ts).
- [HMAC e payload de webhook](https://github.com/mrifqidaffaaditya/WA-AKG/blob/v1.7.0/src/lib/webhook.ts).

Os testes automatizados usam respostas simuladas do gateway e requisições HTTP com PostgreSQL real. A validação na instalação do cliente exige salvar a chave de API e a sessão; o recebimento real exige configurar o webhook público. Nenhuma mensagem real é disparada pelos testes.
