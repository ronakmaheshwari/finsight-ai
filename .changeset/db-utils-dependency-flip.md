---
"@repo/db": patch
"@repo/utils": patch
---

Reverse the `@repo/db` ⇄ `@repo/utils` dependency so `db` can consume shared config.

- `@repo/utils` no longer depends on `@repo/db`; `jwtToken.ts` now uses `import type { Role } from "@prisma/client"`,
  which is erased at runtime (previously importing `@repo/db` also instantiated a `PrismaClient`).
- `@repo/db` now depends on `@repo/utils` and can import env config via the `@repo/utils/setting` subpath export.
- Added the `./setting` subpath export so consumers can pull env config without loading bcrypt/jsonwebtoken from the barrel.
