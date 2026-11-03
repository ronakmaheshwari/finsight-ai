import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  MinusCircle,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type { CaseStatus, DatasetStatus, RunStatus } from "@repo/shared";

import { cn } from "@repo/ui/lib/utils";
import { CASE_STATUS_CLASS, CASE_STATUS_LABEL } from "@/lib/severity";

export const CaseStatusBadge = ({ status, className }: { status: CaseStatus; className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
      CASE_STATUS_CLASS[status],
      className,
    )}
  >
    <Circle className="size-2 fill-current" aria-hidden />
    {CASE_STATUS_LABEL[status]}
  </span>
);

const RUN_ICON: Record<RunStatus, typeof Clock> = {
  QUEUED: Clock,
  RUNNING: Loader2,
  COMPLETED: CheckCircle2,
  FAILED: XCircle,
};

const RUN_CLASS: Record<RunStatus, string> = {
  QUEUED: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  RUNNING: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  COMPLETED: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  FAILED: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
};

export const RunStatusBadge = ({ status, className }: { status: RunStatus; className?: string }) => {
  const Icon = RUN_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        RUN_CLASS[status],
        className,
      )}
    >
      <Icon className={cn("size-3.5", status === "RUNNING" && "animate-spin")} aria-hidden />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
};

const DATASET_ICON: Record<DatasetStatus, typeof Clock> = {
  UPLOADED: Circle,
  VALIDATING: Loader2,
  VALIDATED: CheckCircle2,
  FAILED: ShieldAlert,
};

export const DatasetStatusBadge = ({ status, className }: { status: DatasetStatus; className?: string }) => {
  const Icon = DATASET_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        status === "VALIDATED"
          ? RUN_CLASS.COMPLETED
          : status === "FAILED"
            ? RUN_CLASS.FAILED
            : status === "VALIDATING"
              ? RUN_CLASS.RUNNING
              : RUN_CLASS.QUEUED,
        className,
      )}
    >
      <Icon className={cn("size-3.5", status === "VALIDATING" && "animate-spin")} aria-hidden />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
};

export const AiStatusBadge = ({
  status,
  reviewStatus,
}: {
  status: string;
  reviewStatus?: string;
}) => {
  const label =
    status === "NONE"
      ? "Not generated"
      : status === "COMPLETED"
        ? (reviewStatus ?? "COMPLETED").charAt(0) + (reviewStatus ?? "COMPLETED").slice(1).toLowerCase()
        : status.charAt(0) + status.slice(1).toLowerCase();
  const Icon = status === "FAILED" ? MinusCircle : status === "COMPLETED" ? CheckCircle2 : Clock;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5" aria-hidden />
      AI: {label}
    </span>
  );
};
