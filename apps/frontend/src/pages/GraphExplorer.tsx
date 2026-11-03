import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { EntityType, GraphNode } from "@repo/shared";
import { ENTITY_TYPES } from "@repo/shared";

import { Button } from "@repo/ui/button";
import { Checkbox } from "@repo/ui/checkbox";
import { Label } from "@repo/ui/label";
import { Skeleton } from "@repo/ui/skeleton";
import { getRun, getRunGraph } from "@/api/runs";
import { errorMessage } from "@/api/client";
import { GraphView } from "@/components/GraphView";
import { ErrorState, PageHeader } from "@/components/States";
import { queryKeys } from "@/lib/queryKeys";
import { ENTITY_LABEL } from "@/lib/severity";

const ENTITY_PARAM: Record<string, string> = {
  VENDOR: "vendors",
  EMPLOYEE: "employees",
  BANK_ACCOUNT: "bank-accounts",
  PO: "purchase-orders",
  INVOICE: "invoices",
  TRANSACTION: "transactions",
};

export const GraphExplorer = () => {
  const { id = "" } = useParams();
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hidden, setHidden] = useState<EntityType[]>([]);

  const run = useQuery({ queryKey: queryKeys.run(id), queryFn: () => getRun(id) });
  const graph = useQuery({ queryKey: queryKeys.runGraph(id), queryFn: () => getRunGraph(id) });

  const filtered = useMemo(() => {
    if (!graph.data) return { nodes: [], edges: [], truncated: false };
    const nodes = graph.data.nodes.filter((node) => !hidden.includes(node.type));
    const visible = new Set(nodes.map((node) => node.id));
    const edges = graph.data.edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target));
    return { nodes, edges, truncated: graph.data.truncated };
  }, [graph.data, hidden]);

  if (graph.isPending || run.isPending) return <Skeleton className="h-96 w-full" />;
  if (graph.isError) return <ErrorState message={errorMessage(graph.error)} onRetry={() => void graph.refetch()} />;
  if (run.isError) return <ErrorState message={errorMessage(run.error)} onRetry={() => void run.refetch()} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Relationship explorer"
        description="Entities linked by the signals in this run. Flagged nodes belong to at least one case."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to={`/runs/${id}`}>
              <ArrowLeft className="size-4" aria-hidden />
              Back to run
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entity types</span>
        {ENTITY_TYPES.map((type) => (
          <div key={type} className="flex items-center gap-2">
            <Checkbox
              id={`entity-${type}`}
              checked={!hidden.includes(type)}
              onCheckedChange={(checked) =>
                setHidden((current) =>
                  checked ? current.filter((entry) => entry !== type) : [...current, type],
                )
              }
            />
            <Label htmlFor={`entity-${type}`} className="text-sm font-normal">
              {ENTITY_LABEL[type]}
            </Label>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <GraphView graph={filtered} onSelect={setSelected} selectedId={selected?.id} height={620} />

        <aside className="space-y-3">
          {selected ? (
            <div className="space-y-2 rounded-lg border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {ENTITY_LABEL[selected.type] ?? selected.type}
              </p>
              <p className="font-medium">{selected.label}</p>
              <p className="font-mono text-xs text-muted-foreground">{selected.id}</p>
              {selected.flagged ? (
                <p className="text-xs font-medium text-red-700 dark:text-red-300">
                  Flagged: this entity appears in at least one case.
                </p>
              ) : null}
              <div className="flex flex-col gap-2 pt-1">
                <Button asChild size="sm" variant="outline">
                  <Link
                    to={`/datasets/${run.data.dataset.id}?entity=${ENTITY_PARAM[selected.type] ?? "invoices"}&q=${encodeURIComponent(selected.label)}`}
                  >
                    Open in data browser
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/engagements/${run.data.dataset.engagementId}/cases`}>Open case queue</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground">
              Select a node to see its details.
            </div>
          )}

          <div className="rounded-lg border bg-card p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{filtered.nodes.length} nodes</p>
            <p>{filtered.edges.length} links shown</p>
            {filtered.truncated ? <p className="mt-2">The graph is truncated to the highest-priority cases.</p> : null}
          </div>
        </aside>
      </div>
    </div>
  );
};
