import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Pencil, RefreshCw, Sparkles, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import type { AiReviewStatus, InvestigationOutput, InvestigationView } from "@repo/shared";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Skeleton } from "@repo/ui/skeleton";
import { Textarea } from "@repo/ui/textarea";
import { toast } from "sonner";
import {
  getInvestigation,
  requestInvestigation,
  reviewInvestigation,
} from "@/api/cases";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/lib/queryKeys";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErrorState } from "./States";

const REVIEW_LABEL: Record<AiReviewStatus, string> = {
  PENDING: "Awaiting review",
  ACCEPTED: "Accepted by reviewer",
  EDITED: "Edited by reviewer",
  REJECTED: "Rejected by reviewer",
};

const CONFIDENCE_CLASS: Record<InvestigationOutput["confidence"], string> = {
  HIGH: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  MEDIUM: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  LOW: "border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
};

interface EditState {
  summary: string;
  riskNarrative: string;
  findings: string[];
  alternatives: string;
  steps: { step: string; priority: "HIGH" | "MEDIUM" | "LOW" }[];
  documents: string;
  limitations: string;
}

const toEditState = (output: InvestigationOutput): EditState => ({
  summary: output.summary,
  riskNarrative: output.riskNarrative,
  findings: output.keyFindings.map((finding) => finding.finding),
  alternatives: output.alternativeExplanations.join("\n"),
  steps: output.recommendedSteps.map((step) => ({ ...step })),
  documents: output.documentsToRequest.join("\n"),
  limitations: output.limitations,
});

const fromEditState = (base: InvestigationOutput, state: EditState): InvestigationOutput => ({
  ...base,
  summary: state.summary.trim(),
  riskNarrative: state.riskNarrative.trim(),
  keyFindings: base.keyFindings.map((finding, index) => ({
    ...finding,
    finding: state.findings[index]?.trim() || finding.finding,
  })),
  alternativeExplanations: state.alternatives
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean),
  recommendedSteps: state.steps
    .map((step) => ({ step: step.step.trim(), priority: step.priority }))
    .filter((step) => step.step.length > 0),
  documentsToRequest: state.documents
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean),
  limitations: state.limitations.trim(),
});

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
    <div className="mt-1.5 text-sm">{children}</div>
  </section>
);

const priorityClass: Record<string, string> = {
  HIGH: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  MEDIUM: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  LOW: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
};

export const AiPanel = ({
  caseId,
  canWrite,
  signalIndexById,
  onCitation,
}: {
  caseId: string;
  canWrite: boolean;
  signalIndexById: Map<string, number>;
  onCitation: (signalId: string) => void;
}) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

  const investigation = useQuery({
    queryKey: queryKeys.investigation(caseId),
    queryFn: () => getInvestigation(caseId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "QUEUED" || status === "RUNNING" ? 2000 : false;
    },
    staleTime: 0,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.investigation(caseId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.case(caseId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cases({}) });
  };

  const generate = useMutation({
    mutationFn: (regenerate: boolean) => requestInvestigation(caseId, regenerate),
    onSuccess: () => {
      toast.success("Investigation queued");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const review = useMutation({
    mutationFn: (body: { action: "ACCEPT" | "EDIT" | "REJECT"; editedOutput?: InvestigationOutput }) =>
      reviewInvestigation(caseId, body),
    onSuccess: () => {
      toast.success("Review saved");
      setEditing(false);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const data: InvestigationView | undefined = investigation.data;

  const output = data?.output ?? null;

  return (
    <div className="space-y-4">
      <Alert>
        <Sparkles className="size-4" aria-hidden />
        <AlertTitle>AI-assisted, review required</AlertTitle>
        <AlertDescription>
          AI-generated explanation of system-detected risk indicators. It does not determine that any wrongdoing
          occurred and requires professional review. Masked case evidence is sent to an external AI provider.
        </AlertDescription>
      </Alert>

      {investigation.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : investigation.isError ? (
        <ErrorState message={errorMessage(investigation.error)} onRetry={() => void investigation.refetch()} />
      ) : !data ? null : data.notRequested ? (
        canWrite ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              No investigation has been generated for this case yet.
            </p>
            <Button onClick={() => generate.mutate(false)} disabled={generate.isPending}>
              <Sparkles className="size-4" aria-hidden />
              Generate investigation
            </Button>
          </div>
        ) : null
      ) : data.status === "QUEUED" || data.status === "RUNNING" ? (
        <div className="space-y-3" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="size-4 animate-spin" aria-hidden />
            Analysing evidence…
          </p>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : data.status === "FAILED" ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            {data.error ?? "The investigation failed."}
          </p>
          {canWrite ? (
            <Button variant="outline" onClick={() => generate.mutate(true)} disabled={generate.isPending}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : output ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full border px-2 py-0.5 font-medium ${CONFIDENCE_CLASS[output.confidence]}`}>
              {output.confidence.charAt(0) + output.confidence.slice(1).toLowerCase()} confidence
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              {data.reviewStatus === "PENDING" ? (
                <CheckCircle2 className="size-3.5" aria-hidden />
              ) : data.reviewStatus === "REJECTED" ? (
                <XCircle className="size-3.5" aria-hidden />
              ) : (
                <ThumbsUp className="size-3.5" aria-hidden />
              )}
              {REVIEW_LABEL[data.reviewStatus]}
              {data.reviewedBy ? ` · ${data.reviewedBy.name}` : ""}
            </span>
            {data.edited ? (
              <span className="rounded border border-purple-300 bg-purple-50 px-1.5 py-0.5 font-medium text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200">
                Edited
              </span>
            ) : null}
            {data.edited ? (
              <Button variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setShowOriginal((v) => !v)}>
                {showOriginal ? "Hide original" : "View original"}
              </Button>
            ) : null}
          </div>

          {editing && editState ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!output) return;
                review.mutate({ action: "EDIT", editedOutput: fromEditState(output, editState) });
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="ai-summary">Summary</Label>
                <Textarea
                  id="ai-summary"
                  rows={3}
                  value={editState.summary}
                  onChange={(event) => setEditState({ ...editState, summary: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ai-narrative">Risk narrative</Label>
                <Textarea
                  id="ai-narrative"
                  rows={5}
                  value={editState.riskNarrative}
                  onChange={(event) => setEditState({ ...editState, riskNarrative: event.target.value })}
                />
              </div>
              {editState.findings.map((finding, index) => (
                <div className="space-y-1" key={`finding-${index}`}>
                  <Label htmlFor={`ai-finding-${index}`}>Key finding {index + 1}</Label>
                  <Textarea
                    id={`ai-finding-${index}`}
                    rows={2}
                    value={finding}
                    onChange={(event) => {
                      const findings = [...editState.findings];
                      findings[index] = event.target.value;
                      setEditState({ ...editState, findings });
                    }}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label htmlFor="ai-alternatives">Alternative explanations (one per line)</Label>
                <Textarea
                  id="ai-alternatives"
                  rows={3}
                  value={editState.alternatives}
                  onChange={(event) => setEditState({ ...editState, alternatives: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Recommended steps</Label>
                {editState.steps.map((step, index) => (
                  <div className="flex gap-2" key={`step-${index}`}>
                    <Input
                      value={step.step}
                      onChange={(event) => {
                        const steps = [...editState.steps];
                        steps[index] = { ...step, step: event.target.value };
                        setEditState({ ...editState, steps });
                      }}
                    />
                    <Select
                      value={step.priority}
                      onValueChange={(value) => {
                        const steps = [...editState.steps];
                        steps[index] = { ...step, priority: value as "HIGH" | "MEDIUM" | "LOW" };
                        setEditState({ ...editState, steps });
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="LOW">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <Label htmlFor="ai-documents">Documents to request (one per line)</Label>
                <Textarea
                  id="ai-documents"
                  rows={3}
                  value={editState.documents}
                  onChange={(event) => setEditState({ ...editState, documents: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ai-limitations">Limitations</Label>
                <Textarea
                  id="ai-limitations"
                  rows={3}
                  value={editState.limitations}
                  onChange={(event) => setEditState({ ...editState, limitations: event.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={review.isPending}>
                  Save edits
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <Section title="Summary">
                <p>{output.summary}</p>
              </Section>

              <Section title="Risk narrative">
                <p className="whitespace-pre-wrap">{output.riskNarrative}</p>
              </Section>

              <Section title="Key findings">
                <ol className="list-decimal space-y-2 pl-5">
                  {output.keyFindings.map((finding, index) => (
                    <li key={`${finding.finding.slice(0, 24)}-${index}`}>
                      <p>{finding.finding}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {finding.evidenceSignalIds.map((signalId) => (
                          <button
                            key={signalId}
                            type="button"
                            onClick={() => onCitation(signalId)}
                            className="rounded border border-primary/40 bg-primary/5 px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
                          >
                            Signal {signalIndexById.get(signalId) ?? "?"}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section title="Alternative explanations">
                <ul className="list-disc space-y-1 pl-5">
                  {output.alternativeExplanations.map((explanation, index) => (
                    <li key={`${explanation.slice(0, 20)}-${index}`}>{explanation}</li>
                  ))}
                </ul>
              </Section>

              <Section title="Recommended steps">
                <ul className="space-y-1.5">
                  {output.recommendedSteps.map((step, index) => (
                    <li key={`${step.step.slice(0, 20)}-${index}`} className="flex items-start gap-2">
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${priorityClass[step.priority]}`}>
                        {step.priority}
                      </span>
                      <span>{step.step}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              {output.documentsToRequest.length > 0 ? (
                <Section title="Documents to request">
                  <ul className="list-disc space-y-1 pl-5">
                    {output.documentsToRequest.map((document, index) => (
                      <li key={`${document.slice(0, 20)}-${index}`}>{document}</li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              <Section title="Limitations">
                <p className="text-muted-foreground">{output.limitations}</p>
              </Section>
            </>
          )}

          {showOriginal && data.original ? (
            <div className="rounded-lg border border-dashed p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original AI output</p>
              <p className="mt-2 text-sm">{data.original.summary}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{data.original.riskNarrative}</p>
            </div>
          ) : null}

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
            <span>
              Model {data.model ?? "—"} · prompt {data.promptVersion ?? "—"}
            </span>
            <span>{data.createdAt ? new Date(data.createdAt).toLocaleString() : ""}</span>
          </footer>

          {canWrite && !editing ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => review.mutate({ action: "ACCEPT" })} disabled={review.isPending}>
                <ThumbsUp className="size-4" aria-hidden />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditState(toEditState(output));
                  setEditing(true);
                }}
                disabled={review.isPending}
              >
                <Pencil className="size-4" aria-hidden />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRejectOpen(true)}
                disabled={review.isPending}
              >
                <ThumbsDown className="size-4" aria-hidden />
                Reject
              </Button>
              {data.reviewStatus === "REJECTED" ? (
                <Button size="sm" variant="secondary" onClick={() => generate.mutate(true)} disabled={generate.isPending}>
                  <RefreshCw className="size-4" aria-hidden />
                  Regenerate
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this AI investigation?"
        description="The rejection is recorded against your name. You can regenerate a new investigation afterwards."
        confirmLabel="Reject"
        pending={review.isPending}
        onConfirm={() => {
          review.mutate({ action: "REJECT" });
          setRejectOpen(false);
        }}
      />
    </div>
  );
};
