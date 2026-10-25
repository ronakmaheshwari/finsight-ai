# `@repo/eslint-config`

Shared ESLint flat configs for every workspace in this monorepo.

```js
// eslint.config.mjs
import { config } from "@repo/eslint-config/node";

export default config;
```

| Import path                       | Use it for                                                    |
| --------------------------------- | ------------------------------------------------------------- |
| `@repo/eslint-config/base`        | Plain TypeScript / JavaScript, no runtime globals             |
| `@repo/eslint-config/node`        | Node.js services and libraries (API, Prisma, Redis, utils)    |
| `@repo/eslint-config/react-internal` | Shared React component libraries (`@repo/ui`)              |
| `@repo/eslint-config/react-app`   | React apps bundled by Vite (`apps/frontend`)                  |
| `@repo/eslint-config/next-js`     | Next.js applications                                          |

Every config ships with:

- `@eslint/js` recommended rules
- `typescript-eslint` recommended rules
- `turbo/no-undeclared-env-vars`
- `eslint-config-prettier` (formatting is Prettier's job, not ESLint's)

Rules that can be auto-fixed (`consistent-type-imports`, unused vars) are reported
as warnings but still fail CI because every workspace runs `eslint . --max-warnings 0`.

## Add a new workspace

```json
{
  "scripts": { "lint": "eslint . --max-warnings 0" },
  "devDependencies": { "@repo/eslint-config": "*", "eslint": "10.9.1" }
}
```
