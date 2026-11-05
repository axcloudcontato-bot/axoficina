# Administração das assinaturas do SaaS

A página `/admin/assinaturas` reúne as oficinas, com busca por nome, CPF/CNPJ ou e-mail, filtro por situação e paginação. O link **Administração do SaaS** aparece no menu apenas para as contas autorizadas. A contratação pela própria oficina fica em `/configuracoes/assinatura`.

## Habilitar acesso

Em produção, publique a versão pelo procedimento de [atualização em Debian](deployment-debian.md), que constrói o frontend e a API e aplica as migrações. A página local não é publicada automaticamente no domínio da instalação.

1. Execute as migrações: `pnpm --filter @oficina/database migrate:deploy`.
2. Localize o UUID da sua conta na tabela `users`. Não use o ID da oficina.
3. Defina `SAAS_ADMIN_USER_IDS=UUID_DA_CONTA` no ambiente do backend. Para várias contas, separe os IDs por vírgula.
4. Reinicie o backend e atualize a página.

Os arquivos Compose de desenvolvimento e produção encaminham essa variável ao backend. Sem IDs configurados, ninguém tem acesso global. O papel `ADMIN`, os convites e os perfis customizados de uma oficina não concedem essa autorização. Cada chamada de consulta e atualização exige JWT válido de usuário ativo e verifica a lista autorizada no servidor.

Na instalação Debian, configure `SAAS_ADMIN_USER_IDS` em
`deploy/debian/.env.production`, usando o UUID da conta **no banco de produção**.
Depois de alterar o arquivo, recrie o serviço para carregar o novo ambiente:

```bash
docker compose --env-file deploy/debian/.env.production \
  -f deploy/debian/compose.production.yml up -d --no-deps backend
```

Atualize a página no navegador após a recriação. Não é necessário mudar a
senha da conta nem conceder esse acesso aos demais administradores de oficinas.

## Operação

- Edite o nome do plano, a situação, o valor total por período (em reais), a periodicidade mensal/anual, o próximo vencimento e as observações internas.
- Uma oficina nova começa com **14 dias de teste**, sem cartão nem cobrança paga, com acesso aos recursos do plano Completo. Depois, o administrador escolhe um plano e paga pelo Stripe para continuar a usar o sistema.
- Situações disponíveis: não configurada, em teste, ativa, inadimplente e cancelada. O painel global pode ajustá-las manualmente; os eventos de pagamento do Stripe também atualizam a situação da assinatura integrada.
- A receita mensal recorrente soma apenas as assinaturas ativas. Valores anuais são divididos por 12 e o total é arredondado para centavos. Os indicadores são globais e não seguem os filtros da lista.
- O vencimento representa um dia de calendário e é exibido sem conversão de fuso horário.
- Uma alteração feita no painel global não executa uma cobrança nem um estorno no Stripe. A situação da assinatura afeta o acesso conforme as regras do plano; confirme o efeito antes de salvar uma mudança administrativa.
- Toda atualização grava uma auditoria `subscription.updated` na mesma transação, com autor, oficina e condições anteriores/novas. Observações livres não são copiadas para a auditoria.
- Se outra pessoa alterar a oficina enquanto a edição estiver aberta, o servidor recusa a sobrescrita. Feche a edição, atualize a lista e reabra a assinatura.

## Contratação e cobrança pela oficina

- Em **Configurações → Assinatura e dados**, o administrador escolhe Essencial, Profissional ou Completo e pagamento mensal ou anual. O valor anual corresponde a 12 mensalidades, sem desconto, cobrado de uma vez por ano.
- A primeira contratação abre uma página segura do Stripe. O plano só é ativado depois da confirmação do pagamento pelo webhook.
- Ao mudar a periodicidade de uma assinatura ativa, o Stripe reinicia o período e pode cobrar imediatamente, com créditos ou ajustes pelo período já pago. A confirmação na tela avisa antes de prosseguir. Uma troca para um plano superior também pode cobrar a diferença imediatamente; uma redução de plano no mesmo período fica agendada para o próximo pagamento.
- O administrador pode abrir o portal para forma de pagamento e recibos ou cancelar a renovação. O cancelamento mantém o acesso até o fim do período pago.
- A configuração e a homologação de chaves, webhook e meios de pagamento estão em [implantação em Debian](deployment-debian.md). Teste a jornada mensal e anual no modo de teste do Stripe antes de oferecer a contratação.

## API

- `GET /api/v1/admin/access`: informa se a conta autenticada pode acessar o painel.
- `GET /api/v1/admin/subscriptions`: aceita `offset`, `limit` (1–100), `search` e `status`.
- `PATCH /api/v1/admin/subscriptions/:id`: atualiza as condições e exige `expected_updated_at` correspondente à versão consultada (ou `null` se nunca atualizada), além dos demais campos do formulário.
- `POST /api/v1/admin/subscriptions/:id/close`, `/restore` e `/purge`: encerramento, restauração e exclusão definitiva com confirmação e auditoria.
- `GET /api/v1/billing`, `GET /api/v1/billing/invoices`, `POST /api/v1/billing/checkout`, `/portal` e `/cancel`: consulta e gestão da cobrança pela oficina.

A API usa `snake_case` no transporte e o cliente do frontend faz a conversão habitual do projeto para `camelCase`. A resposta seleciona apenas os campos necessários à gestão de assinaturas; não inclui senhas, configuração de e-mail ou segredos de integração das oficinas.
