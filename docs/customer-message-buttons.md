# Respostas por botões

Na OS, na seção Orçamento, ative **Solicitar resposta por botões**. Escolha aprovação do orçamento, confirmação de agendamento, retirada ou pergunta personalizada. Edite a pergunta e os textos de 2 a 3 botões. A inclusão dos itens e do total é opcional. Desativar a opção mantém o compartilhamento de orçamento em texto.

O e-mail enviado via SMTP contém botões HTML e um link alternativo em texto. Cada botão abre uma página com a escolha selecionada; o cliente precisa confirmar para registrar. Pré-visualizações de link e scanners de e-mail nunca registram respostas por GET.

Com o [WA-AKG configurado e ativo](wa-akg-integration.md), o WhatsApp envia botões nativos e recebe as escolhas pelo webhook. Com a integração desativada, o compartilhamento usa `wa.me`: a equipe confirma o envio e a mensagem inclui um link para os botões em uma página pública, acessível sem conta. O cliente ainda pode digitar mensagens no WhatsApp; apenas escolhas válidas são registradas como respostas às perguntas.

As respostas aparecem na mesma OS, com atualização a cada 30 segundos ou pelo botão Atualizar. O histórico mostra até 50 mensagens recentes, incluindo o conteúdo original, a escolha e a data. Uma mensagem preparada para WhatsApp não é considerada enviada ou entregue. As respostas são registros para a equipe: não alteram automaticamente a OS nem a agenda. Orçamentos alterados após o disparo não modificam o conteúdo que o cliente recebeu.

## Implantação

1. Aplicar a migração `27_customer_message_buttons`: `pnpm --filter @oficina/database migrate:deploy`.
2. Gerar o cliente Prisma e reconstruir backend e frontend.
3. Configurar `FRONTEND_URL` no backend com o endereço público HTTPS da oficina. O cliente precisa conseguir abrir esse endereço e o backend configurado em `NEXT_PUBLIC_API_URL` no frontend.
4. Para e-mails, configurar e ativar SMTP nas configurações da empresa.
5. Para botões nativos no WhatsApp, aplicar também `28_wa_akg_integration` e seguir o [guia WA-AKG](wa-akg-integration.md).

Cada link tem token aleatório de 256 bits, armazenado apenas como SHA-256, validade de 7 dias e uma única resposta. A gravação condicional impede respostas concorrentes diferentes. Links de OS canceladas/excluídas ou clientes/empresas excluídos ficam indisponíveis. A leitura pública retorna apenas a mensagem e suas opções; não expõe os identificadores internos ou o hash. Dados públicos usam `no-store`, `no-referrer` e `noindex`.

O histórico é dado operacional da oficina e contém informações do cliente e do serviço. Sua retenção e eventual exclusão assistida acompanham a análise dos registros vinculados à OS; inclui-se esse histórico na revisão e no atendimento de pedidos completos de acesso. Não incluir informações sensíveis desnecessárias em perguntas ou botões.
