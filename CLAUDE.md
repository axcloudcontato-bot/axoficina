# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Ofix (repo name "Oficina SaaS"): multi-tenant ERP SaaS for mechanic workshops. UI text, commit-adjacent docs and user-facing copy are in Brazilian Portuguese. See `README.md` and `docs/` for feature guides (subscriptions, LGPD, deployment).

## Monorepo

pnpm workspaces + Turborepo (Node >=20, pnpm 9). Packages:

- `backend/` (`@oficina/backend`): NestJS 11, Express 5, BullMQ/Redis.
- `frontend/` (`@oficina/frontend`): Next.js 15 App Router, React 19, Tailwind 3, TanStack Query, Zustand.
- `database/` (`@oficina/database`): Prisma schema + SQL migrations (PostgreSQL).
- `packages/contracts/` (`@oficina/contracts`): DTO types, plan catalog and shared logic used by both sides.

## Commands

```bash
pnpm turbo run dev                 # backend (:3001) + frontend (:3000) in watch mode
pnpm turbo run lint typecheck      # run before every push (CI runs these)
pnpm turbo run test                # all unit tests (backend jest + frontend vitest)
pnpm --filter @oficina/backend test:e2e   # needs Postgres + Redis; only CI normally runs it
pnpm --filter @oficina/frontend test:e2e  # Playwright
pnpm --filter @oficina/database validate  # validate Prisma schema
```

Single tests:

```bash
pnpm --filter @oficina/backend exec jest path/to/file.spec.ts            # unit (src/**/*.spec.ts)
pnpm --filter @oficina/backend exec jest --config ./test/jest-e2e.json test/auth.e2e-spec.ts
pnpm --filter @oficina/frontend exec vitest run path/to/file.test.tsx
```

Build order matters (`turbo.json`: lint/typecheck/test depend on `^build`). After editing:

- `packages/contracts/src` → `pnpm --filter @oficina/contracts build` (consumers read `dist/`).
- `database/prisma/schema.prisma` → `pnpm --filter @oficina/database generate`; migrations are hand-numbered SQL folders in `database/prisma/migrations` (`57_plans`, `58_billing`, `59_account_closure`, ...).

Frontend `tsc` may show stale errors from `.next/types`; ignore them. Running the full vitest suite alongside other heavy jobs causes timeouts; rerun alone before assuming a failure.

## Backend architecture

- Layering per module in `backend/src/modules/<name>/`: Controller → Manager → Repository (+ DTOs, spec files). Modules are wired in `app.module.ts`.
- Global guards run in this order: `ClientIpThrottler`, `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `ModulesGuard` (`@RequiresModule`), `PlanLimitGuard` (`@PlanLimit('write'|'users'|'orders'|'photos')`). `JwtAuthGuard` also rejects tokens of closed tenants.
- Multi-tenancy: every business table has `tenant_id`; tenant comes from the JWT via `shared/tenant-context`. `test/tenant-isolation.e2e-spec.ts` guards leaks.
- Plans/entitlements: the catalog lives in `packages/contracts/src/plans.ts` (Essencial/Profissional/Completo, modules, limits, trial = 14 days, `resolvePlan` maps legacy/unknown plans to completo). Backend enforcement is in `shared/plan` (`EntitlementsService`, 30s cache, call `forget(tenantId)` after changes; `PlanUsageService`); the frontend mirrors it with `features/plan` (`ModuleLocked`, `PlanNotice`, sidebar locks).
- Billing is Stripe only (not Asaas): `modules/billing` uses a fetch-based `StripeClient` (no SDK), Checkout Sessions, one active product per plan (`ofix_plan_<code>`), signature-verified webhook at `/api/v1/webhooks/billing` (needs rawBody, set in `bootstrap.ts`). Provider failures must return 422/503, never 502/504 (Cloudflare swallows the body). The Stripe account is shared with another product: never change its default portal config or webhooks.
- Account closure: tenant soft-delete (`deletedAt`, `purge_after`, 30-day grace) in `modules/account-closure`; Stripe subscription is cancelled first and closure aborts if that fails; a daily BullMQ job (05:00, skipped when `NODE_ENV=test`) purges expired tenants with raw SQL across all `tenant_id` tables plus `UPLOAD_DIR/<tenantId>`. Owner closes via `POST api/v1/account/close`; SaaS manager via `admin/subscriptions/:id/{close,restore,purge}` (`SaasAdminGuard`).
- Audit log: new audited metadata keys must be added to `shared/audit-log/audit-metadata.ts`, and labelled in `frontend/features/settings/audit-labels.ts`.

## Frontend architecture

- `app/` holds routes (`(dashboard)` group has the authenticated shell with `ModuleGate`); `features/<domain>/` holds API clients, React Query hooks and components per domain; `components/` is shared UI (shadcn-style) and the landing page (`components/landing`, `components/seo`, `lib/site.ts`).
- Lint rule: do not name a variable `module` (Next lint bans it).
- Every user-visible improvement must add an entry at the top of `frontend/features/updates/release-notes.ts` ("Novidades do sistema") in the same change.
- Design context: `frontend/DESIGN.md`, `frontend/PRODUCT.md`.

## Workflow rules

- Before pushing, run `pnpm turbo run lint typecheck` and grep `backend/test/*e2e*` for any default or behavior you changed (e2e cannot run locally; CI catches it). Watch the CI run after pushing to `main`.
- Never commit `Logo/` or `docs/auditoria-seo/` (untracked on purpose).
- Commit messages follow Conventional Commits (`feat(scope):`, `fix(scope):`).
- Production deploy on the Debian server: `cd /opt/oficina-mecanica && bash deploy/debian/update.sh` (applies migrations); env-only changes: `docker compose --env-file deploy/debian/.env.production -f deploy/debian/compose.production.yml up -d backend`. Back up first with `deploy/debian/backup.sh` before destructive operations. Health: `curl http://127.0.0.1:3006/health`. See `docs/deployment-debian.md`.
