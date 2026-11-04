import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, Clock, Database, FileWarning, ShieldAlert, TrendingUp } from "lucide-react";

import { Button } from "@repo/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Skeleton } from "@repo/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { toast } from "sonner";
import { getDashboard } from "@/api/dashboard";
import { addMember, getEngagement, listDatasets, removeMember } from "@/api/engagements";
import { listCases } from "@/api/cases";
import { listDirectory } from "@/api/users";
import { errorMessage, ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { RoleGate } from "@/auth/RoleGate";
import { CaseTable } from "@/components/CaseTable";
import { DatasetTable } from "@/components/DatasetTable";
import { KpiCard, type KpiTone } from "@/components/KpiCard";
import { EmptyState, ErrorState, PageHeader } from "@/components/States";
import { RiskByMonthChart, RuleBreakdownChart, TopVendorsChart } from "@/components/Charts";
import { queryKeys } from "@/lib/queryKeys";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { SEVERITY_LABEL, ROLE_LABEL } from "@/lib/severity";
import { writeLastEngagement } from "@/lib/download";
import type { Severity } from "@repo/shared";

const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

/** Each severity KPI carries its own accent so the row reads as a ramp. */
const SEVERITY_TONE: Record<Severity, KpiTone> = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

export const EngagementDashboard = () => {
  const { eid = "" } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const runId = params.get("run") ?? undefined;
  const [memberId, setMemberId] = useState("");

  useEffect(() => {
    writeLastEngagement(eid);
  }, [eid]);

  const engagement = useQuery({
    queryKey: queryKeys.engagement(eid),
    queryFn: () => getEngagement(eid),
    staleTime: 30_000,
  });

  const canSeeDatasets = user?.role !== "VIEWER";

  const datasets = useQuery({
    queryKey: queryKeys.datasets(eid),
    queryFn: () => listDatasets(eid),
    enabled: canSeeDatasets,
    staleTime: 30_000,
  });

  const dashboard = useQuery({
    queryKey: queryKeys.dashboard(eid, runId),
    queryFn: () => getDashboard(eid, runId),
    staleTime: 30_000,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });

  const cases = useQuery({
    queryKey: queryKeys.cases({ engagementId: eid, pageSize: 10 }),
    queryFn: () => listCases({ engagementId: eid, pageSize: 10 }),
    staleTime: 30_000,
  });

  const directory = useQuery({
    queryKey: queryKeys.directory,
    queryFn: listDirectory,
    enabled: user?.role === "ADMIN" || user?.role === "MANAGER",
    staleTime: 60_000,
  });

  const add = useMutation({
    mutationFn: (userId: string) => addMember(eid, userId),
    onSuccess: () => {
      toast.success("Member added");
      setMemberId("");
      void queryClient.invalidateQueries({ queryKey: queryKeys.engagement(eid) });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => removeMember(eid, userId),
    onSuccess: () => {
      toast.success("Member removed");
      void queryClient.invalidateQueries({ queryKey: queryKeys.engagement(eid) });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (engagement.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (engagement.isError) {
    return <ErrorState message={errorMessage(engagement.error)} onRetry={() => void engagement.refetch()} />;
  }

  const detail = engagement.data;
  const runOptions = (datasets.data ?? [])
    .map((dataset) => dataset.latestRun)
    .filter(
      (run): run is { id: string; status: "COMPLETED"; finishedAt: string | null } =>
        run !== null && run.status === "COMPLETED",
    );

  const noRun = dashboard.isError && dashboard.error instanceof ApiError && dashboard.error.status === 404;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement overview"
        title={detail.clientName}
        description={
          <span>
            {detail.title} · {formatDate(detail.periodStart)} – {formatDate(detail.periodEnd)} ·{" "}
            {formatNumber(detail.caseCount)} cases
          </span>
        }
        actions={
          canSeeDatasets ? (
            <RoleGate allow={["ADMIN", "MANAGER", "ANALYST"]}>
              <Button asChild variant="outline" size="sm">
                <Link to={`/engagements/${eid}/datasets/new`}>
                  <Database className="size-4" aria-hidden />
                  Upload dataset
                </Link>
              </Button>
            </RoleGate>
          ) : null
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {canSeeDatasets ? <TabsTrigger value="datasets">Datasets</TabsTrigger> : null}
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 pt-4">
          {runOptions.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <label htmlFor="run-select" className="eyebrow">
                Analysis run
              </label>
              <Select
                value={runId ?? runOptions[0]?.id}
                onValueChange={(value) => {
                  const next = new URLSearchParams(params);
                  next.set("run", value);
                  setParams(next, { replace: true });
                }}
              >
                <SelectTrigger id="run-select" className="w-64">
                  <SelectValue placeholder="Latest run" />
                </SelectTrigger>
                <SelectContent>
                  {runOptions.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {run.id.slice(0, 10)} · {run.finishedAt ? formatDate(run.finishedAt) : "completed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {dashboard.isPending ? (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          ) : noRun ? (
            <EmptyState
              title="No completed analysis yet"
              description="Upload a dataset, validate it and start an analysis to see the risk overview."
              icon={<FileWarning className="size-8" />}
              action={
                canSeeDatasets ? (
                  <Button asChild size="sm">
                    <Link to={`/engagements/${eid}/datasets/new`}>Upload a dataset</Link>
                  </Button>
                ) : null
              }
            />
          ) : dashboard.isError ? (
            <ErrorState message={errorMessage(dashboard.error)} onRetry={() => void dashboard.refetch()} />
          ) : dashboard.data ? (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {SEVERITIES.map((severity) => (
                  <KpiCard
                    key={severity}
                    label={`${SEVERITY_LABEL[severity]} cases`}
                    value={formatNumber(dashboard.data.kpis.casesBySeverity[severity])}
                    tone={SEVERITY_TONE[severity]}
                    icon={<ShieldAlert className="size-4" />}
                  />
                ))}
                <KpiCard
                  label="Total exposure"
                  value={formatMoney(dashboard.data.kpis.totalExposure)}
                  hint={`${formatMoney(dashboard.data.kpis.confirmedExposure)} in confirmed cases`}
                  icon={<TrendingUp className="size-4" />}
                />
                <KpiCard
                  label="Flagged invoices"
                  value={`${formatNumber(dashboard.data.kpis.flaggedInvoices)} of ${formatNumber(dashboard.data.kpis.populationInvoices)}`}
                  hint={`${formatPercent(dashboard.data.kpis.flaggedPct)} of the population`}
                  icon={<AlertTriangle className="size-4" />}
                />
                <KpiCard
                  label="Hours saved (est.)"
                  value={formatNumber(dashboard.data.kpis.estimatedHoursSaved)}
                  hint="Estimated, not measured"
                  tooltip="Formula: 2 minutes of manual review per flagged invoice, plus 30 minutes per case, divided by 60."
                  icon={<Clock className="size-4" />}
                />
                <KpiCard
                  label="Open cases"
                  value={formatNumber(dashboard.data.kpis.openCases)}
                  hint={`${formatNumber(dashboard.data.kpis.dismissedCount)} dismissed`}
                  icon={<ShieldAlert className="size-4" />}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <RiskByMonthChart rows={dashboard.data.riskByMonth} />
                <TopVendorsChart rows={dashboard.data.topVendors} />
                <RuleBreakdownChart rows={dashboard.data.ruleBreakdown} />
                <section className="rounded-lg border border-border bg-card p-4 shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Recent cases</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">Highest priority first.</p>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                      <Link to={`/engagements/${eid}/cases`}>Open case queue</Link>
                    </Button>
                  </div>
                  <div className="mt-3">
                    <CaseTable rows={dashboard.data.recentCases} />
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </TabsContent>

        {canSeeDatasets ? (
          <TabsContent value="datasets" className="space-y-3 pt-4">
            <div className="flex justify-end">
              <RoleGate allow={["ADMIN", "MANAGER", "ANALYST"]}>
                <Button asChild size="sm">
                  <Link to={`/engagements/${eid}/datasets/new`}>New dataset</Link>
                </Button>
              </RoleGate>
            </div>
            {datasets.isPending ? (
              <Skeleton className="h-32 w-full" />
            ) : datasets.isError ? (
              <ErrorState message={errorMessage(datasets.error)} onRetry={() => void datasets.refetch()} />
            ) : datasets.data.length === 0 ? (
              <EmptyState title="No datasets yet" description="Upload the six files to start a review." />
            ) : (
              <DatasetTable rows={datasets.data} />
            )}
          </TabsContent>
        ) : null}

        <TabsContent value="cases" className="space-y-3 pt-4">
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <Link to={`/engagements/${eid}/cases`}>Open full case queue</Link>
            </Button>
          </div>
          {cases.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : cases.isError ? (
            <ErrorState message={errorMessage(cases.error)} onRetry={() => void cases.refetch()} />
          ) : cases.data.rows.length === 0 ? (
            <EmptyState title="No cases for this engagement" description="Run an analysis to generate cases." />
          ) : (
            <CaseTable rows={cases.data.rows} />
          )}
        </TabsContent>

        <TabsContent value="members" className="space-y-4 pt-4">
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {detail.members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[0.6875rem] font-semibold text-primary ring-1 ring-inset ring-primary/15"
                    aria-hidden
                  >
                    {member.name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("")}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.email} · {ROLE_LABEL[member.role]}
                    </p>
                  </div>
                </div>
                <RoleGate allow={["ADMIN", "MANAGER"]}>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={remove.isPending || detail.members.length <= 1}
                    onClick={() => remove.mutate(member.id)}
                  >
                    Remove
                  </Button>
                </RoleGate>
              </li>
            ))}
          </ul>

          <RoleGate allow={["ADMIN", "MANAGER"]}>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <label htmlFor="member-select" className="text-sm font-medium">
                  Add a member
                </label>
                <Select value={memberId} onValueChange={setMemberId}>
                  <SelectTrigger id="member-select" className="w-64">
                    <SelectValue placeholder="Choose a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {(directory.data ?? [])
                      .filter((candidate) => !detail.members.some((member) => member.id === candidate.id))
                      .map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.name} · {ROLE_LABEL[candidate.role]}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button disabled={!memberId || add.isPending} onClick={() => add.mutate(memberId)}>
                Add member
              </Button>
            </div>
          </RoleGate>
        </TabsContent>
      </Tabs>
    </div>
  );
};
