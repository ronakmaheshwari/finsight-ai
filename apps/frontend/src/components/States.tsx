import type { ReactNode } from "react";
import { Inbox, Loader2 } from "lucide-react";

import { Button } from "@repo/ui/button";

export const Spinner = ({ label = "Loading" }: { label?: string }) => (
  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
    <Loader2 className="size-4 animate-spin" aria-hidden />
    {label}
  </span>
);

export const PageHeader = ({
  title,
  eyebrow,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) => (
  <header className="flex flex-col gap-4 border-b border-border pb-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="text-[1.5rem] font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
    {children}
  </header>
);

export const EmptyState = ({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
    <span
      className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground"
      aria-hidden
    >
      {icon ?? <Inbox className="size-5" />}
    </span>
    <div>
      <p className="font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {action ? <div className="flex flex-wrap justify-center gap-2">{action}</div> : null}
  </div>
);

export const ErrorState = ({
  message,
  onRetry,
  title = "Could not load this page",
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) => (
  <div
    role="alert"
    className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-5 py-4"
  >
    <span className="mt-0.5 size-2 shrink-0 rounded-full bg-destructive" aria-hidden />
    <div className="min-w-0">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button className="mt-3" size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  </div>
);
