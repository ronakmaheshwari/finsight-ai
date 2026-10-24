---
"@repo/utils": minor
"@repo/db": patch
---

Make env config lazy and wire it into the Prisma client.

- `setting.ts` now exports an `env` object with getters instead of eager constants, so importing it never
  throws. Missing required variables fail on first access; `validateEnv()` remains for fail-fast at boot.
  **Migration:** `import { DATABASE_URL } from "@repo/utils/setting"` → `import { env } from "@repo/utils/setting"`
  then `env.DATABASE_URL`.
- `@repo/db` now reads `DATABASE_URL` from `@repo/utils/setting` and passes it to `PrismaPg` from the
  already-installed `@prisma/adapter-pg`, so `PrismaClient` has a datasource (the schema declares none).
