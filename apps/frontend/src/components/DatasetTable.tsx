import { Link } from "react-router-dom";
import type { DatasetRow } from "@repo/shared";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { DatasetStatusBadge, RunStatusBadge } from "./StatusBadge";
import { formatDate } from "@/lib/format";

export const DatasetTable = ({ rows }: { rows: DatasetRow[] }) => (
  <div className="overflow-x-auto rounded-lg border border-border bg-card">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dataset</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Rows</TableHead>
          <TableHead>Latest run</TableHead>
          <TableHead>Uploaded by</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((dataset) => {
          const totalRows = Object.values(dataset.rowCounts ?? {}).reduce((total, value) => total + value, 0);
          return (
            <TableRow key={dataset.id}>
              <TableCell className="font-medium">
                <Link to={`/datasets/${dataset.id}`} className="hover:underline">
                  {dataset.name}
                </Link>
              </TableCell>
              <TableCell>
                <DatasetStatusBadge status={dataset.status} />
              </TableCell>
              <TableCell className="tabular-nums">{totalRows}</TableCell>
              <TableCell>
                {dataset.latestRun ? (
                  <Link to={`/runs/${dataset.latestRun.id}`} className="inline-flex items-center gap-2 hover:underline">
                    <RunStatusBadge status={dataset.latestRun.status} />
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">Not run</span>
                )}
              </TableCell>
              <TableCell className="text-sm">{dataset.uploadedBy.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(dataset.createdAt)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </div>
);
