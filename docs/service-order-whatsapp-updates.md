# Avisos de movimentação da OS pelo WhatsApp

No cadastro do cliente, em **Preferências**, marque **Me avise sobre toda movimentação da Ordem de Serviço.** A opção começa desmarcada para clientes novos e existentes. O telefone principal precisa ter DDD e a oficina precisa manter sua integração WhatsApp ativa. A preferência geral de canal e horário não ativa esta opção; os avisos são imediatos, a cada evento.

Depois de ativada, a abertura e cada mudança efetiva de status geram um aviso: Aberta, Aguardando aprovação, Em andamento, Aguardando peças, retomada, Pronto para entrega, Entregue e Cancelada. Editar campos, fotos, itens, consultar abas ou receber uma resposta sem mudar o status não gera este aviso. A ativação não reenvia o passado. A pergunta de aprovação e o aviso com botões de retirada continuam sendo comunicações próprias do fluxo, independentes destes avisos de status.

As mensagens usam a formatação nativa do WhatsApp, com asteriscos simples em títulos e rótulos. Incluem cliente, número da OS, veículo, placa, status registrado e data da movimentação em Brasília. A abertura acrescenta a solicitação do cliente e os dados de entrada. A previsão de entrega aparece quando definida e pertinente. Notas internas e informações de pagamento não são incluídas. A retirada não afirma que o saldo foi quitado.

Exemplo:

```text
📝 *ORDEM DE SERVIÇO ABERTA*

👋 Olá, João Silva!
Seu atendimento foi aberto. Vamos avaliar o veículo e preparar o orçamento.

📋 *OS:* #00004
👤 *Cliente:* João Silva
🚗 *Veículo:* Honda HR-V
🔖 *Placa:* ABC1D23
*Status registrado:* Aberta
🕒 *Movimentação em:* 25/10/2026, 09:00 (Brasília)
*Abertura:* 25/10/2026, 09:00 (Brasília)
*Solicitação:* Ruído ao frear

*AX Oficina*
💬 Para falar sobre o atendimento ou ajustar os avisos, entre em contato com a oficina.
```

## Entrega e recuperação

A [avaliação pós-entrega](service-ratings.md) é uma comunicação separada: ao registrar a OS como Entregue, o sistema solicita uma nota de 1 a 5 estrelas, independentemente da opção de avisos de status.

O aviso é salvo na mesma transação do status e do histórico, com uma chave única por movimentação. O processamento em segundo plano consulta os pendentes a cada cinco segundos e faz o envio pelo WA-AKG. A disputa de envio é atômica e preserva a ordem de cada OS, inclusive com mais de uma instância da aplicação. Repetir a leitura da fila não reenvia avisos já confirmados.

Antes de enviar, o sistema confere novamente cliente, oficina, OS, preferência e telefone. Desativar a opção interrompe avisos pendentes; eventos futuros não são criados. Se o telefone mudou, avisos preparados para o número anterior são ignorados. Um envio que já estava em andamento pode chegar antes da desativação ser processada.

Na OS, **Avisos automáticos ao cliente → Ver avisos** mostra destinatário, status, horário, motivo de falha e conteúdo formatado, com paginação. A preferência é alterada no cadastro do cliente. “Enviado” significa que o provedor confirmou o envio; a leitura da mensagem é conferida na conversa.

Falha do WhatsApp não desfaz a abertura nem a mudança de status. Envios não confirmados não são repetidos automaticamente, porque um timeout pode ocorrer depois de a mensagem já ter sido aceita. A equipe pode conferir a conversa e autorizar **Reenviar aviso**. A nova tentativa mantém o evento e seu horário originais e respeita novamente a preferência e o telefone. Processamento interrompido por mais de dez minutos fica sinalizado para conferência, sem reenvio silencioso.

## Implementação e verificação

A migração `31_service_order_status_notifications` acrescenta a preferência ao cliente e o registro persistente dos avisos. O deploy habitual aplica a migração. A preferência também faz parte da exportação cadastral e é desativada na exclusão assistida. O processamento automático é desabilitado em testes; os testes da entrega usam provedores simulados e acionam o processamento explicitamente.

Os testes cobrem ativação e revogação, validação de telefone e booleano, abertura e todos os status, retomada, concorrência, isolamento entre oficinas, falhas de conexão e de envio, reenvio explícito, troca de telefone, recuperação de processamento interrompido e atomicidade entre status, histórico e aviso. A interface é conferida no cadastro, no acompanhamento da OS e no celular. Nenhuma mensagem real é enviada pelos testes.
