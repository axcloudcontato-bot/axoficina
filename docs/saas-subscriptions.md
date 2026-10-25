# Administração das assinaturas do SaaS

A página `/admin/subscriptions` reúne todas as oficinas não excluídas, com busca por nome, CPF/CNPJ ou e-mail, filtro por situação e paginação. O link **Assinaturas do SaaS** aparece no menu para as contas autorizadas.

## Habilitar acesso

Em produção, primeiro publique a versão que inclui este módulo. No servidor
Debian, atualize o checkout e execute `./deploy/debian/deploy.sh` para construir
o frontend e a API e aplicar as migrações. A página local não é publicada
automaticamente no domínio da instalação.

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
- Oficinas existentes e novas começam com assinatura **Não configurada**, valor zero e o plano já existente. O cadastro não cria uma contratação paga.
- Situações disponíveis: não configurada, em teste, ativa, inadimplente e cancelada. A situação é informada manualmente; a data de vencimento não muda a situação automaticamente.
- A receita mensal recorrente soma apenas as assinaturas ativas. Valores anuais são divididos por 12 e o total é arredondado para centavos. Os indicadores são globais e não seguem os filtros da lista.
- O vencimento representa um dia de calendário e é exibido sem conversão de fuso horário.
- Alterações administrativas não cobram, não estornam e não bloqueiam automaticamente o acesso à oficina. Integração com um provedor de pagamento e regras de bloqueio são etapas separadas.
- Toda atualização grava uma auditoria `subscription.updated` na mesma transação, com autor, oficina e condições anteriores/novas. Observações livres não são copiadas para a auditoria.
- Se outra pessoa alterar a oficina enquanto a edição estiver aberta, o servidor recusa a sobrescrita. Feche a edição, atualize a lista e reabra a assinatura.

## API

- `GET /api/v1/admin/access`: informa se a conta autenticada pode acessar o painel.
- `GET /api/v1/admin/subscriptions`: aceita `offset`, `limit` (1–100), `search` e `status`.
- `PATCH /api/v1/admin/subscriptions/:id`: atualiza as condições e exige `expected_updated_at` correspondente à versão consultada (ou `null` se nunca atualizada), além dos demais campos do formulário.

A API usa `snake_case` no transporte e o cliente do frontend faz a conversão habitual do projeto para `camelCase`. A resposta seleciona apenas os campos necessários à gestão de assinaturas; não inclui senhas, configuração de e-mail ou segredos de integração das oficinas.
