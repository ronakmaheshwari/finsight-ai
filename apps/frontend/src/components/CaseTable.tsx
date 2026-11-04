import { Link } from "react-router-dom";
import type { CaseListRow } from "@repo/shared";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/table";
import { SeverityBadge } from "./SeverityBadge";
import { AiStatusBadge, CaseStatusBadge } from "./StatusBadge";
import { formatMoney, formatNumber } from "@/lib/format";
import { SEVERITY_BAR } from "@/lib/severity";

export const ScoreBar = ({ score, severity }: { score: number; severity: CaseListRow["severity"] }) => (
  <div className="flex items-center gap-2">
    <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className={`h-full rounded-full ${SEVERITY_BAR[severity]}`} style={{ width: `${Math.max(4, score)}%` }} />
    </div>
    <span className="text-xs font-medium tabular-nums">{score}</span>
  </div>
);

/**
 * The case title is the only elastic column: everything else is a fixed-width
 * datum so rows line up and the table never collides with the viewport edge.
 * Signal count rides along with the entity name rather than claiming a column.
 */
export const CaseTable = ({ rows }: { rows: CaseListRow[] }) => (
  <div className="overflow-hidden rounded-lg border border-border bg-card">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">Code</TableHead>
          <TableHead>Case</TableHead>
          <TableHead className="w-20">Score</TableHead>
          <TableHead className="w-24">Severity</TableHead>
          <TableHead className="w-24 text-right">Exposure</TableHead>
          <TableHead className="w-24">Status</TableHead>
          <TableHead className="w-28">Assignee</TableHead>
          <TableHead className="w-32">AI</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="data-num text-xs text-muted-foreground">
              <Link className="underline-offset-4 hover:text-foreground hover:underline" to={`/cases/${row.id}`}>
                {row.code}
              </Link>
            </TableCell>
            <TableCell className="whitespace-normal">
              <Link to={`/cases/${row.id}`} title={row.title} className="line-clamp-1 font-medium hover:underline">
                {row.title}
              </Link>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="line-clamp-1">{row.primaryEntityLabel}</span>
                <span aria-hidden>·</span>
                <span className="shrink-0 tabular-nums">
                  {formatNumber(row.signalCount)} signal{row.signalCount === 1 ? "" : "s"}
                </span>
              </span>
            </TableCell>
            <TableCell>
              <ScoreBar score={row.riskScore} severity={row.severity} />
            </TableCell>
            <TableCell>
              <SeverityBadge severity={row.severity} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(row.exposureAmount)}</TableCell>
            <TableCell>
              <CaseStatusBadge status={row.status} />
            </TableCell>
            <TableCell className="max-w-28 truncate text-sm">
              {row.assignedTo?.name ?? <span className="text-muted-foreground">Unassigned</span>}
            </TableCell>
            <TableCell>
              <AiStatusBadge status={row.aiStatus} reviewStatus={row.aiReviewStatus} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
