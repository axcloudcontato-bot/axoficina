# Avaliação do serviço após a entrega

Ao registrar uma OS como **Entregue**, o sistema prepara automaticamente uma pesquisa de satisfação pelo WhatsApp. A pesquisa é independente da opção de avisos de movimentação do cliente. Não é enviada ao marcar apenas **Pronto para entrega**, cancelar a OS ou atualizar dados. Entregas anteriores à implantação não geram pesquisa retroativa.

A mensagem identifica o cliente, a OS, o veículo e a placa, com títulos em negrito usando asteriscos simples. O cliente toca em **Avaliar serviço** e escolhe uma opção na lista nativa do WA-AKG:

1. ⭐ 1 — Ruim
2. ⭐⭐ 2 — Regular
3. ⭐⭐⭐ 3 — Bom
4. ⭐⭐⭐⭐ 4 — Muito bom
5. ⭐⭐⭐⭐⭐ 5 — Ótimo

O envio depende de telefone válido e integração WA-AKG ativa. Usa o webhook já configurado, sem um novo endpoint ou segredo. A resposta é vinculada à solicitação, à oficina, à sessão e ao número destinatário; não interpreta números digitados livremente como notas. O cliente recebe a confirmação da escolha, sem repetir a pergunta. Cada pesquisa aceita uma resposta, válida por sete dias. Callbacks repetidos não duplicam a nota nem a confirmação.

Na OS, **Avisos automáticos ao cliente** exibe a pesquisa, seu envio e a nota recebida, mesmo com o histórico recolhido. A resposta também entra no sino de notificações e no histórico de mensagens do cliente. Uma nota baixa é registrada da mesma forma que uma nota alta.

A pesquisa e seu envio pendente são gravados na mesma transação da entrega. Há uma chave única por movimentação e tipo de aviso; a concorrência entre entregas e entre processadores não cria duas pesquisas. O processamento preserva a sequência de avisos da OS, enviando o aviso de entrega antes da pesquisa quando ambos são gerados juntos.

Falhas do provedor não desfazem a entrega. Uma falha fica disponível para conferência e reenvio manual, com o mesmo token, pergunta e opções. Não há repetição automática de envios incertos. O token de resposta fica criptografado na fila persistente e apenas seu hash fica na solicitação; a API de histórico não expõe tokens. Pesquisas expiradas, respondidas, com telefone alterado ou com cadastro indisponível não são reenviadas.

As migrações `32_service_ratings` e `33_service_rating_choices` incluem o tipo de aviso e permitem cinco opções apenas em pesquisas de avaliação. Os demais tipos continuam limitados a duas ou três opções. O deploy habitual aplica ambas.

Os testes usam WhatsApp simulado, sem enviar mensagens reais. Cobrem entrega efetiva, todas as cinco notas, identidade do destinatário, isolamento entre oficinas, notificações, repetição de callbacks, concorrência, falhas, reenvio, expiração, transação e apresentação no celular.
