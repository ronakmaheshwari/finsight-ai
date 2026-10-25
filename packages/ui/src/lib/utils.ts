// Single source of truth for class merging.
//
// shadcn/ui components import `cn` straight from the `cn` package (it is a
// compiled drop-in replacement for `clsx` + `tailwind-merge`). Re-exporting it
// here means app code can keep importing `@repo/ui/lib/utils` and get the exact
// same behaviour as the components.
export { cn } from "cn";
