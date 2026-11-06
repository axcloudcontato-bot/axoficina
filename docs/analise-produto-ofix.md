# Análise do Ofix como produto e como software

**Data:** 05 e 06/11/2026. **Base:** `61cf14e` mais as alterações desta revisão, ainda **sem commit**.
**Convenção:** **[Fato]** foi observado no código ou em execução. **[Inferência]** é conclusão a partir do que foi lido. **[Recomendação]** é proposta.

**Como o pedido foi conduzido.** O roteiro pedia somente leitura, mas a sua instrução final autorizou aplicar as melhorias. Por isso, auditei primeiro e depois alterei o código. Nada saiu da máquina: sem push, deploy, cobrança, mensagem ou uso de chave real. Os testes rodaram em Postgres e Redis temporários, criados na pasta de rascunho da sessão.

---

## 1. Resumo executivo

**O que o Ofix já permite.** Uma oficina se cadastra, testa 14 dias sem cartão, configura empresa e equipe, cadastra clientes e veículos e agenda atendimentos. Depois abre a OS, registra fotos, envia o orçamento para aprovação, executa com cronômetro, recebe à vista ou parcelado, entrega com baixa de estoque e acompanha o caixa. O sistema também gera lembretes de manutenção e pedidos de avaliação. Há planos com limites, assinatura pelo Stripe, encerramento de conta com prazo de 30 dias, central LGPD e painel do gestor do SaaS.

**Maturidade.** A base é boa: isolamento entre oficinas testado, máquina de estados protegida contra concorrência, envios incertos tratados sem repetição automática, documentação de API gerada e 199 testes e2e aprovados nesta revisão. O ponto fraco estava nas **costuras entre módulos**: regras que valiam na tela, mas não na API, e efeitos de um módulo que não chegavam a outro. Quase todos os defeitos graves encontrados são desse tipo.

**Principais riscos encontrados, já corrigidos no código:**

1. **Preços vazando.** A API entregava valores da OS a quem não tinha permissão; só a tela escondia.
2. **"Só consulta" era falso.** Com teste vencido ou assinatura suspensa, só 9 rotas recusavam escrita. Financeiro, itens, recebimentos e status seguiam abertos, e os lembretes continuavam saindo.
3. **Perfil Financeiro inutilizável.** Era vendido na página pública, mas recebia 403 até no próprio Financeiro e não podia ser convidado.
4. **Dinheiro inconsistente.** Estorno deixava parcela "paga" sem dinheiro, OS cancelada continuava no contas a receber e havia risco de receber mais que o total.
5. **Equipe quebrando.** Depois de personalizar um perfil fixo e convidar alguém, a tela Equipe dava erro 500.
6. **Texto legal público falso.** A política de reembolso dizia que o sistema não cobra assinatura, e o Stripe não aparecia na Política de privacidade.

**Riscos que continuam abertos, porque dependem de ambiente ou de decisão:**

- nenhum fluxo real com Stripe, WA-AKG e SMTP foi exercitado aqui;
- a restauração de backup não foi comprovada nesta revisão;
- os textos legais alterados precisam de revisão jurídica;
- ainda não houve uso por uma oficina piloto.

**Veredito.** **[Inferência]** Com estas correções publicadas, o sistema fica apto a um **piloto assistido**. Ainda não está pronto para oferta aberta, até cumprir a etapa de homologação da seção 7.

---

## 2. Mapa de funcionalidades

**Legenda de estado**

- **Verificada:** código lido e e2e executado nesta revisão.
- **Sem verificação suficiente:** implementada, mas depende de provedor real, de navegador real ou de teste manual.
- **Parcial:** funciona com lacuna conhecida.
- **Só documentada** ou **Ausente:** não existe no produto.

"Corrigido" indica que o estado vale depois das alterações desta revisão.

| Funcionalidade | Usuário | Fluxo | Estado | Evidências | Lacunas |
|---|---|---|---|---|---|
| Site público e oferta | Visitante | Landing → planos → cadastro | Sem verificação suficiente | `components/landing`, preços vindos de `plans.ts` | Sem teste visual em celular real; FAQ corrigida |
| Cadastro e teste grátis | Dono | Dados + aceite → 14 dias no Completo | Verificada | `auth.manager.ts`, `tenant.repository.ts`, `auth.e2e` | Sem confirmação de e-mail; sem aviso por e-mail do fim do teste |
| Cadastro com Google e onboarding | Dono | Google → documento e dados obrigatórios | Sem verificação suficiente | `OnboardingGate.tsx`, `completeOnboarding` | Depende de Client ID real |
| Login e sessões | Todos | Login, renovação, aparelhos | Verificada; corrigido | `auth.e2e`, `access-and-plan-rules.e2e` | Sem MFA (há colunas no banco, sem fluxo) |
| Recuperação de senha | Todos | E-mail ou link do gestor | Sem verificação suficiente | `password-reset.service.ts:69` | Sem `PLATFORM_SMTP_URL`, o e-mail não sai e a tela não avisa |
| Convites | Admin, gestor | Convite → aceite | Verificada; corrigido | `users.e2e`, novo e2e | Sem SMTP, depende de copiar o link |
| Perfis e permissões | Admin | Perfis fixos e personalizados | Verificada; corrigido | `permissions.guard.ts`, novo e2e | Ver P2-1 (perfil personalizado nasce como ADMIN) |
| Painel | Todos | Fila, agenda, indicadores | Verificada; corrigido | `dashboard/today`, navegador | Conferência de números com dados de volume |
| Navegação, busca, atalhos | Todos | Menu, busca, teclado | Sem verificação suficiente | Testes vitest | Playwright não executado |
| Clientes, consentimento, junção | Recepção | Cadastro, arquivar, juntar | Verificada | `customers.e2e` | Importação com arquivo real em planilha |
| Veículos e FIPE | Recepção | Placa, FIPE, transferência | Verificada | `vehicles.e2e`, `fipe.e2e` | Sincronização FIPE real não exercitada |
| Agenda | Recepção | Agendar → iniciar OS | Verificada; corrigido | Novo e2e, `appointment.manager.spec` | Sem e2e próprio do ciclo completo |
| Lembretes de agenda | Automação | WhatsApp por hora | Sem verificação suficiente | `appointment-notification.service.ts` | Provedor real; decisão sobre consentimento (P1-11) |
| OS e máquina de estados | Recepção, mecânico | 7 estados | Verificada | `service-orders.e2e` | Ver P2-3 |
| Orçamento e aprovação | Recepção, cliente | Link ou botão → resposta | Verificada | `customer-approval-workflow.e2e`, `customer-messages.e2e` | WA-AKG real |
| Fotos | Mecânico | Câmera, política, limite | Sem verificação suficiente | Assinatura do arquivo validada; `mobile-photo-upload.spec` não executado | Celular real |
| Impressão, PDF, recibo | Recepção | A4 | Sem verificação suficiente | `ServiceOrderPrintDocument.tsx`; mecânico conferido no navegador | Conferir quebras de página em impressora real |
| Recebimentos e parcelas | Recepção, financeiro | Configurar → receber → estornar | Verificada; corrigido | Novo e2e, specs | Dados já existentes em produção (seção 7) |
| Produtividade | Gestor, mecânico | Cronômetro, metas, comissão | Verificada | `productivity.e2e` | Rotas de garantia e tempo ocioso fora do módulo (D-7) |
| Catálogo e estoque | Recepção | Itens, pacotes, baixa | Parcial | `catalog.manager.ts` | Sem e2e; correção de OS entregue não ajusta estoque (P2-4) |
| Financeiro | Financeiro | Lançamentos, fluxo, conciliação | Verificada; corrigido | `financial-analytical.e2e`, novo e2e | Sem e2e de conciliação e anexos |
| Relatórios | Financeiro | Analítico, impressão | Sem verificação suficiente | `financial-report.ts`, e2e analítico | Impressão longa |
| Alertas e fidelização | Recepção | Régua, contatos | Verificada; corrigido | `customer-care.e2e`, `maintenance-alerts.e2e` | Volume real |
| WhatsApp | Oficina | Conexão, botões, webhook | Sem verificação suficiente | HMAC e testes simulados | Número e sessão reais |
| E-mail | Oficina | SMTP da oficina | Sem verificação suficiente | `smtp-host-guard.ts` | Caixa real |
| Planos e limites | Admin | Módulos e limites | Verificada; corrigido | `read-only-routes.spec`, `modules.guard.spec`, novo e2e | Limite não é atômico sob concorrência (P2-6) |
| Assinatura Stripe | Admin | Checkout, troca, cancelamento | Sem verificação suficiente | Specs com Stripe simulado | Nunca exercitada nesta revisão em modo de teste |
| Encerramento e expurgo | Dono, gestor SaaS | Encerrar → 30 dias → apagar | Verificada | `account-closure.e2e` | Stripe real |
| LGPD | Titular, admin | Pedidos, exportação, exclusão | Verificada; corrigido | `privacy.e2e` | Confirmação Google sem teste com conta real |
| Suporte | Todos, gestor SaaS | Chamados | Parcial | `support.controller.ts` | Sem e2e; sem aviso ao gestor quando entra chamado |
| Administração do SaaS | Gestor SaaS | Assinaturas, restaurar | Verificada | `subscriptions.e2e`, `account-closure.e2e` | Alteração manual não sincroniza com o Stripe, por desenho |
| Isolamento entre oficinas | Todos | Tenant no token e nas queries | Verificada | `tenant-isolation.e2e`, `unscoped-usage.spec` | Nenhuma |
| Backup e restauração | Operação | `backup-offsite.sh`, `restore-test.sh` | Sem verificação suficiente | Scripts lidos | Restauração sem evidência |
| Observabilidade | Operação | Sentry, UptimeRobot | Só documentada, do ponto de vista desta revisão | `docs/observabilidade.md` | Conferir se está ativa em produção |
| Nota fiscal | Financeiro | Não há | Ausente | Sem código | Decisão de produto: a oficina emite por fora |
| Pagamento online para o cliente da oficina | Cliente | Não há | Ausente | Sem código | Decisão de produto |

---

## 3. Fluxos críticos

### Operacional: cliente → veículo → agenda → OS → execução → cobrança → histórico → manutenção

| Etapa | O que acontece | Situação |
|---|---|---|
| Cliente e veículo | Documento e placa únicos por oficina, com proteção contra corrida | Sólido |
| Agendamento | Valida vínculo cliente-veículo, técnico e capacidade | **Corrigido:** não olhava horário nem dia fechado na API, e a recepção não via a lista de técnicos |
| Agenda → OS | `start` cria a OS e vincula | **Corrigido:** ignorava limite de OS e só consulta. **Aberto (P2):** a OS é criada antes do vínculo; se o vínculo falhar por corrida, sobra uma OS solta |
| Orçamento | Foto do orçamento fica congelada; alteração invalida a aprovação | Sólido |
| Execução | Cronômetro, fotos, histórico | **Corrigido:** valores chegavam ao mecânico pela API |
| Cobrança | Parcelas, recebimento, estorno | **Corrigido:** ver P0-4 |
| Entrega | Baixa estoque, resolve alertas, grava plano de cuidado, tudo na mesma transação | Sólido |
| Manutenção futura | Varredura e régua respeitam consentimento, janela e limite diário | **Corrigido:** continuava enviando e-mail com plano sem o módulo ou conta suspensa |

### Comercial: visita → teste → pagamento → troca → cancelamento

- **Teste:** coerente entre landing, FAQ e código.
- **Fim do teste:** agora bloqueia de fato (P0-2), e o aviso leva o administrador à assinatura. Antes, o texto mandava falar com o suporte.
- **Contratação:** a confirmação depende do webhook. **Corrigido:** duas abas abertas podiam cobrar por um plano e ativar outro, e dois pagamentos deixavam duas assinaturas ativas.
- **Pagar durante o teste:** os dias restantes são perdidos. A tela agora avisa. **[Recomendação]** avaliar `trial_end` no Stripe se quiser honrar os dias.
- **Cancelamento:** mantém o acesso até o fim do período pago; coerente com a FAQ.
- **Aberto:** `customer.subscription.updated` não é tratado. Se o cliente cancelar e reativar pelo portal do Stripe, o estado local só se ajusta no próximo evento de fatura (P2-5).

### Administrativo: encerramento e LGPD

- O encerramento cancela no Stripe antes de fechar e aborta se falhar; sessões caem na hora; o expurgo tem e2e. Sólido.
- **Corrigido:** contas só com Google não conseguiam executar exclusão LGPD, porque a confirmação exigia senha.
- **Corrigido:** trocas de perfil de acesso não deixavam registro.

---

## 4. Achados priorizados

Todos os achados abaixo têm correção aplicada, salvo quando marcados como **Aberto**. Os números de linha referem-se ao código atual. O nível de confiança vale para a existência do defeito.

### P0: bloqueiam uso ou oferta

**P0-1. API entregava preços a quem não tem permissão.** Confiança: alta.
- **Impacto:** um mecânico conseguia ler valores, descontos e recebimentos com uma chamada direta; quebra a promessa de "quem vê preços".
- **Como reproduzir (antes):** com token de mecânico, `GET /api/v1/service-order?id=...` retornava `total_amount_cents` e os itens com preço.
- **Correção:** `hideAmounts` em [service-order.manager.ts:79](../backend/src/modules/service-orders/managers/service-order.manager.ts), aplicada em [service-orders.controller.ts:120](../backend/src/modules/service-orders/controllers/service-orders.controller.ts) nas rotas de consulta, lista, painel, criação, edição, transição e exclusão. A impressão também omite os valores.
- **Prova:** novo e2e e conferência no navegador.

**P0-2. "Só consulta" não existia na maior parte da API.** Confiança: alta.
- **Impacto:** quem não pagava continuava usando quase tudo, e mensagens seguiam saindo pela chave da plataforma.
- **Raciocínio:** `PlanLimitGuard` só age em rota com `@PlanLimit`. Antes havia 9 rotas marcadas, enquanto a tela e a FAQ prometiam só consulta.
- **Correção:** agora são 94 rotas marcadas, e [read-only-routes.spec.ts](../backend/src/shared/plan/read-only-routes.spec.ts) faz o teste falhar se uma rota nova de escrita não declarar sua regra. As exceções são explícitas e justificadas: pagar, encerrar, remover pessoa, trocar senha, privacidade, suporte e onboarding.
- **Automações:** [wa-akg.service.ts:79](../backend/src/modules/settings/services/wa-akg.service.ts), [customer-care-automation.service.ts:22](../backend/src/modules/customer-care/customer-care-automation.service.ts) e [appointment-notification.service.ts:65](../backend/src/modules/appointments/services/appointment-notification.service.ts).
- **Efeito colateral corrigido:** `appointments/start` burlava o limite mensal de OS.

**P0-3. Perfil Financeiro não funcionava.** Confiança: alta.
- **Impacto:** a landing vende 5 perfis prontos; o Financeiro recebia 403 em `financial/*`, clientes, OS e painel, e não aparecia no convite.
- **Causa:** o seed cria o papel, mas `USER_ROLES`, `INVITABLE_ROLES` e os `@Roles` o ignoravam.
- **Correção:** contratos, [financial.controller.ts:11](../backend/src/modules/financial/controllers/financial.controller.ts), `READ_ROLES` e `RECEIPT_ROLES` em [service-orders.controller.ts:51](../backend/src/modules/service-orders/controllers/service-orders.controller.ts), clientes, marca da oficina, modal de convite e rótulos.

**P0-4. Valores da OS podiam divergir do caixa.** Confiança: alta.
- **Impacto:** relatório errado e cobrança indevida ao cliente da oficina.
- **Casos corrigidos:**
  - estorno deixava a parcela como paga, sem dinheiro por trás;
  - OS cancelada ou excluída mantinha parcelas no contas a receber e no fluxo projetado;
  - mudar itens ou desconto não atualizava as parcelas;
  - recebimento manual somado às parcelas podia passar do total;
  - cancelar uma OS com dinheiro recebido era aceito, sem tratar esse dinheiro;
  - OS cancelada aceitava pagamento.
- **Correção:** `rebalanceInstallments` em [service-order.manager.ts:1069](../backend/src/modules/service-orders/managers/service-order.manager.ts), estorno na linha 1042, recusa de cancelamento na linha 301 e filtro em [financial.repository.ts:94](../backend/src/modules/financial/repositories/financial.repository.ts).
- **Mudança de comportamento:** para cancelar uma OS com recebimento, agora é preciso estornar antes.

**P0-5. Tela Equipe quebrava com erro 500.** Confiança: alta.
- **Como reproduzir (antes):** personalizar o perfil Mecânico e convidar um mecânico. O convidado apontava para o perfil global, que a listagem filtra, e toda a lista falhava.
- **Correção:** `byNameForTenant` em [user.manager.ts:56](../backend/src/modules/iam/managers/user.manager.ts) e listagem tolerante a registros antigos.

**P0-6. Textos legais públicos contradiziam a operação.** Confiança: alta.
- **Impacto:** a política de reembolso afirmava "O código atual não integra cobrança de assinatura", e a Política de privacidade não citava o Stripe (QA-015, QA-139).
- **Correção:** [legal-content.ts](../frontend/features/privacy/legal-content.ts) e `LEGAL_VERSION` em [legal.ts:2](../packages/contracts/src/legal.ts).
- **Pendente:** **revisão jurídica** do texto. Fiz só o ajuste factual. A nova versão vale para quem aceita a partir de agora; quem já aceitou não é chamado a aceitar de novo. Avaliar se a mudança exige comunicado.

### P1: corrigir antes de clientes pagantes

**P1-1. Recepção e mecânico sem lista de técnicos.** Confiança: alta (vista ao vivo).
- `users/list` exige `team.view`, então os campos de técnico ficavam vazios.
- **Correção:** `GET /users/team-members`, só com nome e id, em [users.controller.ts:35](../backend/src/modules/iam/controllers/users.controller.ts).

**P1-2. Sessão de quem aceita convite caía.** Confiança: alta.
- O refresh token era devolvido sem ser gravado; a sessão terminava quando o token de acesso expirava.
- **Correção:** [user.manager.ts:167](../backend/src/modules/iam/managers/user.manager.ts).

**P1-3. Login revelava contas.** Confiança: alta.
- "Conta desabilitada" e "desativada" apareciam antes de conferir a senha (QA-020).
- **Correção:** [auth.manager.ts:183](../backend/src/modules/iam/managers/auth.manager.ts).

**P1-4. Agenda ignorava horário e dias fechados na API.** Confiança: alta.
- **Correção:** [appointment.manager.ts:196](../backend/src/modules/appointments/managers/appointment.manager.ts). Pede confirmação em vez de proibir, porque a oficina pode abrir exceção. A QA-057 fala em "impedir"; se preferir bloqueio absoluto, é ajuste simples.

**P1-5. Stripe: eventos fora de ordem e pagamentos duplos.** Confiança: média-alta (Stripe simulado).
- **Correção:** [billing.service.ts:189](../backend/src/modules/billing/billing.service.ts). Agora vale o plano da página paga, a assinatura anterior é cancelada e fatura paga não volta a pendente.
- A periodicidade também deixou de mudar ao apenas abrir o Checkout.

**P1-6. Automação de cuidado ignorava o plano.** Confiança: alta.
- Uma oficina rebaixada para o Essencial continuava enviando e-mail da régua. Coberto pela correção do P0-2.

**P1-7. Painel do Essencial chamava o Financeiro.** Confiança: alta.
- A chamada recebia 403 e o resumo financeiro seguia aberto sem o módulo.
- **Correção:** [painel/page.tsx:43](../frontend/app/(dashboard)/painel/page.tsx) e `@RequiresModule('financeiro')` na rota.

**P1-8. Painel financeiro com números errados.** Confiança: média-alta.
- "A receber" ignorava entregas com mais de 6 meses, o ticket médio dividia dinheiro recebido por OS entregue, e o mês virava em UTC.
- **Correção:** `businessSummary` em `service-order.manager.ts` e `outstandingDeliveredBefore` em `service-order.repository.ts`.

**P1-9. Perfis de acesso sem auditoria e sem proteção.** Confiança: alta.
- **Correção:** registro de criar, alterar e atribuir, e impedimento de a oficina ficar sem quem administre perfis em [access-profile.manager.ts:77](../backend/src/modules/iam/managers/access-profile.manager.ts).

**P1-10. Exclusão LGPD impossível para conta Google.** Confiança: alta.
- **Correção:** [privacy.service.ts:164](../backend/src/modules/privacy/privacy.service.ts) e `PrivacyCenter.tsx`. **Sem teste com conta Google real.**

**P1-11. Aberto, decisão de produto: lembrete de agendamento sem consentimento individual.** Confiança: alta.
- **[Fato]** O lembrete só depende da oficina ativar, sem autorização por cliente; a QA-059 fala em contato "consentido".
- **[Inferência]** Pode ser defensável como execução do serviço agendado, mas é decisão jurídica. Não usei `notifyServiceOrderUpdates`, porque o padrão é desligado e isso desligaria quase todos os lembretes sem aviso.
- **[Recomendação]** Decidir e documentar a base legal, ou criar uma opção própria.

**P1-12. Aberto: recuperação de senha silenciosa sem SMTP.** Confiança: alta.
- **[Fato]** Sem `PLATFORM_SMTP_URL` e sem SMTP da oficina, o pedido não envia nada, e a tela responde igual por segurança ([password-reset.service.ts:69](../backend/src/modules/iam/services/password-reset.service.ts)).
- **[Recomendação]** Confirmar a variável em produção antes da oferta. Valor não verificado aqui.

**P1-13. Aberto: homologação real.** Stripe em modo de teste, WA-AKG, SMTP e restauração de backup: ver seção 7.

### P2: melhoria posterior

Todos abertos, salvo indicação.

- **P2-1. Perfil personalizado nasce como ADMIN** ([role.repository.ts:54](../backend/src/modules/iam/repositories/role.repository.ts)). As permissões continuam valendo, mas um perfil personalizado com `team.manage` pode bloquear o dono. **[Recomendação]** proteger a conta dona. Confiança: alta.
- **P2-2. Papel no token fica desatualizado** até renovar. As permissões são lidas do banco a cada requisição, então o efeito é limitado aos `@Roles`.
- **P2-3. Aprovação pode ser pulada pela API.** `AWAITING_APPROVAL → IN_PROGRESS` não exige `authorization` ([service-order.manager.ts:336](../backend/src/modules/service-orders/managers/service-order.manager.ts)); só a tela conduz. Campos de OS encerrada também seguem editáveis, exceto valores.
- **P2-4. Estoque.** Saldo pode ficar negativo, e corrigir itens de OS entregue não ajusta o estoque ([linha 774](../backend/src/modules/service-orders/managers/service-order.manager.ts)).
- **P2-5. Stripe.** Sem `customer.subscription.updated`; cupons habilitados ([stripe.client.ts:83](../backend/src/modules/billing/stripe.client.ts)) fazem o MRR do painel divergir do valor pago.
- **P2-6. Limites de plano não são atômicos:** requisições simultâneas podem passar um pouco do limite.
- **P2-7. Quilometragem menor na OS é ignorada em silêncio** ([linha 756](../backend/src/modules/service-orders/managers/service-order.manager.ts)); a QA-051 pede confirmação, que hoje só existe no cadastro do veículo.
- **P2-8. Falta aviso ativo:** sem e-mail antes do fim do teste ou em falha de pagamento, só banner.
- **P2-9. CSP de scripts em modo de relatório** ([Caddyfile:42](../deploy/debian/Caddyfile)); sem `helmet` na API (a borda cobre cabeçalhos básicos).
- **P2-10. `resolvePlan`** trata plano desconhecido como Completo ([plans.ts:37](../packages/contracts/src/plans.ts)): decisão registrada para legados, mas um valor errado no painel libera tudo.
- **P2-11. Lançamentos concorrentes** em `addPayment` respondem 500 em vez de 409.
- **P2-12. Apagar foto de OS entregue:** **corrigido**, agora é recusado; continua possível em OS cancelada.
- **P2-13. Documentação da API omitia rotas** quando os decoradores estavam na mesma linha: **corrigido**. A geração passou a incluir todas e o documento foi regenerado.

---

## 5. Divergências

| # | Documento ou promessa | Realidade encontrada | Situação |
|---|---|---|---|
| D-1 | Landing e FAQ: "só para consulta" | 9 rotas bloqueavam | Corrigido |
| D-2 | Landing: 5 perfis prontos; `PRODUCT.md` lista FINANCE | Financeiro sem acesso | Corrigido |
| D-3 | "Quem vê preços" | Só a tela escondia | Corrigido |
| D-4 | Reembolso: "não integra cobrança" | Stripe em produção | Corrigido; revisão jurídica pendente |
| D-5 | FAQ: exportação só no Completo | Listas de clientes e veículos exportam em todos os planos | Corrigido na FAQ, mantendo a função |
| D-6 | Mensagens: "fale com o suporte para ampliar o plano" | Há autoatendimento | Corrigido |
| D-7 | `MODULES.produtividade` inclui garantia e tempo ocioso | Rotas `warranty-return` e `idle-time` não exigem o módulo | **Aberto** (decidir: liberar ou bloquear) |
| D-8 | QA-057: "impedem" | Pede confirmação | Decisão a validar |
| D-9 | QA-059: "consentido" | Sem consentimento por cliente | Aberto (P1-11) |
| D-10 | `qa-pre-lancamento.md`, "Pontos já identificados" | Anual já disponível (`61cf14e`); `saas-subscriptions.md` e `api/README.md` já atualizados | Trecho desatualizado; não alterei, é arquivo seu e fora do Git |
| D-11 | `endpoints.md` | Rotas ausentes por limitação do gerador | Corrigido |
| D-12 | Comentário em `plans.ts`: limites "em fase posterior" | Já aplicados | Corrigido |
| D-13 | Seed: FINANCE com 6 permissões | `USER_ROLES` só com 4 papéis | Corrigido |

---

## 6. Testes e verificações executadas

| Verificação | Comando | Resultado |
|---|---|---|
| Schema Prisma | `pnpm --filter @oficina/database validate` | Válido |
| Medição inicial: lint, typecheck, build | `pnpm turbo run lint typecheck` | Aprovado (12 tarefas) |
| Medição inicial: unitários do backend | `pnpm turbo run test` | 3 falhas em 2 suítes: `fipe-sync.processor.spec` passou ao repetir, sem alteração no módulo, o que indica instabilidade sob carga; `api-docs.spec` coincidiu com minhas primeiras edições, então a causa da falha inicial não ficou isolada |
| Medição inicial: frontend | vitest | 88 arquivos aprovados |
| Migrações em banco descartável | `migrate:deploy`, `seed` em Postgres 17 | Aplicadas |
| Final: lint, typecheck, build | `pnpm turbo run lint typecheck` | Aprovado (12 tarefas, incluindo o build do frontend) |
| Final: unitários do backend, com cobertura | `jest --coverage` | 60 suítes, 1.316 testes aprovados; limite de cobertura atendido |
| Final: e2e do backend | `jest --config test/jest-e2e.json --runInBand` | 25 suítes, 199 testes aprovados |
| Final: frontend | `vitest run` | 88 arquivos, 466 testes aprovados |
| Navegador, API local | Mecânico, Financeiro, conta suspensa | Impressão sem valores, painel e lista de OS do Financeiro com valores e aviso de só consulta conferidos; a rota da lista de técnicos foi coberta por e2e, mas o campo na tela não foi conferido no navegador |

**Observação não esclarecida:** ao abrir `/agenda` como Financeiro logo depois de reiniciar os servidores, a aba foi parar na página pública `/`. Não há esse redirecionamento no código lido, e a navegação seguinte funcionou, logado. **[Inferência]** Pode ser efeito da aba da ferramenta, que abria `/` ao mesmo tempo, mas não reproduzi nem descartei. Falta testar `/agenda` com esse perfil, que não tem permissão de agenda. A página também não tem guarda própria de permissão.

**O ambiente difere do CI:** Postgres 17 (CI usa 16), Memurai no lugar do Redis, Windows, Node 24 (CI usa 20).

**Não executado:**
- Playwright (`frontend/e2e`);
- qualquer chamada real a Stripe, WA-AKG, SMTP, Google, FIPE ou ViaCEP;
- imagens Docker e `deploy/debian`;
- restauração de backup;
- celular real e leitor de tela;
- carga com volume;
- nenhum item do `qa-pre-lancamento.md` foi marcado como aprovado.

**Testes novos:**
- [access-and-plan-rules.e2e-spec.ts](../backend/test/access-and-plan-rules.e2e-spec.ts);
- [read-only-routes.spec.ts](../backend/src/shared/plan/read-only-routes.spec.ts);
- [access-profile.manager.spec.ts](../backend/src/modules/iam/managers/access-profile.manager.spec.ts);
- casos novos em `billing.service.spec`, `service-order.manager.spec`, `appointment.manager.spec` e `wa-akg.service.spec`.

---

## 7. Plano de ação

Esforço: **P** até meio dia, **M** até 2 dias, **G** mais que isso.

1. **Revisar e publicar estas alterações (P).** Commit, CI, backup e `deploy/debian/update.sh`. Não há migração nova. Ao publicar, a recepção precisa saber que cancelar OS com recebimento agora exige estorno.
2. **Conferir dados já em produção (P).** Consultas somente de leitura, no banco de produção, com backup feito:
   ```sql
   -- Parcelas marcadas como pagas cujo recebimento foi estornado
   SELECT i.id, i.service_order_id, i.amount_cents FROM service_order_installments i
   JOIN service_order_receipts r ON r.id = i.receipt_id
   WHERE i.status = 'PAID' AND i.deleted_at IS NULL AND r.deleted_at IS NOT NULL;

   -- OS canceladas que ainda têm recebimento ativo
   SELECT so.id, so.order_number, SUM(r.amount_cents) AS recebido FROM service_orders so
   JOIN service_order_receipts r ON r.service_order_id = so.id AND r.deleted_at IS NULL
   WHERE so.status = 'CANCELLED' AND so.deleted_at IS NULL GROUP BY so.id;
   ```
   As parcelas de OS cancelada já são filtradas nas consultas. **[Inferência]** Com um único cliente ou nenhum em produção, o resultado deve ser pequeno ou vazio.
3. **Homologar Stripe em modo de teste (M).** Mensal, anual, upgrade, downgrade, falha de cartão, cancelamento e dois Checkouts em paralelo (QA-125 a QA-129).
4. **Homologar WA-AKG e SMTP com número e caixa dedicados (M).** QA-107 a QA-113, e confirmar `PLATFORM_SMTP_URL`.
5. **Provar restauração de backup (P).** `restore-test.sh`, abrindo uma OS e uma foto restauradas (QA-149).
6. **Revisão jurídica (M, externo).** Textos alterados, lista de prestadores, base legal dos lembretes (P1-11) e necessidade de comunicar a nova versão.
7. **Decidir itens de produto (P).** D-7, D-8, P1-11 e pagamento durante o teste.
8. **Rodar Playwright e checar celular real (M).** QA-007, QA-040, QA-069 e QA-147.
9. **Executar o `qa-pre-lancamento.md` na ordem P0 → P1 (G).** Registrar resultado e evidência; atualizar "Pontos já identificados".
10. **Piloto assistido com uma oficina (G).** Duas semanas acompanhando o fluxo completo antes da oferta aberta (QA-155).
11. **Depois do piloto, P2 (M a G),** por ordem de risco: P2-1, P2-3, P2-4, P2-8 e P2-5.
