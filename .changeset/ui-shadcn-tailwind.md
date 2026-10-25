---
"@repo/ui": minor
---

Turn the package into a real shadcn/ui + Tailwind CSS v4 component library and ship the
entire registry so apps import components directly from `@repo/ui`.

- `components.json` (new-york, neutral, css variables) so `npx shadcn add` writes here.
- All 61 registry components in `src/components` plus `hooks/use-mobile`.
- `src/styles/globals.css` with the Tailwind v4 entry, `@theme inline` token mapping and
  light/dark OKLCH tokens.
- `src/lib/utils.ts` re-exports `cn` from the `cn` package, matching what the generated
  components import (no `clsx`/`tailwind-merge` duplication).
- Export map: `@repo/ui/<component>`, `@repo/ui/components/*`, `@repo/ui/lib/*`,
  `@repo/ui/hooks/*`, `@repo/ui/globals.css`.
- `react`/`react-dom` are peer dependencies so apps own a single React copy.
- `eslint.config.mjs` keeps the two React Compiler rules quiet for vendored
  `src/components` / `src/hooks` code, which is regenerated from the registry.
