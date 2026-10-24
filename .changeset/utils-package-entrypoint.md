---
"@repo/utils": patch
---

Give `@repo/utils` a real entrypoint: add `src/index.ts` barrel, point `main` and
`exports["."]` at `dist/index.js` / `dist/index.d.ts` (`types` first), and add a `build` script.
Consumers importing `@repo/utils` previously failed with TS2307.
