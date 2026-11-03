import { AlertCircle, AlertOctagon, AlertTriangle, Info } from "lucide-react";
import type { Severity } from "@repo/shared";

import { cn } from "@repo/ui/lib/utils";
import { SEVERITY_CLASS, SEVERITY_LABEL } from "@/lib/severity";

const ICONS = {
  CRITICAL: AlertOctagon,
  HIGH: AlertTriangle,
  MEDIUM: AlertCircle,
  LOW: Info,
} as const;

export const SeverityBadge = ({ severity, className }: { severity: Severity; className?: string }) => {
  const Icon = ICONS[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        SEVERITY_CLASS[severity],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {SEVERITY_LABEL[severity]}
    </span>
  );
};
