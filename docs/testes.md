# Testes e cobertura

| Camada | Onde | Como rodar | Roda no CI |
|---|---|---|---|
| Unitários do backend | `backend/src/**/*.spec.ts` | `pnpm --filter @oficina/backend exec jest` | Sim, com cobertura |
| Integração do backend (Postgres + Redis reais) | `backend/test/*.e2e-spec.ts` | `pnpm --filter @oficina/backend test:e2e` (só o CI costuma rodar) | Sim |
| Unitários e de componentes do frontend | `frontend/**/*.test.ts(x)` | `pnpm --filter @oficina/frontend exec vitest run` | Sim |
| Navegador (Playwright) | `frontend/e2e/*.spec.ts` | `pnpm --filter @oficina/frontend test:e2e`, com o backend no ar | Só manual (veja abaixo) |

## Meta de cobertura

O backend mede a cobertura dos testes unitários em todo `pnpm test` e **falha se ela cair abaixo da meta** (`coverageThreshold` em
`backend/package.json`). A meta fica um ponto abaixo do valor medido, para recusar só quedas reais.

| Medida | Meta | Medido em 01/11/2026 |
|---|---|---|
| Statements | 50% | 50,9% |
| Branches | 56% | 56,9% |
| Funções | 47% | 47,7% |
| Linhas | 51% | 52,2% |

O frontend faz o mesmo (`thresholds` em `frontend/vitest.config.ts`, `pnpm test` roda com `--coverage`):

| Medida | Meta | Medido em 01/11/2026 |
|---|---|---|
| Statements | 52% | 53,2% |
| Branches | 74% | 75,7% |
| Funções | 54% | 55,9% |
| Linhas | 52% | 53,2% |

Quando a cobertura subir de forma consistente, aumente a meta junto. Se um código novo for difícil de testar de forma unitária, cubra-o no
teste de integração em vez de baixar a meta. A cobertura dos testes de integração não entra nessa conta.

## Testes de navegador (Playwright) no GitHub Actions

O workflow `.github/workflows/e2e-browser.yml` sobe Postgres e Redis, aplica migrações e seed, compila e inicia o backend, compila o frontend e roda os
specs de `frontend/e2e` em Chromium. Hoje é **manual**: aba Actions → "E2E browser" → "Run workflow". O relatório e o log do backend ficam como artefato
por 7 dias.

- Os specs fazem vários cadastros do mesmo IP; por isso o workflow define `AUTH_THROTTLE_LIMIT=1000` (em produção vale 5 por minuto).
- Depois que passar de forma estável algumas vezes seguidas, troque `on: workflow_dispatch` por `push`/`pull_request` para rodar a cada mudança.
- Se um spec falhar só no CI, baixe o artefato `e2e-results`: ele traz o log do backend e os traços do Playwright.

## Índice de endpoints

`docs/api/endpoints.md` é gerado dos controllers e um teste unitário falha se ele ficar desatualizado. Para atualizar depois de mudar uma rota:

```bash
UPDATE_API_DOCS=1 pnpm --filter @oficina/backend exec jest src/shared/api-docs
```
