import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowUpDown, CheckCircle2, FileWarning, Play, ShieldCheck } from "lucide-react";
import type { DatasetValidationView } from "@repo/shared";

import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Skeleton } from "@repo/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { toast } from "sonner";
import { DATASET_ENTITIES, browseRows, getDataset, validateDataset, type DatasetEntity } from "@/api/datasets";
import { startRun } from "@/api/runs";
import { errorMessage } from "@/api/client";
import { RoleGate } from "@/auth/RoleGate";
import { DatasetStatusBadge, RunStatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";
import { EmptyState, ErrorState, PageHeader, Spinner } from "@/components/States";
import { queryKeys } from "@/lib/queryKeys";
import { formatDate, formatDuration, formatNumber } from "@/lib/format";

const ENTITY_TITLE: Record<DatasetEntity, string> = {
  "bank-accounts": "Bank accounts",
  employees: "Employees",
  vendors: "Vendors",
  "purchase-orders": "Purchase orders",
  invoices: "Invoices",
  transactions: "Transactions",
};

const COLUMN_TITLE: Record<string, string> = {
  ref: "Ref",
  name: "Name",
  department: "Department",
  approvalLimit: "Approval limit",
  bankAccountRef: "Bank account",
  bankName: "Bank",
  holderCount: "Holders",
  taxId: "Tax id",
  status: "Status",
  createdDate: "Created",
  vendorRef: "Vendor",
  invoiceNumber: "Invoice number",
  amount: "Amount",
  invoiceDate: "Invoice date",
  approvedBy: "Approved by",
  poRef: "PO",
  postedAt: "Posted at",
  description: "Description",
};

export const DatasetDetail = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const entity = (params.get("entity") ?? "invoices") as DatasetEntity;
  const page = Number(params.get("page") ?? 1);
  const q = params.get("q") ?? "";
  const sortBy = params.get("sortBy") ?? undefined;
  const sortDir = (params.get("sortDir") ?? "asc") as "asc" | "desc";
  const [search, setSearch] = useState(q);
  const [validation, setValidation] = useState<DatasetValidationView | null>(null);

  const dataset = useQuery({ queryKey: queryKeys.dataset(id), queryFn: () => getDataset(id) });

  const rowsQuery = useMemo(
    () => ({ page, pageSize: 25, q: q || undefined, sortBy, sortDir }),
    [page, q, sortBy, sortDir],
  );

  const rows = useQuery({
    queryKey: queryKeys.dataRows(id, entity, rowsQuery),
    queryFn: () => browseRows(id, entity, rowsQuery),
    staleTime: 30_000,
  });

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const validate = useMutation({
    mutationFn: () => validateDataset(id),
    onSuccess: (result) => {
      setValidation(result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.dataset(id) });
      if (result.status === "VALIDATED") toast.success("Dataset validated");
      else toast.error("Validation found blocking errors");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const run = useMutation({
    mutationFn: () => startRun(id),
    onSuccess: (started) => {
      toast.success("Analysis queued");
      void queryClient.invalidateQueries({ queryKey: queryKeys.dataset(id) });
      navigate(`/runs/${started.id}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (dataset.isPending) return <Skeleton className="h-64 w-full" />;
  if (dataset.isError) return <ErrorState message={errorMessage(dataset.error)} onRetry={() => void dataset.refetch()} />;

  const detail = dataset.data;
  const columns = rows.data?.rows[0] ? Object.keys(rows.data.rows[0]) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dataset"
        title={detail.name}
        description={
          <span>
            <Link to={`/engagements/${detail.engagement.id}`} className="hover:underline">
              {detail.engagement.clientName}
            </Link>{" "}
            · {detail.engagement.title} · created {formatDate(detail.createdAt)}
          </span>
        }
        actions={<DatasetStatusBadge status={detail.status} />}
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {DATASET_ENTITIES.map((name) => (
              <Card key={name} className="py-3">
                <CardContent className="px-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{ENTITY_TITLE[name]}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{formatNumber(detail.rowCounts?.[name] ?? 0)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <RoleGate allow={["ADMIN", "MANAGER", "ANALYST"]}>
              <Button variant="outline" onClick={() => validate.mutate()} disabled={validate.isPending}>
                {validate.isPending ? <Spinner label="Validating…" /> : "Validate"}
              </Button>
              <Button onClick={() => run.mutate()} disabled={detail.status !== "VALIDATED" || run.isPending}>
                {run.isPending ? <Spinner label="Starting…" /> : (
                  <>
                    <Play className="size-4" aria-hidden />
                    Start analysis
                  </>
                )}
              </Button>
            </RoleGate>
          </div>

          {validation ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {validation.status === "VALIDATED" ? (
                    <CheckCircle2 className="size-4 text-positive" aria-hidden />
                  ) : (
                    <FileWarning className="size-4 text-destructive" aria-hidden />
                  )}
                  Validation {validation.status === "VALIDATED" ? "passed" : "failed"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { title: "Errors", issues: validation.errors },
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
              </CardContent>
            </Card>
          ) : detail.validationErrors ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Last stored validation result</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(detail.validationErrors, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="data" className="space-y-3 pt-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-wrap gap-1">
              {DATASET_ENTITIES.map((name) => (
                <Button
                  key={name}
                  size="sm"
                  variant={name === entity ? "default" : "outline"}
                  onClick={() => update({ entity: name, page: null, sortBy: null, q: null })}
                >
                  {ENTITY_TITLE[name]}
                </Button>
              ))}
            </div>
            <form
              className="ml-auto flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                update({ q: search || null, page: null });
              }}
            >
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                aria-label={`Search ${ENTITY_TITLE[entity]}`}
                className="w-56"
              />
              <Button type="submit" size="sm" variant="outline">
                Search
              </Button>
            </form>
          </div>

          {rows.isPending ? (
            <Skeleton className="h-48 w-full" />
          ) : rows.isError ? (
            <ErrorState message={errorMessage(rows.error)} onRetry={() => void rows.refetch()} />
          ) : rows.data.rows.length === 0 ? (
            <EmptyState title="No rows" description="This file was not uploaded or nothing matches the search." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((column) => (
                        <TableHead key={column}>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                            onClick={() =>
                              update({
                                sortBy: column,
                                sortDir: sortBy === column && sortDir === "asc" ? "desc" : "asc",
                                page: null,
                              })
                            }
                          >
                            {COLUMN_TITLE[column] ?? column}
                            <ArrowUpDown className="size-3" aria-hidden />
                          </button>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.data.rows.map((row, index) => (
                      <TableRow key={String(row.id ?? index)}>
                        {columns.map((column) => (
                          <TableCell key={column} className={column === "id" ? "font-mono text-xs" : "text-sm"}>
                            {row[column] === null || row[column] === undefined ? "—" : String(row[column])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination meta={rows.data.meta} onPage={(next) => update({ page: String(next) })} />
            </>
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-3 pt-4">
          {detail.runs.length === 0 ? (
            <EmptyState
              title="No runs yet"
              description="Validate the dataset, then start an analysis."
              action={
                <RoleGate allow={["ADMIN", "MANAGER", "ANALYST"]}>
                  <Button size="sm" onClick={() => run.mutate()} disabled={detail.status !== "VALIDATED"}>
                    <ShieldCheck className="size-4" aria-hidden />
                    Start analysis
                  </Button>
                </RoleGate>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Finished</TableHead>
                    <TableHead>Cases</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.runs.map((entry) => {
                    const summary = entry.summary as { caseCount?: number; durationMs?: number } | null;
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-xs">
                          <Link to={`/runs/${entry.id}`} className="hover:underline">
                            {entry.id}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <RunStatusBadge status={entry.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(entry.createdAt)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(entry.finishedAt)}
                          {summary?.durationMs ? ` · ${formatDuration(summary.durationMs)}` : ""}
                        </TableCell>
                        <TableCell className="tabular-nums">{formatNumber(summary?.caseCount ?? 0)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
