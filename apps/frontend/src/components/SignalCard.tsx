import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SignalRow } from "@repo/shared";
import { RULE_CATALOG } from "@repo/shared";

import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { SeverityBadge } from "./SeverityBadge";
import { formatNumber, titleCase } from "@/lib/format";

const renderValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(", ");
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export const SignalCard = ({
  signal,
  index,
  highlighted,
}: {
  signal: SignalRow;
  index: number;
  highlighted?: boolean;
}) => {
  const [open, setOpen] = useState(index < 2);
  const observed = Object.entries(signal.evidence?.observed ?? {});
  const thresholdEntries = Object.entries(signal.evidence?.threshold ?? {});
  const refs = signal.evidence?.recordRefs ?? [];

  return (
    <li
      id={`signal-${signal.id}`}
      className={cn(
        "rounded-lg border border-border bg-card p-3 transition-colors",
        highlighted && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">
              {RULE_CATALOG[signal.ruleKey as keyof typeof RULE_CATALOG]?.label ?? titleCase(signal.ruleKey)}
            </p>
            <SeverityBadge severity={signal.severity} />
            <span className="text-xs text-muted-foreground">weight {signal.weight}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{signal.title}</p>
          <p className="mt-1 text-sm">{signal.evidence?.explanation}</p>

          {open && (observed.length > 0 || thresholdEntries.length > 0) ? (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">Observed values and thresholds for this signal</caption>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="py-1 pr-3 font-medium">Measure</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Observed</th>
                    <th scope="col" className="py-1 font-medium">Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {observed.map(([key, value]) => (
                    <tr key={key} className="border-b last:border-0">
                      <td className="py-1 pr-3">{titleCase(key)}</td>
                      <td className="py-1 pr-3 font-mono tabular-nums">{renderValue(value)}</td>
                      <td className="py-1 font-mono tabular-nums text-muted-foreground">
                        {renderValue(signal.evidence?.threshold?.[key])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {refs.length > 0 ? (
            <p className="mt-2 flex flex-wrap gap-1 text-xs text-muted-foreground">
              <span className="font-medium">Linked records:</span>
              {refs.map((ref) => (
                <span key={ref} className="rounded bg-muted px-1.5 py-0.5 font-mono">
                  {ref}
                </span>
              ))}
            </p>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-6 px-1 text-xs"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <ChevronDown className="size-3" aria-hidden /> : <ChevronRight className="size-3" aria-hidden />}
            {open ? "Hide detail" : "Show detail"}
          </Button>
        </div>
      </div>
    </li>
  );
};

