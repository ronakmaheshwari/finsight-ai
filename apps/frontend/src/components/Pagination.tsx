import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PageMeta } from "@repo/shared";

import { Button } from "@repo/ui/button";

export const Pagination = ({
  meta,
  onPage,
}: {
  meta: PageMeta;
  onPage: (page: number) => void;
}) => {
  if (meta.total === 0) return null;

  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.total, meta.page * meta.pageSize);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 text-sm" aria-label="Pagination">
      <p className="text-muted-foreground tabular-nums">
        {from}–{to} of {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden />
          Previous
        </Button>
        <span className="text-muted-foreground tabular-nums">
          Page {meta.page} of {Math.max(1, meta.totalPages)}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
        >
          Next
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
};
