# Oficina SaaS

Políticas de privacidade, termos, cookies, reembolso e procedimentos LGPD: [documentação de implantação e atendimento](docs/privacy-lgpd.md).

ERP SaaS multi-tenant para oficinas mecânicas.

## Stack

- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL + Redis + BullMQ
- **Frontend:** Next.js (App Router) + Tailwind CSS + shadcn/ui + TanStack Query + Zustand
- **Monorepo:** Turborepo + pnpm workspaces
- **Infra:** Docker Compose (local) · Railway (staging) · AWS ECS Fargate + RDS (produção)

Arquitetura completa: [`docs/superpowers/specs/2026-07-14-arquitetura-mvp-design.md`](docs/superpowers/specs/2026-07-14-arquitetura-mvp-design.md).

## Pré-requisitos

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+ (`npm install -g pnpm` se ainda não tiver)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para Postgres/Redis/NGINX locais)

## Setup

```bash
# bash / Git Bash
./scripts/setup.sh
```

```powershell
# PowerShell
.\scripts\setup.ps1
```

O script copia os `.env.example` para `.env`, instala as dependências e sobe
Postgres/Redis via Docker (se o Docker estiver disponível).

## Desenvolvimento

```bash
# Backend + frontend em modo watch
pnpm turbo run dev

# Subir a stack completa (Postgres, Redis, backend, frontend, NGINX)
docker compose -f docker/docker-compose.yml --project-directory . up
```

- Backend: http://localhost:3001 (health check em `/health`)
- Frontend: http://localhost:3000
- Via NGINX (proxy reverso): http://localhost:8080

## Produção em Debian

A stack de produção isolada, com HTTPS automático, migrações e backup, está
documentada em [`docs/deployment-debian.md`](docs/deployment-debian.md).

## Comandos úteis

| Comando | O que faz |
|---|---|
| `pnpm turbo run build` | Build de todos os pacotes |
| `pnpm turbo run lint` | Lint de todos os pacotes |
| `pnpm turbo run typecheck` | Typecheck de todos os pacotes |
| `pnpm turbo run test` | Testes de todos os pacotes |
| `pnpm --filter=@oficina/database validate` | Valida o schema do Prisma |

## Estrutura do monorepo

```
backend/            NestJS (Controller → Manager → Repository)
frontend/            Next.js App Router
packages/contracts/  DTOs/tipos compartilhados entre backend e frontend
database/            Schema e migrations do Prisma
docker/              docker-compose e configuração do NGINX
infra/               Terraform (AWS) — cresce pós-MVP
docs/                Documentação (arquitetura, API, roadmap)
scripts/             Scripts de setup e seed
.planning/           Specs, plans e epics (workflow Spartan)
```

## Planejamento

- Epic atual: [`.planning/epics/nucleo-operacional-mvp.md`](.planning/epics/nucleo-operacional-mvp.md)
- Design tokens: [`.planning/design/system/tokens.md`](.planning/design/system/tokens.md)
