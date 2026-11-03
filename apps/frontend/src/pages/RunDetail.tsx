import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Clock, Network, ShieldAlert } from "lucide-react";
import type { RunStatus } from "@repo/shared";

import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Skeleton } from "@repo/ui/skeleton";
import { getRun } from "@/api/runs";
import { errorMessage } from "@/api/client";
import { KpiCard } from "@/components/KpiCard";
import { RunStatusBadge } from "@/components/StatusBadge";
import { ErrorState, PageHeader } from "@/components/States";
import { queryKeys } from "@/lib/queryKeys";
import { formatDateTime, formatDuration, formatElapsed, formatMoney, formatNumber } from "@/lib/format";
import { SEVERITY_LABEL } from "@/lib/severity";

const STEPS: { key: RunStatus; label: string }[] = [
  { key: "QUEUED", label: "Queued" },
  { key: "RUNNING", label: "Running" },
  { key: "COMPLETED", label: "Completed" },
];

interface RunSummary {
  populationInvoices?: number;
  signalCount?: number;
  caseCount?: number;
  casesBySeverity?: Record<string, number>;
  signalsByRule?: Record<string, number>;
  flaggedInvoices?: number;
  totalExposure?: number;
  estimatedHoursSaved?: number;
}

export const RunDetail = () => {
  const { id = "" } = useParams();
  const [now, setNow] = useState(() => Date.now());

  const run = useQuery({
    queryKey: queryKeys.run(id),
    queryFn: () => getRun(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "QUEUED" || status === "RUNNING" ? 2000 : false;
    },
    staleTime: 0,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (run.isPending) return <Skeleton className="h-64 w-full" />;
  if (run.isError) return <ErrorState message={errorMessage(run.error)} onRetry={() => void run.refetch()} />;

  const data = run.data;
  const summary = (data.summary ?? {}) as RunSummary;
  const active = data.status === "QUEUED" || data.status === "RUNNING";

  const stepIndex = data.status === "FAILED" ? 1 : STEPS.findIndex((step) => step.key === data.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Analysis run`}
        description={
          <span>
            {data.dataset.name} ·{" "}
            <Link to={`/datasets/${data.dataset.id}`} className="hover:underline">
              open dataset
            </Link>
          </span>
        }
        actions={
          <>
            <RunStatusBadge status={data.status} />
            <Button asChild variant="ghost" size="sm">
              <Link to={`/engagements/${data.dataset.engagementId}`}>
                <ArrowLeft className="size-4" aria-hidden />
                Dashboard
              </Link>
            </Button>
          </>
        }
      />

      <ol className="flex flex-wrap items-center gap-3" aria-label="Run progress">
        {STEPS.map((step, index) => {
          const reached = stepIndex >= index;
          return (
            <li key={step.key} className="flex items-center gap-3">
              <span
                className={`flex size-7 items-center justify-center rounded-full border text-xs font-semibold ${
                  reached ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                }`}
                aria-current={stepIndex === index ? "step" : undefined}
              >
                {index + 1}
              </span>
              <span className={reached ? "text-sm font-medium" : "text-sm text-muted-foreground"}>{step.label}</span>
              {index < STEPS.length - 1 ? <span className="h-px w-8 bg-border" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>

      {active ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 py-6">
            <Clock className="size-5 animate-pulse text-primary" aria-hidden />
            <div>
              <p className="text-sm font-medium">
                {data.status === "QUEUED" ? "Waiting for a worker…" : "Analysing the dataset…"}
              </p>
              <p className="text-xs text-muted-foreground">
                Elapsed {formatElapsed(data.startedAt, now)}. This page refreshes automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : data.status === "FAILED" ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Analysis failed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{data.error ?? "The worker reported an error."}</p>
            <Button asChild variant="outline" size="sm">
              <Link to={`/datasets/${data.dataset.id}`}>Back to the dataset</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Cases" value={formatNumber(summary.caseCount ?? 0)} icon={<ShieldAlert className="size-4" />} />
            <KpiCard label="Signals" value={formatNumber(summary.signalCount ?? 0)} />
            <KpiCard
              label="Flagged invoices"
              value={`${formatNumber(summary.flaggedInvoices ?? 0)} of ${formatNumber(summary.populationInvoices ?? 0)}`}
            />
            <KpiCard
              label="Exposure"
              value={formatMoney(summary.totalExposure ?? 0)}
              hint={`Duration ${formatDuration(data.durationMs)}`}
            />
            <KpiCard
              label="Hours saved (est.)"
              value={formatNumber(summary.estimatedHoursSaved ?? 0)}
              hint="Estimated, not measured"
              tooltip="Formula: 2 minutes of manual review per flagged invoice, plus 30 minutes per case, divided by 60."
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cases by severity</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-3">
                  {Object.entries(SEVERITY_LABEL).map(([severity, label]) => (
                    <div key={severity} className="rounded border p-3">
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                      <dd className="mt-1 text-xl font-semibold tabular-nums">
                        {formatNumber(summary.casesBySeverity?.[severity] ?? 0)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  Estimated review time saved: {formatNumber(summary.estimatedHoursSaved ?? 0)} hours (estimated, not measured).
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signals by rule</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(summary.signalsByRule ?? {}).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No signals were raised.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {Object.entries(summary.signalsByRule ?? {})
                      .sort(([, a], [, b]) => b - a)
                      .map(([rule, count]) => (
                        <li key={rule} className="flex justify-between gap-3">
                          <span className="font-mono text-xs">{rule}</span>
                          <span className="tabular-nums">{formatNumber(count)}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to={`/engagements/${data.dataset.engagementId}/cases?runId=${data.id}`}>
                <ShieldAlert className="size-4" aria-hidden />
                View cases
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/runs/${data.id}/graph`}>
                <Network className="size-4" aria-hidden />
                Relationship graph
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/runs/${data.id}/analytics`}>
                <BarChart3 className="size-4" aria-hidden />
                Analytics
              </Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Finished {formatDateTime(data.finishedAt)}. Every result is a risk indicator that requires professional review.
          </p>
        </>
      )}
    </div>
  );
};
