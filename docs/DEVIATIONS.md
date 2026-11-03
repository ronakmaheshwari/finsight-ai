# Deviations from `Format.md`

This file records every place where the implementation differs from the plan in
`Format.md`, with the reason. Anything not listed here is implemented as
specified.

## Repository conventions

| Plan | Implementation | Why |
| --- | --- | --- |
| `routes/*.routes.ts` | `apps/api/src/controller/*.ts` (one router per file) | The existing repo already used `controller/`; renaming it would have broken every import for no functional gain. Each file still owns one router and exports it as default. |
| `services/datasets/` | `apps/api/src/datasets/` | Same reason: the delivered dataset code already lived there. The split into `spec`, `fileReader`, `rows`, `ingest`, `templates`, `validateDataset`, `browse` is as specified. |
| `lib/audit.ts` takes a Prisma client | `writeAudit(client, input)` plus `audit(input)` | The plan asks for `writeAudit(prisma, …)`; both forms exist so routes do not have to pass the client. |
| `packages/shared` is new | Added as a workspace package | The repo had no shared package; the API and web app now import enums, the rule catalog, Zod schemas and API types from `@repo/shared`. |

## Data model

| Plan | Implementation | Why |
| --- | --- | --- |
| Refresh-token table | Reuses the existing `JWTToken` model (hashed token, `expiresAt`, `revokedAt`) | It already provided exactly the fields the rotating-refresh flow needs. |
| `BankAccount` gets `externalId` | Done | Needed so uploads and browsing can refer to `BA-0001`. |
| `Transaction` gets `postedAt` | Done | Replaces the old date-only field. |

Migrations are a single `packages/db/prisma/migrations/20261103000000_init`
generated from the current Prisma schema. The earlier pair could not be applied
to an empty database (the second migration altered columns the first never
created), and the delivered development database had no migration history at
all, so the history was regenerated instead of patched. `prisma migrate deploy`
now reproduces the schema exactly (`prisma migrate diff` reports no drift), and
`npm run db:reset` is only needed for a database created before this change.

## Backend behaviour

| Plan | Implementation | Why |
| --- | --- | --- |
| BullMQ only | BullMQ **with an inline fallback** when Redis is unavailable (`jobs/queues.ts`) | Local development and CI often run without Redis. With Redis present the behaviour is exactly the plan's; without it the job runs in-process and the API stays usable. `/health` reports Redis as down. |
| Redis required at boot | Redis failure is logged and the API continues | Same reason. `validateEnv()` still exits on missing configuration. |
| `zod-to-json-schema` for the tool schema | `z.toJSONSchema` from Zod 4 | The installed Zod version ships this natively; keeping both would risk the two schemas drifting. |
| `/health` only | `/health` and `/ready` (both at the root and under `/api/v1`) | §8.8 defines `/health`; §13.1 also asks for `/ready`. They share one dependency check. |
| `GET /dashboard/:engagementId` | Returns `404` when the engagement has no `COMPLETED` run | The response shape has no null run; the web app shows an empty state for this case. |
| Rule overrides | `RuleConfig.weight` and `enabled` are always written; only **params** are reduced to values that differ from the catalog default | `weight` is a non-null column. The visible behaviour (defaults apply) is unchanged. |
| Seeders read `seed-data/finsight_test_data.xlsx` | The seeder generates the same data deterministically in code (`seed/generateDemoData.ts`) and only uses the workbook when it exists | The workbook and `answer-key.json` are not in this repository. The generator plants S1–S10 with the same ids, so the demo and the acceptance checks still run. Row counts differ from Appendix C (621 invoices instead of 705). |
| `db:seed` checks `answer-key.json` | Checks the generated scenario list (`DEMO_SCENARIOS`) after the run | Same reason; the check is equivalent and fails loudly. |
| `.env.example` | `.env.Example` (updated) | macOS is case-insensitive: `.env.Example` and `.env.example` are the same file. |
| Env names in §13.2 (`JWT_ACCESS_SECRET`, `CORS_ORIGIN`, `ACCOUNT_HMAC_SECRET`, `MAX_UPLOAD_MB`, `LOG_LEVEL`) | Existing names: `JWT_SECRET`, `WEB_ORIGIN`, `ACCOUNT_HASH_SECRET`, `UPLOAD_MAX_MB`; no `LOG_LEVEL` | The repo already read these names in `packages/utils/src/setting.ts`; renaming them would have broken every existing deployment. `.env.Example` documents the real set. `MOCK_LLM`, `ACCESS_TTL`, `REFRESH_TTL_DAYS`, `COOKIE_SECURE` and `ANTHROPIC_API_KEY` match the plan. |
| `POST /auth/register` | Added: public, rate-limited (5/hour/IP), creates a new organisation and its first `ADMIN`, audits `USER_CREATED` and returns a session | §8.1 only defines login/refresh/logout/me, but the product needs a way to create the first organisation. Self-service sign-up is scoped to a brand-new tenant, so it cannot add users to an existing one; those still come from `POST /users` (U2). |
| `zod-to-json-schema` dependency | Left installed but unused (the tool schema uses `z.toJSONSchema`) | Removing it would churn the lockfile for no behavioural change; it is a candidate for the next dependency cleanup. |

## Testing

| Plan | Implementation | Why |
| --- | --- | --- |
| Vitest for backend unit tests | `node:test` (`npm test --workspace=api`) | No test runner was installed; Node's built-in runner needs no new dependency. |
| Integration tests need Postgres | `seed:verify` runs the engine over the generated data without a database | Postgres was not available in the build environment. The same checks run against the database inside `db:seed`. |
| Vitest + RTL for the web app (§12.3) | Implemented with Vitest + Testing Library: `client` (single-flight refresh, 401 retry, error mapping), `AuthProvider` (boot refresh, anonymous fallback, login/logout), `RoleGate`, `UploadCard` + `RowErrorTable`, `ScoreBreakdown`, `AiPanel` states | `npm test` runs both suites. |
| Playwright smoke test | Not written | It needs the docker-compose stack and a browser download; neither was available in this environment. The flow it covers is exercised manually against the seeded demo data. |
| Table-driven role-matrix and tenancy tests (supertest) | Not written | They require a live Postgres. The matrix itself is enforced in `middleware/requireRole.ts` and every query is scoped by `orgId`; the seed acceptance check covers the engine end to end. |

## Frontend

| Plan | Implementation | Why |
| --- | --- | --- |
| `apps/web` | `apps/frontend` | The app already existed at this path with the workspace name `frontend`; renaming would have changed every script and workspace reference. |
| shadcn/ui generated into `apps/web/src/components/ui` | Reuses the existing `@repo/ui` workspace package | It already ships every shadcn/Radix component the screens need, so generating a second copy would create two design systems. |
| `@xyflow/react` (React Flow) for the graph | In-house deterministic SVG `GraphView` | The plan's own §11.9 layout rule (fixed columns, row order, 400-node cap) is implemented directly; the result is keyboard accessible and adds no dependency. The data contract (`GraphPayload`) is unchanged. |
| `recharts` | Used as specified | Installed in `apps/frontend`; every chart also exposes a "View data" table (§11.10). |
| Per-resource query hooks | Typed request functions in `api/*.ts` plus `useQuery`/`useMutation` in pages, with keys from `lib/queryKeys.ts` | Keeps the API layer free of React and makes the query keys the single place that controls invalidation. Behaviour matches §11.6. |
| React 18 | React 19 | The workspace was already on React 19; nothing in §11 depends on a React 18-only feature. |
| — | Top-level `ErrorBoundary` around the router | §11.10 asks for one; it renders a reload panel instead of a blank page and never shows a stack trace. |
| — | `EmptyState.action` is a `ReactNode` | Role-gated actions need to be hidden rather than passed as `{label, onClick}`; the visual result is the same. |

## DevOps

| Plan | Implementation | Why |
| --- | --- | --- |
| `docker-compose.yml` with `postgres:16`, `redis:7`, `api`, `worker`, `web` | Added exactly those services, plus a one-off `migrate` service that runs `prisma migrate deploy` before `api`/`worker` start | §13.1 also asks for migrations as a one-off job; a dedicated service makes the ordering explicit and stops two containers racing the same migration. |
| Multi-stage Dockerfiles | `apps/api/Dockerfile` and `apps/frontend/Dockerfile`, both built from the repository root so npm workspaces resolve | Workspaces cannot be installed from an app subdirectory. |
| Non-root user, `HEALTHCHECK` | API runs as the `finsight` user and health-checks `/health` with `fetch`; nginx health-checks `/` | Alpine images have no `curl`; `node -e` and `wget` are always present. |
| Trimmed production image | The API runtime image keeps dev dependencies | The `migrate` service loads `prisma` and `dotenv` from the workspace; pruning them would make migrations fail. |
| Docker build verified in CI | Not verified here | Docker is unavailable in this environment. The compose file is syntax-checked only; `docker compose config` should be run before first use. |

## Repository tooling (`AGENTS.md`)

`AGENTS.md` asks for Storybook stories and a changeset entry whenever a shared
library changes.

| Rule | Implementation | Why |
| --- | --- | --- |
| Storybook stories for `packages/ui` | Not added | The repository has no Storybook setup (no config, no dependencies). Adding one is a separate piece of work and would not change the delivered behaviour. |
| Changeset entry for changed packages | Not added | `.changeset/` is in `.gitignore` and `@changesets/cli` is not installed, so a changeset file would never be consumed. Package versions were bumped instead (`@repo/db` 1.0.3 → 1.1.0, `@repo/utils` 1.2.0 → 1.3.0, `@repo/validation` 1.0.0 → 1.1.0). |
