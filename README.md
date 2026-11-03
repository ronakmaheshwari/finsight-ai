# FinSight AI

AI-assisted financial risk investigation. Upload procurement data (vendors,
employees, bank accounts, purchase orders, invoices, transactions), run a
deterministic risk engine over it, and work the resulting cases: prioritised
evidence, an AI-written investigation for the reviewer, a decision trail and a
PDF export.

> **Language rule.** FinSight never states that fraud occurred. It surfaces
> **risk indicators** that **require review**. Every AI output carries the same
> disclaimer and must be accepted, edited or rejected by a human.

## Monorepo layout

| Path | What it is |
| --- | --- |
| `apps/api` | Express 5 API (`/api/v1`), risk engine, AI investigation, PDF export, BullMQ worker, seeders |
| `apps/frontend` | React 19 + Vite web app (TanStack Query, Tailwind, shadcn via `@repo/ui`) |
| `packages/db` | Prisma schema, migrations and client |
| `packages/shared` | Enums, rule catalog, Zod schemas and API types used by both apps |
| `packages/utils` | Environment validation, JWT helpers |
| `packages/validation` | Legacy Zod validation helpers |
| `packages/cache` | Redis client |
| `packages/ui` | Shared shadcn/Radix component library |
| `docs/DEVIATIONS.md` | Every deliberate difference from `Format.md` |

## Prerequisites

- Node.js 24+ and npm 11 (the repo pins both in `package.json`).
- PostgreSQL 16 and Redis 7 — either locally or through Docker Compose.
- No Anthropic key is needed: with `MOCK_LLM=true` (the default when
  `ANTHROPIC_API_KEY` is empty) the AI investigation is generated
  deterministically.

## Run it with Docker

```sh
docker compose up --build
```

- Web app: <http://localhost:8080>
- API: <http://localhost:3000/api/v1> (`/health`, `/ready`)

Migrations run as a one-off `migrate` service before the API starts. Seed the
demo data once the stack is up:

```sh
docker compose run --rm api node apps/api/dist/seed/index.js
```

## Run it locally

```sh
cp .env.example .env        # fill in DATABASE_URL and REDIS_URL
npm install
npm run db:generate
npm run db:migrate
npm run db:seed             # demo org, users, engagements, datasets, runs and cases
npm run dev                 # API on :3000, web on :5173
```

`npm run db:seed` also prints a verification table: every planted demo scenario
must be detected before the seeder exits successfully.

The API reads the repository-root `.env`. Vite loads env files from
`apps/frontend`, so in development the web app falls back to
`http://localhost:3000/api/v1`; set `VITE_API_URL` (bare host or versioned base —
both are normalised) in `apps/frontend/.env` to point it somewhere else. Docker
Compose passes it as a build argument.

## Accounts

- **Sign up** at `/signup`. The first account of a new organisation becomes its
  `ADMIN`; the organisation is created in the same transaction, so a new user
  never lands inside an existing tenant.
- **Sign in** at `/login`. Teammates are added by an administrator from the
  Users page (they do not self-register into an existing organisation).
- Refresh tokens live in an httpOnly cookie and rotate on every refresh; the
  access token is kept in memory only.

## Demo accounts

All demo users share the password from `SEED_PASSWORD` (default `Demo@1234`).

| Email | Role | Sees |
| --- | --- | --- |
| `admin@demo.com` | ADMIN | Everything, including users and rule settings |
| `manager@demo.com` | MANAGER | Rules, audit log, all cases, decisions |
| `analyst@demo.com` | ANALYST | Datasets, runs, cases, AI investigation |
| `viewer@demo.com` | VIEWER | Read-only cases and decisions already made |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API + web in watch mode |
| `npm run build` | Builds every workspace |
| `npm test` | API engine tests + web unit tests |
| `npm run lint` | ESLint everywhere, zero warnings allowed |
| `npm run check-types` | `tsc` for every workspace |
| `npm run db:generate` / `db:migrate` / `db:seed` / `db:reset` | Prisma lifecycle |
| `npm run seed:verify` | Runs the engine over the generated demo data and prints the scenario table |
| `npm run seed:export-demo-workbook` | Writes the demo data to `seed-data/finsight_test_data.xlsx` |
| `npm run worker` | BullMQ worker (analysis + AI jobs) |

## How an analysis works

1. **Upload.** Six entity files are validated row by row; invalid rows are
   reported with their row numbers and nothing is inserted (422). Templates for
   every entity are downloadable as CSV and XLSX.
2. **Run.** The deterministic engine (`apps/api/src/utils/riskEngine`) applies
   the rule catalog, computes per-rule strength and produces signals, a 0–100
   score per entity group, and cases. Same input, same output — always.
3. **Investigate.** A case can be sent to the AI service. Evidence is masked
   before it leaves the process (aliases, no names, no account numbers), the
   response is validated against a Zod schema, and every finding must cite a
   signal that exists in the case.
4. **Review.** An analyst accepts, edits or rejects the investigation; a manager
   confirms or dismisses the case. Every transition is written to the audit log.
5. **Export.** A confirmed case can be exported as a PDF containing the
   evidence, the reviewer's decision and the language-rule disclaimer.

## Roles

`ADMIN`, `MANAGER`, `ANALYST`, `VIEWER`. The API enforces the matrix on every
route; the web app additionally hides what a role cannot use. Every query is
scoped by `orgId`, so a cross-organisation id returns 404 rather than 403.

## Environment

Every key is documented in `.env.Example`. The API validates the required ones
at boot and exits on a missing value. Never commit a real secret; bank account
numbers are stored only as HMAC hashes.

## Tests and quality gates

```sh
npm run check-types
npm run lint
npm test
```

The backend uses Node's built-in test runner over the compiled output; the web
app uses Vitest + Testing Library. See `docs/DEVIATIONS.md` for the tests that
need a live database or browser and could not run in this environment.
