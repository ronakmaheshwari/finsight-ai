import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, X } from "lucide-react";
import { CASE_STATUSES, SEVERITIES } from "@repo/shared";
import type { CaseStatus, Severity } from "@repo/shared";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Skeleton } from "@repo/ui/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { listCases } from "@/api/cases";
import { listDirectory } from "@/api/users";
import { errorMessage } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { CaseTable } from "@/components/CaseTable";
import { Pagination } from "@/components/Pagination";
import { EmptyState, ErrorState, PageHeader } from "@/components/States";
import { queryKeys } from "@/lib/queryKeys";
import { CASE_STATUS_LABEL, SEVERITY_CLASS, SEVERITY_LABEL } from "@/lib/severity";

const csv = (values: string[]): string | undefined => (values.length ? values.join(",") : undefined);

export const CaseQueue = () => {
  const { eid = "" } = useParams();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const runId = params.get("runId") ?? undefined;
  const statuses = (params.get("status") ?? "").split(",").filter(Boolean);
  const severities = (params.get("severity") ?? "").split(",").filter(Boolean);
  const assignedTo = params.get("assignedTo") ?? "";
  const minScore = Number(params.get("minScore") ?? 0);
  const q = params.get("q") ?? "";
  const page = Number(params.get("page") ?? 1);
  const sortBy = (params.get("sortBy") ?? "priority") as "priority" | "riskScore" | "exposureAmount" | "createdAt";
  const sortDir = (params.get("sortDir") ?? "desc") as "asc" | "desc";

  const query = {
    engagementId: eid,
    ...(runId ? { runId } : {}),
    status: csv(statuses),
    severity: csv(severities),
    assignedTo: assignedTo || undefined,
    minScore: minScore > 0 ? minScore : undefined,
    q: q || undefined,
    sortBy,
    sortDir,
    page,
    pageSize: 25,
  };

  const cases = useQuery({
    queryKey: queryKeys.cases(query),
    queryFn: () => listCases(query),
    staleTime: 30_000,
  });

  const directory = useQuery({
    queryKey: queryKeys.directory,
    queryFn: listDirectory,
    enabled: user?.role !== "VIEWER",
    staleTime: 60_000,
  });

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const toggle = (key: "status" | "severity", value: string) => {
    const current = key === "status" ? statuses : severities;
    const next = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
    update({ [key]: next.join(","), page: null });
  };

  const activeFilters =
    statuses.length + severities.length + (assignedTo ? 1 : 0) + (minScore > 0 ? 1 : 0) + (q ? 1 : 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Case queue"
        title="Cases"
        description={
          user?.role === "VIEWER"
            ? "Viewers see decided cases only."
            : "Every case groups the signals for one entity. Open a case to review the evidence."
        }
        actions={
          runId ? (
            <Button asChild variant="ghost" size="sm">
              <Link to={`/runs/${runId}`}>Back to run</Link>
            </Button>
          ) : null
        }
      />

      <section className="rounded-lg border border-border bg-card shadow-card" aria-label="Filters">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow w-full sm:w-auto">Status</span>
            {CASE_STATUSES.map((status) => {
              const active = statuses.includes(status);
              return (
                <Button
                  key={status}
                  size="xs"
                  variant="outline"
                  aria-pressed={active}
                  onClick={() => toggle("status", status)}
                  className={cn(
                    "h-7 rounded-full px-2.5 text-xs font-medium",
                    active
                      ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {CASE_STATUS_LABEL[status as CaseStatus]}
                </Button>
              );
            })}
          </div>

          <span className="hidden h-6 w-px bg-border lg:block" aria-hidden />

          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow w-full sm:w-auto">Severity</span>
            {SEVERITIES.map((severity) => {
              const active = severities.includes(severity);
              return (
                <Button
                  key={severity}
                  size="xs"
                  variant="outline"
                  aria-pressed={active}
                  onClick={() => toggle("severity", severity)}
                  className={cn(
                    "h-7 rounded-full px-2.5 text-xs font-medium",
                    active ? SEVERITY_CLASS[severity as Severity] : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {SEVERITY_LABEL[severity as Severity]}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4 px-4 py-3">
          <div className="space-y-1.5">
            <label htmlFor="assignee-filter" className="eyebrow block">
              Assignee
            </label>
            <Select
              value={assignedTo || "any"}
              onValueChange={(value) => update({ assignedTo: value === "any" ? null : value, page: null })}
            >
              <SelectTrigger id="assignee-filter" className="h-8 w-44 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Anyone</SelectItem>
                <SelectItem value="me">Assigned to me</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {(directory.data ?? []).map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="score-filter" className="eyebrow block">
              Min score <span className="data-num text-foreground">{minScore}</span>
            </label>
            <input
              id="score-filter"
              type="range"
              min={0}
              max={100}
              step={5}
              value={minScore}
              className="h-8 w-36 accent-primary"
              onChange={(event) => update({ minScore: event.target.value, page: null })}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sort-filter" className="eyebrow block">
              Sort by
            </label>
            <div className="flex gap-1">
              <Select value={sortBy} onValueChange={(value) => update({ sortBy: value, page: null })}>
                <SelectTrigger id="sort-filter" className="h-8 w-40 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="riskScore">Risk score</SelectItem>
                  <SelectItem value="exposureAmount">Exposure</SelectItem>
                  <SelectItem value="createdAt">Created</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={sortDir === "desc" ? "Sort descending" : "Sort ascending"}
                onClick={() => update({ sortDir: sortDir === "desc" ? "asc" : "desc", page: null })}
              >
                {sortDir === "desc" ? <ArrowDownWideNarrow className="size-4" aria-hidden /> : <ArrowUpWideNarrow className="size-4" aria-hidden />}
              </Button>
            </div>
          </div>

          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get("q");
              update({ q: typeof value === "string" ? value : null, page: null });
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="case-search" className="eyebrow block">
                Search
              </label>
              <Input id="case-search" name="q" defaultValue={q} placeholder="Title or entity" className="h-8 w-52 text-sm" />
            </div>
            <Button type="submit" size="sm" className="h-8">
              Apply
            </Button>
          </form>

          {activeFilters > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setParams(new URLSearchParams(runId ? { runId } : {}), { replace: true })}
            >
              <X className="size-3.5" aria-hidden />
              Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      </section>


      {cases.isPending ? (
        <Skeleton className="h-56 w-full" />
      ) : cases.isError ? (
        <ErrorState message={errorMessage(cases.error)} onRetry={() => void cases.refetch()} />
      ) : cases.data.rows.length === 0 ? (
        <EmptyState
          title="No cases match"
          description={
            activeFilters > 0
              ? "Relax the filters, or clear them to see every case."
              : "There are no cases for this engagement yet. Run an analysis first."
          }
        />
      ) : (
        <>
          <CaseTable rows={cases.data.rows} />
          <Pagination meta={cases.data.meta} onPage={(next) => update({ page: String(next) })} />
        </>
      )}
    </div>
  );
};
