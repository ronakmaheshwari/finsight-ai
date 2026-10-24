---
"@repo/db": patch
---

Add a `src/index.ts` barrel and point `exports["."]` at `dist/index.js` / `dist/index.d.ts`
(`types` first). Previously the `"."` export targeted files that were never emitted, so
consumers importing `@repo/db` failed with TS2307 "Cannot find module '@repo/db'".
