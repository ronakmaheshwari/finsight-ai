---
"@repo/eslint-config": minor
---

Replace the Babel-based config with `typescript-eslint` flat configs and split them by
runtime: `base`, `node`, `react-internal`, `react-app`, `next-js`. Every workspace now
extends one of them instead of duplicating rule sets.

Note: the root `typescript` devDependency is pinned to 6.0.3 because `typescript-eslint`
only supports TypeScript <6.1 and loads the hoisted copy. Workspaces keep TypeScript 7
for `tsc`.
