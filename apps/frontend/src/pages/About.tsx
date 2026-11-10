import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Globe2, Sparkles, Users } from "lucide-react";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { GrantThorntonBrand, GrantThorntonMark } from "@/components/Brand";

const LINKEDIN_URL = "https://www.linkedin.com/in/rbm77/";
const PORTFOLIO_URL = "https://ronakmaheshwari.tech/";
// LinkedIn portrait, served from public/; the initials badge takes over if it is missing.
const PORTRAIT_SRC = "/RM.jpeg";

const LinkedInGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.36-1.84c3.6 0 4.27 2.37 4.27 5.44v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
  </svg>
);

/** Roles at Grant Thornton, newest first — the same descending order LinkedIn lists them in. */
const EXPERIENCE = [
  {
    title: "Consultant",
    period: "Jul 2026 – Present",
    duration: "5 mos",
    current: true,
  },
  {
    title: "Associate",
    type: "Full-time",
    period: "Apr 2026 – Jul 2026",
    duration: "4 mos",
    current: false,
  },
  {
    title: "Summer Intern",
    type: "Internship",
    period: "Oct 2025 – Apr 2026",
    duration: "7 mos",
    current: false,
  },
];

/** Photo if it loads, initials otherwise, so the page never shows a broken image. */
const Portrait = () => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className="grid size-20 shrink-0 place-items-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary ring-1 ring-inset ring-primary/15 sm:size-24"
        aria-hidden
      >
        RM
      </span>
    );
  }

  return (
    <img
      src={PORTRAIT_SRC}
      alt="Ronak Maheshwari"
      width={80}
      height={80}
      onError={() => setFailed(true)}
      className="size-20 shrink-0 rounded-2xl object-cover object-center ring-1 ring-border sm:size-24"
    />
  );
};

/**
 * Small, public page about the developer. It sits outside the auth guard so it
 * can be opened from the sign-in screen before anyone has an account.
 */
export const About = () => (
  <div className="min-h-svh bg-background">
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <GrantThorntonBrand subtitle="FinSight AI · Risk investigation" />
        <Button asChild variant="ghost" size="sm">
          <Link to="/login">
            <ArrowLeft className="size-4" aria-hidden />
            Sign in
          </Link>
        </Button>
      </div>
    </header>

    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <section className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-center">
        <Portrait />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Ronak Maheshwari</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Consultant</span>
            <span aria-hidden>·</span>
            <span>FS-Risk team</span>
            <span aria-hidden>·</span>
            <span>Grant Thornton Bharat LLP</span>
          </p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Button asChild variant="outline" size="sm">
            <a href={LINKEDIN_URL} target="_blank" rel="noreferrer noopener">
              <LinkedInGlyph className="size-3.5" />
              LinkedIn
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={PORTFOLIO_URL} target="_blank" rel="noreferrer noopener">
              <Globe2 className="size-3.5" aria-hidden />
              Portfolio
              <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          </Button>
        </div>
      </section>

      <section className="py-8">
        <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-foreground">
          I'm a software engineer at Grant Thornton, building the full-stack systems, products and infrastructure that
          risk teams rely on. I work as a Consultant in the FS-Risk team, turning financial-services risk work into
          tools people actually use.
        </p>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 shrink-0" aria-hidden />
          FinSight AI — the console you are looking at — was designed and built by me.
        </p>
      </section>

      <section aria-labelledby="experience" className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <GrantThorntonMark className="size-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">Grant Thornton Bharat LLP</p>
              <p className="truncate text-[0.6875rem] text-muted-foreground">Mumbai, Maharashtra, India · Hybrid</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-foreground">1 yr 2 mos</p>
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-primary underline-offset-4 hover:underline"
            >
              View on LinkedIn
              <ArrowUpRight className="size-3" aria-hidden />
            </a>
          </div>
        </div>

        <h2 id="experience" className="sr-only">
          Experience at Grant Thornton Bharat LLP
        </h2>

        <ol className="mt-5">
          {EXPERIENCE.map((role, index) => {
            const last = index === EXPERIENCE.length - 1;

            return (
              <li key={role.title} className="flex gap-3">
                <div className="flex w-3 flex-col items-center" aria-hidden>
                  <span
                    className={
                      role.current
                        ? "mt-1 size-3 shrink-0 rounded-full bg-primary ring-4 ring-primary/15"
                        : "mt-1 size-3 shrink-0 rounded-full border-2 border-muted-foreground/40 bg-background"
                    }
                  />
                  {last ? null : <span className="mt-1 w-px flex-1 bg-border" />}
                </div>
                <div className={last ? "pb-0" : "pb-6"}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{role.title}</p>
                    {role.current ? (
                      <Badge variant="secondary" className="text-[0.625rem]">
                        Current
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-foreground/80">
                    {role.type ? `${role.type} · ` : ""}
                    {role.period}
                  </p>
                  <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">{role.duration}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <p className="mt-6 flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
        <Users className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        FinSight surfaces risk indicators that require review. It never determines that wrongdoing occurred.
      </p>
    </main>
  </div>
);
