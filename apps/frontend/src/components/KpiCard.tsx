import type { ReactNode } from "react";

import { Card, CardContent } from "@repo/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";

export type KpiTone = "neutral" | "critical" | "high" | "medium" | "low";

const TONE: Record<KpiTone, { bar: string; icon: string; value: string }> = {
  neutral: { bar: "bg-border", icon: "bg-muted text-muted-foreground ring-border", value: "text-foreground" },
  critical: { bar: "bg-critical", icon: "bg-critical/10 text-critical ring-critical/20", value: "text-foreground" },
  high: { bar: "bg-high", icon: "bg-high/10 text-high ring-high/20", value: "text-foreground" },
  medium: { bar: "bg-medium", icon: "bg-medium/15 text-medium ring-medium/25", value: "text-foreground" },
  low: { bar: "bg-low", icon: "bg-low/10 text-low ring-low/20", value: "text-foreground" },
};

export const KpiCard = ({
  label,
  value,
  hint,
  icon,
  className,
  tooltip,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
  tooltip?: string;
  tone?: KpiTone;
}) => {
  const skin = TONE[tone];

  const labelNode = tooltip ? (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Focusable so the explanation is reachable by keyboard, not just hover. */}
        <span
          tabIndex={0}
          className="cursor-help rounded-sm underline decoration-dotted decoration-muted-foreground/60 underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  ) : (
    label
  );

  return (
    <Card className={cn("relative gap-0 overflow-hidden rounded-lg border-border py-0 shadow-card", className)}>
      <span className={cn("absolute inset-x-0 top-0 h-0.5", skin.bar)} aria-hidden />
      <CardContent className="px-4 pb-4 pt-5">
        <div className="flex items-start justify-between gap-2">
          <p className="eyebrow leading-snug text-muted-foreground">{labelNode}</p>
          {icon ? (
            <span
              className={cn("grid size-7 shrink-0 place-items-center rounded-md ring-1 ring-inset", skin.icon)}
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
        </div>
        <p className={cn("mt-2.5 text-[1.5rem] font-semibold leading-none tracking-tight tabular-nums xl:text-[1.75rem]", skin.value)}>
          {value}
        </p>
        {hint ? <div className="mt-2 text-xs leading-snug text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
};
