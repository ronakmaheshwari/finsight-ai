---
"@repo/typescript-config": minor
---

Add a `node.json` config that extends `base.json` and opts into `types: ["node"]`.

TypeScript 6/7 changed the default of `compilerOptions.types` from "load every visible
`@types/*` package" to `[]`, so Node globals (`process`, `Buffer`, `global`, ...) stopped
resolving in every package extending `base.json`. Server-side packages (`api`, `@repo/db`,
`cache`, `@repo/validation`) now extend `@repo/typescript-config/node.json` instead.
