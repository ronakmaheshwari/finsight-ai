import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Download, ExternalLink, Network, ShieldAlert } from "lucide-react";
import { CASE_STATUSES } from "@repo/shared";
import type { CaseStatus } from "@repo/shared";

import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Skeleton } from "@repo/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { toast } from "sonner";
import { addNote, decideCase, getCase, updateCase } from "@/api/cases";
import { listDirectory } from "@/api/users";
import { errorMessage } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { RoleGate } from "@/auth/RoleGate";
import { AiPanel } from "@/components/AiPanel";
import { DecisionDialog, type Decision } from "@/components/DecisionDialog";
import { GraphView } from "@/components/GraphView";
import { NotesThread } from "@/components/NotesThread";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { ScoreGauge } from "@/components/ScoreGauge";
import { SeverityBadge } from "@/components/SeverityBadge";
import { CaseStatusBadge } from "@/components/StatusBadge";
import { SignalCard } from "@/components/SignalCard";
import { EmptyState, ErrorState, PageHeader } from "@/components/States";
import { queryKeys } from "@/lib/queryKeys";
import { formatDateTime, formatMoney } from "@/lib/format";
import { CASE_STATUS_LABEL, ENTITY_LABEL } from "@/lib/severity";
import { downloadFile } from "@/lib/download";

const ANALYST_STATUSES: CaseStatus[] = ["OPEN", "IN_REVIEW", "ESCALATED"];

export const CaseDetail = () => {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAllSignals, setShowAllSignals] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);

  const riskCase = useQuery({ queryKey: queryKeys.case(id), queryFn: () => getCase(id) });

  const directory = useQuery({
    queryKey: queryKeys.directory,
    queryFn: listDirectory,
    enabled: user?.role !== "VIEWER",
    staleTime: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.case(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cases({}) });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const update = useMutation({
    mutationFn: (body: { status?: CaseStatus; assignedToId?: string | null }) => updateCase(id, body),
    onSuccess: () => {
      toast.success("Case updated");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const decide = useMutation({
    mutationFn: ({ decision: value, reason }: { decision: Decision; reason: string }) =>
      decideCase(id, {
        decision: value,
        reason: reason.length >= 10 ? reason : undefined,
      }),
    onSuccess: () => {
      toast.success("Decision recorded");
      setDecision(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const note = useMutation({
    mutationFn: (body: string) => addNote(id, body),
    onSuccess: () => {
      toast.success("Note added");
      void queryClient.invalidateQueries({ queryKey: queryKeys.case(id) });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const signalIndexById = useMemo(() => {
    const map = new Map<string, number>();
    riskCase.data?.signals.forEach((signal, index) => map.set(signal.id, index + 1));
    return map;
  }, [riskCase.data]);

  if (riskCase.isPending) return <Skeleton className="h-72 w-full" />;
  if (riskCase.isError) return <ErrorState message={errorMessage(riskCase.error)} onRetry={() => void riskCase.refetch()} />;

  const detail = riskCase.data;
  const canWrite = user?.role !== "VIEWER";
  const canDecide = user?.role === "ADMIN" || user?.role === "MANAGER";
  const signals = showAllSignals ? detail.signals : detail.signals.slice(0, 5);

  const onCitation = (signalId: string) => {
    setShowAllSignals(true);
    setHighlighted(signalId);
    window.setTimeout(() => {
      document.getElementById(`signal-${signalId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    window.setTimeout(() => setHighlighted(null), 2500);
  };

  const evidence = (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="font-mono text-sm">{detail.code}</CardTitle>
            <span className="flex items-center gap-2">
              <SeverityBadge severity={detail.severity} />
              <CaseStatusBadge status={detail.status} />
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {ENTITY_LABEL[detail.primaryEntityType] ?? detail.primaryEntityType} · {detail.primaryEntityLabel}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScoreGauge score={detail.riskScore} severity={detail.severity} />
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Score breakdown</h2>
            <ScoreBreakdown lines={detail.scoreBreakdown} />
          </div>
          <div className="rounded border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Exposure</p>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(detail.exposureAmount)}</p>
          </div>
        </CardContent>
      </Card>

      <section aria-label="Signals">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Signals ({detail.signals.length})</h2>
          {detail.signals.length > 5 ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAllSignals((value) => !value)}>
              {showAllSignals ? "Show first 5" : `Show all ${detail.signals.length}`}
            </Button>
          ) : null}
        </div>
        <ol className="space-y-2">
          {signals.map((signal, index) => (
            <SignalCard key={signal.id} signal={signal} index={index} highlighted={highlighted === signal.id} />
          ))}
        </ol>
      </section>
    </div>
  );

  const ai = (
    <AiPanel caseId={id} canWrite={canWrite} signalIndexById={signalIndexById} onCitation={onCitation} />
  );

  const context = (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Network className="size-4" aria-hidden />
            Relationships
          </CardTitle>
        </CardHeader>
        <CardContent>
          {detail.graph ? (
            <GraphView graph={detail.graph} height={320} />
          ) : (
            <EmptyState title="No graph for this case" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Case controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CaseStatusBadge status={detail.status} />
            <span className="text-xs text-muted-foreground">
              Updated {formatDateTime(detail.updatedAt)}
            </span>
          </div>

          {canWrite ? (
            <>
              <div className="space-y-1">
                <label htmlFor="case-status" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Status
                </label>
                <Select
                  value={detail.status}
                  onValueChange={(value) => update.mutate({ status: value as CaseStatus })}
                >
                  <SelectTrigger id="case-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(canDecide ? CASE_STATUSES : ANALYST_STATUSES).map((status) => (
                      <SelectItem key={status} value={status}>
                        {CASE_STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label htmlFor="case-assignee" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Assignee
                </label>
                <Select
                  value={detail.assignedTo?.id ?? "unassigned"}
                  onValueChange={(value) =>
                    update.mutate({ assignedToId: value === "unassigned" ? null : value })
                  }
                >
                  <SelectTrigger id="case-assignee" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {(directory.data ?? []).map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Assigned to {detail.assignedTo?.name ?? "nobody"}.
            </p>
          )}

          {detail.decisionReason || detail.decidedBy ? (
            <div className="rounded border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Decision</p>
              <p className="text-muted-foreground">{detail.decisionReason ?? "No reason recorded."}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {detail.decidedBy?.name ?? "—"} · {formatDateTime(detail.decidedAt)}
              </p>
            </div>
          ) : null}

          <RoleGate allow={["ADMIN", "MANAGER"]}>
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button size="sm" variant="destructive" onClick={() => setDecision("CONFIRMED")}>
                Confirm risk
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDecision("DISMISSED")}>
                Dismiss
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDecision("CLOSED")}>
                Close
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDecision("REOPEN")}>
                Reopen
              </Button>
            </div>
          </RoleGate>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              void downloadFile(`/cases/${id}/export`, `FinSight-${detail.code}.pdf`).catch((error: unknown) =>
                toast.error(errorMessage(error)),
              );
            }}
          >
            <Download className="size-4" aria-hidden />
            Export PDF
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <NotesThread notes={detail.notes} canWrite={canWrite} pending={note.isPending} onAdd={(body) => note.mutate(body)} />
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Case detail"
        title={detail.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ShieldAlert className="size-4" aria-hidden />
            {detail.primaryEntityLabel} · run{" "}
            {canWrite ? (
              <Link to={`/runs/${detail.run.id}`} className="underline-offset-4 hover:underline">
                {detail.run.id.slice(0, 10)}
              </Link>
            ) : (
              <span className="font-mono">{detail.run.id.slice(0, 10)}</span>
            )}{" "}
            · created {formatDateTime(detail.createdAt)}
          </span>
        }
        actions={
          canWrite ? (
            <Button asChild variant="ghost" size="sm">
              <Link to={`/runs/${detail.run.id}/graph`}>
                <ExternalLink className="size-4" aria-hidden />
                Open in explorer
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="hidden gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.95fr)]">
        <div>{evidence}</div>
        <div>{ai}</div>
        <div>{context}</div>
      </div>

      <div className="xl:hidden">
        <Tabs defaultValue="evidence">
          <TabsList>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="context">Context</TabsTrigger>
          </TabsList>
          <TabsContent value="evidence" className="pt-4">
            {evidence}
          </TabsContent>
          <TabsContent value="ai" className="pt-4">
            {ai}
          </TabsContent>
          <TabsContent value="context" className="pt-4">
            {context}
          </TabsContent>
        </Tabs>
      </div>

      <DecisionDialog
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        decision={decision}
        pending={decide.isPending}
        onConfirm={(reason) => {
          if (decision) decide.mutate({ decision, reason });
        }}
      />
    </div>
  );
};
