---
"@repo/utils": patch
---

Load env files independently of the launch directory.

`dotenv.config()` previously resolved `.env` from `process.cwd()` only, so
starting the API from `apps/api` (or any other workspace) silently skipped
`packages/utils/.env` and threw `Missing required environment variable:
REDIS_URL` even though the variable was set.

`setting.ts` now loads `<cwd>/.env` first (app-level overrides still win) and
then falls back to the package's own `.env`, resolved from `__dirname` so it
works from source, from `dist`, and under Turbo.
