import { useMemo } from "react";
import type { GraphNode, GraphPayload } from "@repo/shared";

import { ENTITY_COLOR, ENTITY_LABEL } from "@/lib/severity";
import { EmptyState } from "./States";

const COLUMN: Record<string, number> = {
  EMPLOYEE: 0,
  BANK_ACCOUNT: 1,
  VENDOR: 2,
  PO: 3,
  INVOICE: 4,
  TRANSACTION: 4,
};

const COLUMN_SPACING = 260;
const ROW_SPACING = 90;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 40;
const MAX_NODES = 400;

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

const layout = (nodes: GraphNode[]): { positioned: PositionedNode[]; width: number; height: number } => {
  const byColumn = new Map<number, GraphNode[]>();

  for (const node of nodes.slice(0, MAX_NODES)) {
    const column = COLUMN[node.type] ?? 2;
    const list = byColumn.get(column) ?? [];
    list.push(node);
    byColumn.set(column, list);
  }

  const positioned: PositionedNode[] = [];
  let tallest = 0;

  for (const [column, list] of byColumn) {
    const sorted = [...list].sort((a, b) => {
      if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
      return a.label.localeCompare(b.label);
    });

    sorted.forEach((node, index) => {
      positioned.push({ ...node, x: column * COLUMN_SPACING + 20, y: index * ROW_SPACING + 20 });
    });

    tallest = Math.max(tallest, sorted.length);
  }

  return {
    positioned,
    width: Math.max(...[...byColumn.keys()].map((column) => column * COLUMN_SPACING + NODE_WIDTH + 40), 320),
    height: Math.max(tallest * ROW_SPACING + 60, 200),
  };
};

export const GraphView = ({
  graph,
  onSelect,
  selectedId,
  height = 460,
}: {
  graph: GraphPayload;
  onSelect?: (node: GraphNode) => void;
  selectedId?: string | null;
  height?: number;
}) => {
  const { positioned, width, height: canvasHeight } = useMemo(() => layout(graph.nodes), [graph.nodes]);
  const byId = useMemo(() => new Map(positioned.map((node) => [node.id, node])), [positioned]);

  if (graph.nodes.length === 0) {
    return <EmptyState title="No relationships to show" description="This case has no linked entities in the graph." />;
  }

  return (
    <div className="space-y-2">
      {graph.truncated ? (
        <p className="rounded border border-medium/30 bg-medium/15 px-3 py-2 text-xs text-medium">
          The graph is truncated: only the highest-priority cases are shown.
        </p>
      ) : null}

      <div className="overflow-auto rounded-lg border border-border bg-card" style={{ maxHeight: height }}>
        <svg
          viewBox={`0 0 ${width} ${canvasHeight}`}
          width={width}
          height={canvasHeight}
          role="img"
          aria-label={`Relationship graph with ${positioned.length} nodes and ${graph.edges.length} links`}
          className="max-w-none"
        >
          {graph.edges.map((edge) => {
            const source = byId.get(edge.source);
            const target = byId.get(edge.target);
            if (!source || !target) return null;
            const x1 = source.x + NODE_WIDTH;
            const y1 = source.y + NODE_HEIGHT / 2;
            const x2 = target.x;
            const y2 = target.y + NODE_HEIGHT / 2;
            const midX = (x1 + x2) / 2;
            return (
              <g key={edge.id}>
                <path
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth="1.5"
                />
                <text
                  x={midX}
                  y={(y1 + y2) / 2 - 3}
                  textAnchor="middle"
                  fontSize="9"
                  className="fill-muted-foreground"
                >
                  {edge.label}
                </text>
              </g>
            );
          })}

          {positioned.map((node) => {
            const selected = node.id === selectedId;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x} ${node.y})`}
                role={onSelect ? "button" : undefined}
                tabIndex={onSelect ? 0 : undefined}
                aria-label={`${ENTITY_LABEL[node.type] ?? node.type} ${node.label}${node.flagged ? ", flagged" : ""}`}
                className={onSelect ? "cursor-pointer" : undefined}
                onClick={() => onSelect?.(node)}
                onKeyDown={(event) => {
                  if (onSelect && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onSelect(node);
                  }
                }}
              >
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx="6"
                  fill="var(--card)"
                  stroke={node.flagged ? "#b91c1c" : (ENTITY_COLOR[node.type] ?? "#64748b")}
                  strokeWidth={selected ? 3 : node.flagged ? 2 : 1.5}
                />
                <rect width="4" height={NODE_HEIGHT} rx="2" fill={ENTITY_COLOR[node.type] ?? "#64748b"} />
                <text x="12" y="16" fontSize="10" className="fill-muted-foreground">
                  {ENTITY_LABEL[node.type] ?? node.type}
                </text>
                <text x="12" y="31" fontSize="11" className="fill-foreground" fontWeight="500">
                  {node.label.length > 26 ? `${node.label.slice(0, 25)}…` : node.label}
                </text>
                {node.flagged ? (
                  <text x={NODE_WIDTH - 8} y="16" textAnchor="end" fontSize="9" fill="#b91c1c" fontWeight="600">
                    flagged
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(ENTITY_LABEL).map(([type, label]) => (
          <li key={type} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: ENTITY_COLOR[type] }}
              aria-hidden
            />
            {label}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full border-2 border-critical" aria-hidden />
          Flagged (red outline)
        </li>
      </ul>
    </div>
  );
};
