# `@repo/ui`

Shared React component library for every app in the monorepo: the full
[shadcn/ui](https://ui.shadcn.com) registry (new-york style) on Tailwind CSS v4.
Nothing is pre-built — apps import the TypeScript source directly, so there is no
build step to run.

## Structure

```
src/
  components/         61 shadcn/ui components (@repo/ui/button, @repo/ui/card, ...)
  hooks/use-mobile.ts  hook used by the sidebar
  lib/utils.ts         cn() — re-exported from the `cn` package
  styles/globals.css   Tailwind v4 entry + design tokens (light/dark)
```

## Use it in an app

```tsx
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@repo/ui/dialog";
```

The app loads the shared stylesheet **once**, in its global CSS file:

```css
/* apps/frontend/src/index.css */
@import "@repo/ui/globals.css";

/* Tailwind ignores node_modules, where this package is symlinked. */
@source "../../../packages/ui/src";
```

…and registers the Tailwind Vite plugin:

```ts
// apps/frontend/vite.config.ts
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({ plugins: [tailwindcss()] });
```

Forgetting the `@source` line is the usual cause of "the classes in the shared
package do nothing".

## Components

**Form & input**
`button`, `button-group`, `calendar`, `checkbox`, `combobox`, `field`, `form`,
`input`, `input-group`, `input-otp`, `label`, `native-select`, `radio-group`,
`select`, `slider`, `switch`, `textarea`, `toggle`, `toggle-group`

**Layout & navigation**
`accordion`, `aspect-ratio`, `breadcrumb`, `carousel`, `collapsible`, `direction`,
`menubar`, `navigation-menu`, `pagination`, `resizable`, `scroll-area`,
`separator`, `sheet`, `sidebar`, `tabs`

**Overlays**
`alert-dialog`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`,
`hover-card`, `popover`, `tooltip`

**Feedback & status**
`alert`, `badge`, `empty`, `kbd`, `marker`, `progress`, `skeleton`, `sonner`,
`spinner`

**Data display**
`avatar`, `card`, `chart`, `item`, `table`

**Chat / AI**
`attachment`, `bubble`, `message`, `message-scroller`

## Providers

Some components need a provider at the app root:

```tsx
import { TooltipProvider } from "@repo/ui/tooltip";

<TooltipProvider>{children}</TooltipProvider>;
```

- `tooltip` → `TooltipProvider`
- `sonner` → render `<Toaster />` once; it reads the theme through `next-themes`,
  so a `next-themes` provider is recommended
- `chart` → wrap in `<ChartContainer config={...}>` and pass `recharts` props

## Adding or updating components

`components.json` points the shadcn CLI at this package, so new components are
written to `src/components` and import through the `@repo/ui/*` aliases:

```bash
cd packages/ui
npx shadcn@latest add dialog
```

Components are kept byte-for-byte identical to the registry so they can be
regenerated with `--overwrite`. Because of that, `eslint.config.mjs` disables two
React Compiler rules (`react-hooks/purity`, `react-hooks/set-state-in-effect`) for
`src/components/**` and `src/hooks/**` only — hand-written code outside those
directories is still fully linted.

## Styling

- `cn()` comes from the [`cn`](https://github.com/shadcn-ui/cn) package (a compiled
  drop-in replacement for `clsx` + `tailwind-merge`), which is what the registry
  components import. `@repo/ui/lib/utils` re-exports it so app code and components
  always behave the same.
- Tokens are CSS variables in `:root` / `.dark`, mapped to Tailwind utilities via
  `@theme inline`. Add the `dark` class to `<html>` to switch themes.
- Add app-specific components outside this package (e.g. `apps/frontend/src/components`)
  and keep primitives here.

## Path aliases

- `@repo/ui/<component>` → `src/components/<component>.tsx`
- `@repo/ui/components/<component>` → same file (used internally by components)
- `@repo/ui/lib/<file>` → `src/lib/<file>.ts`
- `@repo/ui/hooks/<file>` → `src/hooks/<file>.ts`
- `@repo/ui/globals.css` → `src/styles/globals.css`
