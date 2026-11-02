# Segurança: isolamento entre oficinas e política de scripts (CSP)

## Isolamento entre oficinas

Todo dado de oficina tem `tenant_id`, e o Prisma filtra por ele sozinho (`backend/src/shared/prisma/tenant-isolation.middleware.ts`).
Quatro testes impedem que isso quebre sem ninguém notar:

| Teste | O que impede |
|---|---|
| `tenant-isolation.middleware.spec.ts`, cobertura | Um model novo com coluna `tenantId` ficar fora do filtro. O teste lê o schema do Prisma e exige que cada model esteja em `TENANT_SCOPED_MODELS` ou em `UNSCOPED_TENANT_MODELS` (com o motivo) |
| `tenant-isolation.middleware.spec.ts`, comportamento | Alguma operação deixar de filtrar. Para cada model filtrado, testa leituras, `update`, `delete`, `createMany` e a recusa de listagens sem oficina ativa |
| `unscoped-usage.spec.ts` | Uma consulta nova com `prisma.unscoped` (sem filtro) entrar sem revisão. A lista de usos por arquivo é fixa; mudar a contagem faz o teste falhar |
| `backend/test/tenant-isolation.e2e-spec.ts` | Vazamento real contra o banco (só o CI roda) |

**Ao criar uma tabela com `tenant_id`:** inclua o nome em `TENANT_SCOPED_MODELS`. Se ela precisar mesmo ficar fora
do filtro (webhook, rotina do sistema), inclua em `UNSCOPED_TENANT_MODELS` com o motivo.

**Ao usar `prisma.unscoped`:** só em rotinas sem oficina ativa (jobs, webhooks, login, convites). Filtre `tenantId` à mão,
explique no código e atualize a contagem em `unscoped-usage.spec.ts`. O resto do código usa `prisma.client`.

Com uma oficina ativa, `update`, `delete` e `findUnique` por id agora também levam `tenantId`: o id de outra oficina
deixa de achar a linha, em vez de alterá-la.

## CSP (política de scripts), em modo de teste

O Caddy envia hoje dois cabeçalhos:

- `Content-Security-Policy`, que bloqueia: só plugins, `<base>`, `frame-ancestors` e `form-action`.
- `Content-Security-Policy-Report-Only`, que **não bloqueia nada**: a política completa (`script-src`, `connect-src`, `img-src`...). O navegador
  avisa o backend do que ela bloquearia, e o backend escreve uma linha por violação no log.

### Ler as violações

```bash
docker compose --env-file deploy/debian/.env.production -f deploy/debian/compose.production.yml logs --since 24h backend | grep "CSP"
```

Cada linha tem o formato `script-src-elem bloqueado: https://origem/arquivo.js em https://ofix.axcloud.com.br/painel` (sem parâmetros de URL).

### O que é ruído e o que é problema

- **Ruído:** origens `chrome-extension://`, `moz-extension://` e `safari-extension://` (extensões do navegador do usuário) e `inline` ou `eval` vindos de uma extensão.
- **Problema:** qualquer outra origem. Pode ser um serviço que o sistema usa e a política esqueceu (então ajuste a política), ou um script injetado que não deveria estar lá (então investigue).
- Os pontos conhecidos já estão liberados: `viacep.com.br` (consulta de CEP) e `*.ingest.de.sentry.io` (Sentry, se ativado). Se a Cloudflare ligar a análise
  de visitas (Web Analytics), vai aparecer `static.cloudflareinsights.com` bloqueado; decida se libera.

### Passar a bloquear

Depois de uns 7 dias úteis sem violações de origens próprias, em `deploy/debian/Caddyfile` troque o nome
`Content-Security-Policy-Report-Only` para `Content-Security-Policy` (e junte as diretivas `object-src`, `base-uri`,
`frame-ancestors` e `form-action` da linha atual na mesma política). Depois: `git pull && bash deploy/debian/update.sh`
(o `update.sh` recria o Caddy quando o Caddyfile muda). Para voltar atrás, basta reverter o commit.

`script-src` mantém `'unsafe-inline'` porque o Next.js injeta scripts em linha na hidratação. A política barra scripts de
**outros domínios** e restringe para onde dados podem ser enviados (`connect-src`), mas não impede um script em linha injetado. Fechar isso
exige nonce por requisição, o que obriga o Next a renderizar tudo sob demanda (a landing deixa de ser estática).
