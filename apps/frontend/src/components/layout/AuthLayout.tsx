import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@repo/ui/button";
import { GrantThorntonBrand } from "@/components/Brand";
import { useTheme } from "@/lib/useTheme";

/**
 * Split-screen auth frame: the same navy rail the app uses sits on the left, so
 * the first screen already belongs to the product instead of floating on grey.
 */
export const AuthLayout = ({
  headline,
  lede,
  points,
  footnote,
  children,
}: {
  headline: string;
  lede: string;
  points: { icon: LucideIcon; title: string; body: string }[];
  footnote: string;
  children: ReactNode;
}) => {
  const { theme, toggle } = useTheme();

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col">
        {/* Hairline grid + a single cool glow: depth without a picture. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage:
              "linear-gradient(to right, oklch(1 0 0 / 12%) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 12%) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-1/3 size-[28rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.6 0.16 262 / 35%), transparent 65%)" }}
        />

        <div className="relative">
          <GrantThorntonBrand variant="onDark" subtitle="FinSight AI · Risk investigation" />
        </div>

        <div className="relative my-auto max-w-md space-y-8 py-12">
          <div>
            <p className="eyebrow text-[var(--rail-label)]">Forensic review console</p>
            <h2 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight text-white">{headline}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--rail-muted)]">{lede}</p>
          </div>

          <ul className="space-y-5">
            {points.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-white/8 ring-1 ring-inset ring-white/10">
                  <Icon className="size-4 text-white/85" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--rail-muted)]">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative max-w-sm border-t border-sidebar-border pt-4 text-[0.6875rem] leading-relaxed text-[var(--rail-label)]">
          {footnote}
        </p>
      </aside>

      <main className="relative flex flex-col bg-background px-5 py-10 sm:px-8">
        <div className="absolute right-4 top-4">
          <Button variant="ghost" size="icon-sm" aria-label="Toggle colour theme" onClick={toggle}>
            {theme === "dark" ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
          </Button>
        </div>

        <div className="my-auto w-full">
          <div className="mx-auto mb-7 lg:hidden">
            <GrantThorntonBrand size="sm" subtitle="FinSight AI · Risk investigation" />
          </div>
          <div className="mx-auto w-full max-w-[26rem]">{children}</div>
        </div>

        <p className="mt-8 text-center text-[0.6875rem] text-muted-foreground">
          <Link to="/about" className="font-medium underline-offset-4 hover:text-foreground hover:underline">
            About the developer
          </Link>
        </p>
      </main>
    </div>
  );
};
