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
    <div className="h-2 w-14 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className={`h-full ${SEVERITY_BAR[severity]}`} style={{ width: `${Math.max(4, score)}%` }} />
    </div>
    <span className="font-mono text-xs tabular-nums">{score}</span>
  </div>
);

export const CaseTable = ({ rows }: { rows: CaseListRow[] }) => (
  <div className="overflow-x-auto rounded-lg border bg-card">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Code</TableHead>
          <TableHead>Case</TableHead>
          <TableHead className="w-28">Score</TableHead>
          <TableHead className="w-28">Severity</TableHead>
          <TableHead className="w-32 text-right">Exposure</TableHead>
          <TableHead className="w-20 text-right">Signals</TableHead>
          <TableHead className="w-40">Status</TableHead>
          <TableHead className="w-36">Assignee</TableHead>
          <TableHead className="w-40">AI</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">
              <Link className="underline-offset-4 hover:underline" to={`/cases/${row.id}`}>
                {row.code}
              </Link>
            </TableCell>
            <TableCell className="min-w-[220px]">
              <Link to={`/cases/${row.id}`} className="block font-medium hover:underline">
                {row.title}
              </Link>
              <span className="text-xs text-muted-foreground">{row.primaryEntityLabel}</span>
            </TableCell>
            <TableCell>
              <ScoreBar score={row.riskScore} severity={row.severity} />
            </TableCell>
            <TableCell>
              <SeverityBadge severity={row.severity} />
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">{formatMoney(row.exposureAmount)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(row.signalCount)}</TableCell>
            <TableCell>
              <CaseStatusBadge status={row.status} />
            </TableCell>
            <TableCell className="text-sm">{row.assignedTo?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
            <TableCell>
              <AiStatusBadge status={row.aiStatus} reviewStatus={row.aiReviewStatus} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
