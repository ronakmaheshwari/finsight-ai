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
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) => (
  <header className="flex flex-col gap-4 border-b pb-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
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
  <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card px-6 py-12 text-center">
    <div className="text-muted-foreground" aria-hidden>
      {icon ?? <Inbox className="size-8" />}
    </div>
    <div>
      <p className="font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
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
  <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-5 py-6">
    <p className="font-medium text-foreground">{title}</p>
    <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    {onRetry ? (
      <Button className="mt-3" size="sm" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    ) : null}
  </div>
);
