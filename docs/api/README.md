# API

O índice de todos os endpoints, com rota, papéis aceitos, permissão e módulo/limite do plano, está em
[`endpoints.md`](endpoints.md). Ele é gerado a partir dos controllers (`backend/src/shared/api-docs`) e um teste
falha se ficar desatualizado: depois de mudar uma rota ou seus decorators, rode

```bash
UPDATE_API_DOCS=1 pnpm --filter @oficina/backend exec jest src/shared/api-docs
```

Os formatos de entrada e saída de cada endpoint estão nos DTOs de `backend/src/modules/*/dto` e nos tipos de
`packages/contracts`. As convenções (estilo RPC, `snake_case` na rede, formato de erro, autenticação) estão no topo de
`endpoints.md`; a arquitetura completa, em
[`docs/superpowers/specs/2026-07-14-arquitetura-mvp-design.md`](../superpowers/specs/2026-07-14-arquitetura-mvp-design.md).
