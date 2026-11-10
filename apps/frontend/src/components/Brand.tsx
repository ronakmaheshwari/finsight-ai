import { cn } from "@repo/ui/lib/utils";

/**
 * Grant Thornton master brand mark (the purple interlocking ribbon). The file is
 * a gradient SVG with a transparent background, so it needs a light tile to stay
 * legible on the navy rail.
 */
export const GrantThorntonMark = ({ className }: { className?: string }) => (
  <img src="/Grant_Thornton_idn4AjErxK_0.svg" alt="" aria-hidden className={cn("size-9", className)} />
);

/**
 * Logo + company name lockup. `variant` only controls how the wordmark is
 * coloured: `onDark` for the navigation rail, `onLight` for cards and pages.
 */
export const GrantThorntonBrand = ({
  variant = "onLight",
  subtitle = "FinSight AI · Risk investigation",
  size = "md",
  className,
}: {
  variant?: "onDark" | "onLight";
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) => {
  const onDark = variant === "onDark";
  const markSize = size === "lg" ? "size-14 p-1.5" : size === "sm" ? "size-8 p-1" : "size-9 p-1";
  const titleSize = size === "lg" ? "text-lg" : size === "sm" ? "text-xs" : "text-sm";
  const subtitleSize = size === "lg" ? "text-xs" : "text-[0.6875rem]";

  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-lg",
          markSize,
          // A near-white tile keeps the purple mark readable on both surfaces.
          onDark ? "bg-white/95 ring-1 ring-inset ring-white/25" : "bg-white ring-1 ring-inset ring-border",
        )}
      >
        <GrantThorntonMark className="size-full" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate font-semibold tracking-tight",
            titleSize,
            onDark ? "text-white" : "text-foreground",
          )}
        >
          Grant Thornton
        </span>
        {subtitle ? (
          <span
            className={cn(
              "block truncate",
              subtitleSize,
              onDark ? "text-[var(--rail-muted)]" : "text-muted-foreground",
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
};
