# Revisão de LGPD e textos legais do Ofix

**Data:** 06/11/2026. **Versão dos textos:** `2026-11-06`.

**Natureza deste documento:** revisão técnica feita por IA, comparando os textos com o código e com fontes públicas. Não é parecer de advogado. Serve para reduzir o trabalho da revisão jurídica, que continua necessária antes da oferta aberta. A seção 6 lista o que o advogado precisa validar.

## 1. Conclusões

| Pergunta | Conclusão | Situação |
|---|---|---|
| Qual a base legal do lembrete automático? | Legítimo interesse da oficina (LGPD, arts. 7º, IX, e 10, II). A confirmação manual fica em procedimentos preliminares de contrato (art. 7º, V). | Definida, falta validar |
| O lembrete precisa de consentimento pela LGPD? | Não necessariamente, mas o cliente precisa poder recusar. A recusa por cliente foi implementada. | Falta publicar e validar |
| A nova versão exige comunicado? | Sim, aos administradores das oficinas. Os próprios textos prometem isso. | Rascunho na seção 4 |
| A nova versão exige novo aceite? | Para corrigir a descrição do serviço, entendo que não. O advogado deve confirmar. | Falta validar |
| A lista de prestadores está completa? | Faltam dados de três prestadores, que só a operação conhece. | Seção 5 |

**Risco fora da LGPD:** o envio pelo WhatsApp usa o WA-AKG, baseado na biblioteca Baileys, e não a API oficial. Ver seção 3.

## 2. Base legal do lembrete

### Como funciona hoje (observado no código)

- A oficina liga ou desliga para todos os clientes; o padrão é desligado.
- Sai um lembrete por agendamento, de 2 a 24 horas antes, entre 8h e 20h.
- Só vale para agendamento marcado ou confirmado, em conta ativa e com o módulo de WhatsApp.
- A mensagem traz primeiro nome, oficina, data, hora, serviço, veículo e placa.
- A resposta do cliente em texto livre não é registrada pelo sistema, portanto não interrompe os lembretes.

### Quem decide

A oficina é a controladora, porque decide ligar o lembrete. A Ax Cloud atua como operadora. A base legal é da oficina, e o Ofix deve deixar essa decisão pronta e documentada.

### Por que legítimo interesse

| Base | Avaliação |
|---|---|
| Consentimento (art. 7º, I) | Possível, mas não é exigido pela LGPD e desligaria o lembrete para quem não respondeu. O WhatsApp, porém, tem exigência própria (seção 3). |
| Contrato (art. 7º, V) | Boa para a confirmação do horário, pedida pelo cliente ao agendar. É mais fraca para o lembrete, porque a visita pode acontecer sem ele, e a lei fala em "necessário". |
| **Legítimo interesse (art. 7º, IX, e art. 10, II)** | **Recomendada.** O art. 10, II, cita a prestação de serviços que beneficiem o titular, e quem agendou espera ser lembrado. Exige transparência e respeito à recusa. |

### Teste de balanceamento (modelo para a oficina guardar)

O guia da ANPD organiza o teste em finalidade, necessidade e balanceamento com salvaguardas, por finalidade.

| Fase | Resposta |
|---|---|
| Finalidade | Reduzir faltas e permitir remarcação de um horário já marcado pelo cliente. |
| Necessidade | Usa só dados já cadastrados. **Ponto a melhorar:** a placa e a descrição do serviço ajudam a identificar a visita, mas não são indispensáveis. |
| Expectativa do titular | Alta, para quem agendou e informou o celular. Não vale para ofertas: mudar a mensagem para vender exige novo teste. |
| Impacto | Baixo: uma mensagem por visita, em horário diurno, sem dados sensíveis. |
| Salvaguardas | Limite de um envio, janela de horário, desligamento geral, parada em conta suspensa, recusa por cliente e aviso de como recusar na mensagem. |

### O que foi feito no produto para sustentar essa base

1. **Recusa por cliente:** opção em Preferências no cadastro. Todos continuam recebendo até a oficina desmarcar. A alteração fica na auditoria e a recusa é mantida ao juntar cadastros.
2. **Mensagem:** o lembrete agora termina com "Não quer receber lembretes? Avise a oficina."
3. **Tela de ativação:** explica que a oficina responde pelo envio e deve atender quem recusar.

**Limites:** a resposta do cliente no WhatsApp não desmarca sozinha; alguém da oficina precisa registrar a recusa. A confirmação enviada manualmente pela equipe continua possível.

**Publicação:** a migração `64_customer_appointment_reminders` e os textos devem ir juntos, porque a Política promete a recusa.

## 3. Risco do WhatsApp (fora da LGPD)

- **[Fato]** O README do WA-AKG informa que ele usa `@whiskeysockets/baileys`, não a Cloud API do WhatsApp Business.
- **[Fato]** Os Termos do WhatsApp proíbem uso por meios automatizados não autorizados e preveem suspensão da conta.
- **[Fato]** A política comercial do WhatsApp exige permissão (opt-in) para contatar alguém e pede que se atenda a todo pedido de saída.
- **[Inferência]** Há risco de o número da oficina ser bloqueado, e isso independe da base legal. O legítimo interesse não atende à exigência de opt-in dessa política.

**Recomendações:**
- Registrar no cadastro que o cliente autorizou contato por WhatsApp.
- Avisar a oficina do risco no piloto e usar número dedicado.
- Avaliar a Cloud API antes da oferta aberta.

## 4. Comunicado

**Por que comunicar.** Os Termos dizem que alterações materiais devem ser comunicadas antes de produzir efeitos, e a Política promete comunicar mudanças relevantes. A versão publicada ainda dizia que não há cobrança integrada e omitia prestadores.

**O que o sistema faz hoje.** Mudar a `LEGAL_VERSION` só vale para novos cadastros e convites. Quem já aceitou não é chamado de novo, e não há registro de ciência. A entrada em "Novidades do sistema" já foi criada, mas sozinha não prova o aviso. Por isso, recomendo também o envio por e-mail.

**Rascunho, a enviar aos administradores (não enviado):**

> **Assunto:** Atualização dos Termos de uso e da Política de privacidade do Ofix
>
> Olá,
>
> Atualizamos os Termos de uso, a Política de privacidade e as políticas de cookies e de cancelamento. As novas versões valem a partir de [DATA].
>
> O que mudou:
> - Os Termos agora descrevem o teste grátis de 14 dias, a assinatura pelo Stripe, a renovação automática e os 30 dias de guarda dos dados depois do encerramento da conta.
> - A Política de privacidade agora cita Cloudflare, Google, WhatsApp (Meta) e o armazenamento de backups, e explica os envios automáticos a clientes.
> - A Política informa a base legal dos lembretes de agendamento. Como sua oficina decide usá-los, atenda quem pedir para não recebê-los: desmarque a opção em Preferências, no cadastro do cliente.
> - O cancelamento mantém o acesso até o fim do período já pago.
>
> Os textos completos estão em [LINK]. Dúvidas ou pedidos: [E-MAIL DE PRIVACIDADE].
>
> Ax Cloud

## 5. Prestadores

| Prestador | Função | Dados | Onde foi visto | Falta confirmar |
|---|---|---|---|---|
| Cloudflare | Túnel e HTTPS | Tráfego, IP | `Caddyfile`, `.env.production.example` | País e mecanismo de transferência |
| Stripe | Assinatura | Nome e e-mail do contratante, id da oficina, cartão direto na página dele | `stripe.client.ts` | Empresa contratante, país e mecanismo |
| Google | Acesso com Google, opcional | Identidade, nome, e-mail | `google-identity.service.ts` | País e mecanismo |
| WhatsApp (Meta) | Entrega de mensagens | Telefone e conteúdo | `wa-akg.service.ts` | Ver seção 3 |
| WA-AKG em `chat.axcloud.com.br` | Servidor de envio | Telefone e conteúdo | `.env.production.example` | **Onde roda e quem opera** |
| ViaCEP | Consulta de CEP | CEP e dados de conexão | `frontend/lib/cep.ts` | Nenhuma pendência; já citado |
| FIPE (Parallelum) | Catálogo de veículos | Sem dado pessoal: consulta marcas e modelos | `fipe-client.service.ts` | Nada |
| **Hospedagem do servidor** | Banco e arquivos | Todos os dados | Não identificável no código | **Empresa e país** |
| **Backup externo** | Cópias do banco e das fotos | Todos os dados | `backup-offsite.sh` (rotação padrão de 14 e 35 dias) | **Empresa, país, se há criptografia ativa e os prazos em produção** |
| **SMTP da plataforma** | Recuperação de senha e avisos | E-mail e conteúdo | `PLATFORM_SMTP_URL` | **Empresa e país** |
| Sentry | Desligado por decisão de custo | Nada enviado | `observabilidade.md` | Incluir na lista se for ativado |
| UptimeRobot | Monitora `/health` | Sem dado pessoal, pelo que o endpoint indica | `observabilidade.md` | Nada |

A Política foi escrita de forma genérica para hospedagem, backup e SMTP, porque não li os segredos de produção. Depois de confirmados, vale nomeá-los.

**Transferência internacional.** O fim do prazo para adotar as cláusulas-padrão foi 23/08/2025, conforme fontes secundárias. Falta conferir se os contratos de cada prestador atendem à Resolução CD/ANPD 19/2024. A Política informa quem pode tratar dados fora do Brasil, mas não afirma o mecanismo, porque ele não foi verificado.

## 6. O que mudou nos textos e o que fica para o advogado

### Corrigido nesta versão

| Documento | Antes | Agora |
|---|---|---|
| Termos | "não possui checkout ou cobrança de assinatura integrados" (**falso**, e escapou da revisão anterior) | Teste, Stripe, renovação e só consulta |
| Termos | Sem prazo de encerramento | 30 dias, com restauração possível, e depois exclusão |
| Privacidade | Sem Cloudflare, Google, WhatsApp, backup e SMTP da plataforma | Incluídos |
| Privacidade | WhatsApp descrito só como envio manual | Envios automáticos informados |
| Privacidade | Bases legais sem o lembrete | Lembrete e mensagens de cuidado incluídos |
| Privacidade | Frase de pendência interna sobre lista de prestadores | Trocada por informação real |
| Cookies | Frase de pendência "antes da publicação" | Cloudflare e Google informados; chave `ax-updates-seen` incluída |
| Reembolso | Efeito do cancelamento genérico | Acesso até o fim do período pago |

### Para validação jurídica

1. Base legal do lembrete e teste de balanceamento (seção 2).
2. Necessidade de novo aceite e prazo do comunicado.
3. **Encarregado (art. 41):** os textos indicam um canal, mas não identificam encarregado. Confirmar se a Ax Cloud se enquadra como agente de pequeno porte dispensado (Resolução CD/ANPD 2/2022) ou se deve indicar um, conforme a Resolução CD/ANPD 18/2024.
4. **Contrato com a oficina:** os Termos dizem que a contratação "deve documentar" prestadores, segurança e devolução de dados. Não encontrei anexo de tratamento de dados. Recomendo criar.
5. **Reembolso do plano anual:** o anual cobra 12 mensalidades de uma vez e o texto fala em "eventual restituição proporcional", sem regra. É preciso definir.
6. **Arrependimento (CDC, art. 49):** avaliar quando há relação de consumo, já que a contratante costuma ser empresa, e o início da contagem depois do teste.
7. **Prazos de retenção:** os textos não dão prazo para logs, auditoria e dados fiscais. Conferir também a guarda de registros de acesso do Marco Civil.
8. Frases com "deve" ou "devem" nos textos: alguns trechos ainda soam como orientação, não como compromisso. Não reescrevi, por afetarem obrigações.
9. Risco do WhatsApp na relação com a oficina: avaliar uma cláusula sobre o uso do canal.

## 7. Fontes consultadas

- [LGPD, Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [Guia da ANPD sobre legítimo interesse](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_legitimo_interesse.pdf/@@display-file/file)
- [Resolução CD/ANPD 18/2024, encarregado](https://www.tjba.jus.br/extrajudicial/wp-content/uploads/2024/08/RESOLUCAO-ANPD-No-18-Encarregado-de-Dados.pdf)
- [Lefosse sobre o prazo das cláusulas-padrão](https://lefosse.com/noticias/alerta/transferencia-internacional-de-dados-prazo-para-adocao-das-clausulas-padrao-da-anpd-se-encerra-em-23-de-agosto/) (fonte secundária)
- [Mayer Brown sobre o fim do prazo](https://www.mayerbrown.com/pt/insights/publications/2025/08/end-of-grace-period-implementation-of-brazils-standard-contractual-clauses-in-international-transfers-of-personal-data) (fonte secundária)
- [WA-AKG](https://github.com/mrifqidaffaaditya/WA-AKG)
- [Política comercial do WhatsApp](https://whatsappbusiness.com/policy/)
- [Termos do WhatsApp](https://www.whatsapp.com/legal/terms-of-service)

O CDC, o Marco Civil e a Resolução CD/ANPD 2/2022 foram citados de memória ou por resumos secundários, e devem ser conferidos no texto oficial.
