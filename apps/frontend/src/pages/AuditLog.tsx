import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Skeleton } from "@repo/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { listAuditLogs } from "@/api/audit";
import { listDirectory } from "@/api/users";
import { errorMessage } from "@/api/client";
import { Pagination } from "@/components/Pagination";
import { EmptyState, ErrorState, PageHeader } from "@/components/States";
import { queryKeys } from "@/lib/queryKeys";
import { formatDateTime } from "@/lib/format";

/** Mirrors the server-side audit action names (§Appendix D). */
const ACTIONS: { value: string; label: string }[] = [
  { value: "AUTH_LOGIN", label: "Login" },
  { value: "USER_CREATED", label: "User created" },
  { value: "USER_ROLE_CHANGED", label: "User role changed" },
  { value: "ENGAGEMENT_CREATED", label: "Engagement created" },
  { value: "DATASET_CREATED", label: "Dataset created" },
  { value: "DATASET_UPLOADED", label: "Dataset uploaded" },
  { value: "DATASET_VALIDATED", label: "Dataset validated" },
  { value: "DATASET_DELETED", label: "Dataset deleted" },
  { value: "RUN_QUEUED", label: "Run queued" },
  { value: "RUN_COMPLETED", label: "Run completed" },
  { value: "RUN_FAILED", label: "Run failed" },
  { value: "CASE_STATUS_CHANGED", label: "Case status changed" },
  { value: "CASE_ASSIGNED", label: "Case assigned" },
  { value: "CASE_DECIDED", label: "Case decided" },
  { value: "CASE_NOTE_ADDED", label: "Case note added" },
  { value: "AI_INVESTIGATION_REQUESTED", label: "AI investigation requested" },
  { value: "AI_INVESTIGATION_GENERATED", label: "AI investigation generated" },
  { value: "AI_INVESTIGATION_REVIEWED", label: "AI investigation reviewed" },
  { value: "RULE_UPDATED", label: "Rule updated" },
  { value: "EXPORT_GENERATED", label: "Export generated" },
];

const ENTITY_TYPES = [
  "User",
  "Engagement",
  "Dataset",
  "AnalysisRun",
  "Case",
  "RuleConfig",
  "AiInvestigation",
  "Export",
  "Auth",
];

const startOfDay = (date: string): string | undefined =>
  date ? new Date(`${date}T00:00:00.000Z`).toISOString() : undefined;

const endOfDay = (date: string): string | undefined =>
  date ? new Date(`${date}T23:59:59.999Z`).toISOString() : undefined;

export const AuditLog = () => {
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState("ALL");
  const [action, setAction] = useState("ALL");
  const [entityType, setEntityType] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = {
    page,
    pageSize: 25,
    ...(userId === "ALL" ? {} : { userId }),
    ...(action === "ALL" ? {} : { action }),
    ...(entityType === "ALL" ? {} : { entityType }),
    ...(from ? { from: startOfDay(from) } : {}),
    ...(to ? { to: endOfDay(to) } : {}),
  };

  const logs = useQuery({
    queryKey: queryKeys.audit(query),
    queryFn: () => listAuditLogs(query),
    staleTime: 15_000,
  });

  const directory = useQuery({ queryKey: queryKeys.directory, queryFn: listDirectory, staleTime: 60_000 });

  const reset = () => {
    setUserId("ALL");
    setAction("ALL");
    setEntityType("ALL");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const filtered = userId !== "ALL" || action !== "ALL" || entityType !== "ALL" || from !== "" || to !== "";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description="Every state-changing action in this organisation, newest first. Metadata never contains row contents, tokens or secrets."
      />

      <section className="space-y-3 rounded-lg border bg-card p-4" aria-label="Audit filters">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1">
            <Label htmlFor="audit-user" className="text-xs uppercase tracking-wide text-muted-foreground">
              User
            </Label>
            <Select
              value={userId}
              onValueChange={(value) => {
                setPage(1);
                setUserId(value);
              }}
            >
              <SelectTrigger id="audit-user" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Anyone</SelectItem>
                {(directory.data ?? []).map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="audit-action" className="text-xs uppercase tracking-wide text-muted-foreground">
              Action
            </Label>
            <Select
              value={action}
              onValueChange={(value) => {
                setPage(1);
                setAction(value);
              }}
            >
              <SelectTrigger id="audit-action" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All actions</SelectItem>
                {ACTIONS.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="audit-entity" className="text-xs uppercase tracking-wide text-muted-foreground">
              Entity
            </Label>
            <Select
              value={entityType}
              onValueChange={(value) => {
                setPage(1);
                setEntityType(value);
              }}
            >
              <SelectTrigger id="audit-entity" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All entities</SelectItem>
                {ENTITY_TYPES.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="audit-from" className="text-xs uppercase tracking-wide text-muted-foreground">
              From
            </Label>
            <Input
              id="audit-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => {
                setPage(1);
                setFrom(event.target.value);
              }}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="audit-to" className="text-xs uppercase tracking-wide text-muted-foreground">
              To
            </Label>
            <Input
              id="audit-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                setPage(1);
                setTo(event.target.value);
              }}
            />
          </div>
        </div>

        {filtered ? (
          <Button size="sm" variant="ghost" onClick={reset}>
            Clear filters
          </Button>
        ) : null}
      </section>

      {logs.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : logs.isError ? (
        <ErrorState message={errorMessage(logs.error)} onRetry={() => void logs.refetch()} />
      ) : logs.data.rows.length === 0 ? (
        <EmptyState
          title="No audit entries"
          description={filtered ? "No entry matches these filters." : "Nothing has been recorded yet."}
          icon={<ScrollText className="size-8" />}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <span className="sr-only">Expand</span>
                  </TableHead>
                  <TableHead className="w-44">When</TableHead>
                  <TableHead className="w-40">User</TableHead>
                  <TableHead className="w-52">Action</TableHead>
                  <TableHead className="w-32">Entity</TableHead>
                  <TableHead>Entity id</TableHead>
                  <TableHead className="w-32">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data.rows.map((row) => {
                  const isOpen = expanded === row.id;
                  const label = ACTIONS.find((entry) => entry.value === row.action)?.label ?? row.action;
                  return (
                    <Fragment key={row.id}>
                      <TableRow>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? "Hide" : "Show"} metadata for ${label}`}
                            onClick={() => setExpanded(isOpen ? null : row.id)}
                          >
                            {isOpen ? (
                              <ChevronDown className="size-4" aria-hidden />
                            ) : (
                              <ChevronRight className="size-4" aria-hidden />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDateTime(row.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm">{row.user?.name ?? "System"}</TableCell>
                        <TableCell className="text-sm">
                          <span className="font-mono text-xs">{row.action}</span>
                          <span className="ml-1 text-muted-foreground">{label === row.action ? "" : label}</span>
                        </TableCell>
                        <TableCell className="text-sm">{row.entityType}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {row.entityId ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{row.ip ?? "—"}</TableCell>
                      </TableRow>
                      {isOpen ? (
                        <TableRow key={`${row.id}-meta`}>
                          <TableCell colSpan={7} className="bg-muted/40">
                            {row.meta ? (
                              <pre className="max-h-64 overflow-auto text-xs">
                                {JSON.stringify(row.meta, null, 2)}
                              </pre>
                            ) : (
                              <p className="text-xs text-muted-foreground">No metadata recorded.</p>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={logs.data.meta} onPage={setPage} />
        </>
      )}
    </div>
  );
};
