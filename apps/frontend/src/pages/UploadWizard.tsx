import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Download, FileWarning, Play, ShieldCheck } from "lucide-react";
import type { DatasetValidationView } from "@repo/shared";

import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Skeleton } from "@repo/ui/skeleton";
import { toast } from "sonner";
import { createDataset } from "@/api/engagements";
import {
  DATASET_ENTITIES,
  RowUploadError,
  getDataset,
  uploadRows,
  validateDataset,
  type DatasetEntity,
} from "@/api/datasets";
import { startRun } from "@/api/runs";
import { errorMessage } from "@/api/client";
import { UploadCard, type UploadState } from "@/components/UploadCard";
import { ErrorState, PageHeader, Spinner } from "@/components/States";
import { queryKeys } from "@/lib/queryKeys";
import { downloadFile } from "@/lib/download";

const ENTITY_META: Record<DatasetEntity, { label: string; required: boolean; description: string }> = {
  "bank-accounts": {
    label: "Bank accounts",
    required: false,
    description: "Account numbers are hashed on import. Unlocks shared-account detection.",
  },
  employees: {
    label: "Employees",
    required: false,
    description: "Approval limits and contact details. Unlocks approval-limit and shared-detail checks.",
  },
  vendors: {
    label: "Vendors",
    required: true,
    description: "Vendor master with bank account and creation date.",
  },
  "purchase-orders": {
    label: "Purchase orders",
    required: false,
    description: "Used to compare invoice amounts against approved orders.",
  },
  invoices: {
    label: "Invoices",
    required: true,
    description: "The population every rule runs over.",
  },
  transactions: {
    label: "Transactions",
    required: false,
    description: "Payment dates and amounts. Unlocks weekend and off-hours checks.",
  },
};

/** Four segments: name, upload, validate, run. */
const StepTrail = ({ step }: { step: 1 | 2 | 3 | 4 }) => (
  <div className="flex items-center gap-2" aria-label={`Step ${step} of 4`} role="group">
    {[1, 2, 3, 4].map((index) => (
      <span
        key={index}
        className={`h-1 w-10 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`}
        aria-hidden
      />
    ))}
    <span className="ml-1 text-[0.6875rem] font-medium text-muted-foreground">Step {step} of 4</span>
  </div>
);

export const UploadWizard = () => {
  const { eid = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const datasetId = params.get("dataset");

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [states, setStates] = useState<Partial<Record<DatasetEntity, UploadState>>>({});
  const [skipped, setSkipped] = useState<DatasetEntity[]>([]);
  const [validation, setValidation] = useState<DatasetValidationView | null>(null);

  const dataset = useQuery({
    queryKey: queryKeys.dataset(datasetId ?? ""),
    queryFn: () => getDataset(datasetId ?? ""),
    enabled: Boolean(datasetId),
  });

  const create = useMutation({
    mutationFn: (value: string) => createDataset(eid, value),
    onSuccess: (created) => {
      toast.success("Dataset created");
      void queryClient.invalidateQueries({ queryKey: queryKeys.datasets(eid) });
      const next = new URLSearchParams(params);
      next.set("dataset", created.id);
      setParams(next, { replace: true });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const upload = useMutation({
    mutationFn: ({ entity, file }: { entity: DatasetEntity; file: File }) =>
      uploadRows(datasetId ?? "", entity, file),
    onSuccess: (result, variables) => {
      toast.success(`${result.inserted} row(s) imported`);
      setStates((current) => ({ ...current, [variables.entity]: { kind: "done", inserted: result.inserted } }));
      setValidation(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.dataset(datasetId ?? "") });
    },
    onError: (error, variables) => {
      const rowErrors = error instanceof RowUploadError ? error.errors : [];
      setStates((current) => ({
        ...current,
        [variables.entity]: { kind: "error", message: errorMessage(error), errors: rowErrors },
      }));
      setValidation(null);
      toast.error(errorMessage(error));
    },
  });

  const validate = useMutation({
    mutationFn: () => validateDataset(datasetId ?? ""),
    onSuccess: (result) => {
      setValidation(result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.dataset(datasetId ?? "") });
      if (result.status === "VALIDATED") toast.success("Dataset validated");
      else toast.error("Validation found blocking errors");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const run = useMutation({
    mutationFn: () => startRun(datasetId ?? ""),
    onSuccess: (started) => {
      toast.success("Analysis queued");
      void queryClient.invalidateQueries({ queryKey: queryKeys.runs(datasetId ?? "") });
      navigate(`/runs/${started.id}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rowCounts = dataset.data?.rowCounts ?? {};

  const done = (entity: DatasetEntity): boolean =>
    states[entity]?.kind === "done" || skipped.includes(entity) || (rowCounts[entity] ?? 0) > 0;

  const requiredDone = useMemo(
    () => DATASET_ENTITIES.filter((entity) => ENTITY_META[entity].required).every((entity) => done(entity)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [states, skipped, rowCounts],
  );

  if (!datasetId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="New dataset"
          title="Name the dataset"
          description="A dataset groups the files for one review period. You can upload the files next."
        >
          <StepTrail step={1} />
        </PageHeader>
        <Card className="max-w-xl gap-0 overflow-hidden rounded-xl py-0 shadow-card">
          <CardHeader className="border-b border-border px-5 py-4">
            <CardTitle className="text-base">Dataset name</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim().length === 0) {
                  setNameError("Enter a name");
                  return;
                }
                setNameError(null);
                create.mutate(name.trim());
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="dataset-name">Name</Label>
                <Input
                  id="dataset-name"
                  value={name}
                  placeholder="FY26 P2P ledger"
                  aria-invalid={Boolean(nameError)}
                  onChange={(event) => setName(event.target.value)}
                />
                {nameError ? (
                  <p role="alert" className="text-xs text-destructive">
                    {nameError}
                  </p>
                ) : null}
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? <Spinner label="Creating…" /> : "Create dataset"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (dataset.isPending) return <Skeleton className="h-64 w-full" />;
  if (dataset.isError) return <ErrorState message={errorMessage(dataset.error)} onRetry={() => void dataset.refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Upload"
        title={dataset.data.name}
        description="Upload each file. Vendors and invoices are required; the rest unlock extra checks."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void downloadFile("/datasets/templates/all", "finsight-upload-template.xlsx")}>
              <Download className="size-4" aria-hidden />
              Download full template (.xlsx)
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/datasets/${datasetId}`}>Open dataset</Link>
            </Button>
          </>
        }
      >
        <StepTrail step={2} />
      </PageHeader>

      <div className="space-y-3">
        {DATASET_ENTITIES.map((entity, index) => {
          const meta = ENTITY_META[entity];
          const previous = DATASET_ENTITIES.slice(0, index);
          const enabled = previous.every((previousEntity) => done(previousEntity));
          const state: UploadState =
            states[entity] ??
            ((rowCounts[entity] ?? 0) > 0
              ? { kind: "done", inserted: rowCounts[entity] ?? 0 }
              : skipped.includes(entity)
                ? { kind: "done", inserted: 0 }
                : { kind: "idle" });

          return (
            <UploadCard
              key={entity}
              entity={entity}
              label={meta.label}
              required={meta.required}
              description={meta.description}
              disabled={!enabled || (upload.isPending && upload.variables?.entity !== entity)}
              skippable={!meta.required && !done(entity)}
              state={state}
              onUpload={(file) => upload.mutate({ entity, file })}
              onSkip={() => setSkipped((current) => [...current, entity])}
            />
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 3: validate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cross-file checks look for broken references, dates outside the period and totals that do not reconcile.
          </p>
          <Button onClick={() => validate.mutate()} disabled={!requiredDone || validate.isPending}>
            {validate.isPending ? <Spinner label="Validating…" /> : "Validate dataset"}
          </Button>

          {validation ? (
            <div className="space-y-3">
              <p className={`flex items-center gap-2 text-sm font-medium ${validation.status === "VALIDATED" ? "text-positive" : "text-destructive"}`}>
                {validation.status === "VALIDATED" ? (
                  <CheckCircle2 className="size-4" aria-hidden />
                ) : (
                  <FileWarning className="size-4" aria-hidden />
                )}
                {validation.status === "VALIDATED" ? "Dataset validated" : "Validation failed"}
              </p>

              {[
                { title: "Errors (block the analysis)", issues: validation.errors },
                { title: "Warnings", issues: validation.warnings },
                { title: "Information", issues: validation.info },
              ].map((group) =>
                group.issues.length > 0 ? (
                  <section key={group.title}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {group.issues.map((issue) => (
                        <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
                      ))}
                    </ul>
                  </section>
                ) : null,
              )}

              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Invoices</dt>
                  <dd className="tabular-nums">{validation.stats.invoices}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Vendors</dt>
                  <dd className="tabular-nums">{validation.stats.vendors}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Employees</dt>
                  <dd className="tabular-nums">{validation.stats.employees}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Invoice total</dt>
                  <dd className="tabular-nums">{validation.stats.invoiceTotal}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 4: run the analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The analysis applies the current rule settings to the validated data. It takes a few seconds.
          </p>
          <Button
            onClick={() => run.mutate()}
            disabled={validation?.status !== "VALIDATED" || run.isPending}
          >
            {run.isPending ? <Spinner label="Starting…" /> : (
              <>
                <Play className="size-4" aria-hidden />
                Start analysis
              </>
            )}
          </Button>
          {validation?.status !== "VALIDATED" ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" aria-hidden />
              Validate the dataset to enable the analysis.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
