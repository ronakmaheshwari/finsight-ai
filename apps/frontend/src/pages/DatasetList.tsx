import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@repo/ui/button";
import { Skeleton } from "@repo/ui/skeleton";
import { toast } from "sonner";
import { listDatasets } from "@/api/engagements";
import { deleteDataset } from "@/api/datasets";
import { errorMessage } from "@/api/client";
import { RoleGate } from "@/auth/RoleGate";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DatasetTable } from "@/components/DatasetTable";
import { EmptyState, ErrorState, PageHeader } from "@/components/States";
import { queryKeys } from "@/lib/queryKeys";

export const DatasetList = () => {
  const { eid = "" } = useParams();
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const datasets = useQuery({
    queryKey: queryKeys.datasets(eid),
    queryFn: () => listDatasets(eid),
    staleTime: 30_000,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDataset(id),
    onSuccess: () => {
      toast.success("Dataset deleted");
      setPendingDelete(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.datasets(eid) });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data intake"
        title="Datasets"
        description="Upload the six files, validate them, then start an analysis."
        actions={
          <RoleGate allow={["ADMIN", "MANAGER", "ANALYST"]}>
            <Button asChild>
              <Link to={`/engagements/${eid}/datasets/new`}>
                <Plus className="size-4" aria-hidden />
                New dataset
              </Link>
            </Button>
          </RoleGate>
        }
      />

      {datasets.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : datasets.isError ? (
        <ErrorState message={errorMessage(datasets.error)} onRetry={() => void datasets.refetch()} />
      ) : datasets.data.length === 0 ? (
        <EmptyState
          title="No datasets yet"
          description="A dataset groups the six upload files for one review period."
          action={
            <RoleGate allow={["ADMIN", "MANAGER", "ANALYST"]}>
              <Button asChild size="sm">
                <Link to={`/engagements/${eid}/datasets/new`}>Create the first dataset</Link>
              </Button>
            </RoleGate>
          }
        />
      ) : (
        <>
          <DatasetTable rows={datasets.data} />
          <RoleGate allow={["ADMIN", "MANAGER"]}>
            <div className="rounded-lg border border-destructive/25 bg-destructive/[0.03] p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <Trash2 className="size-4" aria-hidden />
                Danger zone
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Deleting a dataset removes its rows, runs, cases and signals. This cannot be undone.
              </p>
              <ul className="mt-3 divide-y divide-border/70 border-t border-border/70">
                {datasets.data.map((dataset) => (
                  <li key={dataset.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="font-medium">{dataset.name}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setPendingDelete({ id: dataset.id, name: dataset.name })}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </RoleGate>
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this dataset?"
        description="This removes every row, run, case and signal for the dataset. It cannot be undone."
        confirmLabel="Delete dataset"
        requireText={pendingDelete?.name}
        pending={remove.isPending}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id);
        }}
      />
    </div>
  );
};
