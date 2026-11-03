import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { Button } from "@repo/ui/button";
import { Skeleton } from "@repo/ui/skeleton";
import { getRun, getRunStats } from "@/api/runs";
import { errorMessage } from "@/api/client";
import {
  AmountHistogramChart,
  BenfordChart,
  MonthlyVolumeChart,
  VendorScatterChart,
} from "@/components/Charts";
import { ErrorState, PageHeader } from "@/components/States";
import { queryKeys } from "@/lib/queryKeys";

export const Analytics = () => {
  const { id = "" } = useParams();

  const run = useQuery({ queryKey: queryKeys.run(id), queryFn: () => getRun(id) });
  const stats = useQuery({
    queryKey: queryKeys.runStats(id),
    queryFn: () => getRunStats(id),
    staleTime: 60_000,
  });

  if (run.isPending || stats.isPending) return <Skeleton className="h-96 w-full" />;
  if (run.isError) return <ErrorState message={errorMessage(run.error)} onRetry={() => void run.refetch()} />;
  if (stats.isError) return <ErrorState message={errorMessage(stats.error)} onRetry={() => void stats.refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        description={
          <span>
            Distribution and pattern tests for {run.data.dataset.name}. These describe the data, not a conclusion.
          </span>
        }
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to={`/runs/${id}`}>
              <ArrowLeft className="size-4" aria-hidden />
              Back to run
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <AmountHistogramChart rows={stats.data.amountHistogram} />
        <BenfordChart benford={stats.data.benford} />
        <MonthlyVolumeChart rows={stats.data.monthlyVolume} />
        <VendorScatterChart rows={stats.data.vendorScatter} />
      </div>

      <p className="text-xs text-muted-foreground">
        Benford's law applies to naturally occurring financial populations. A deviation is a risk indicator that
        requires review, not evidence of wrongdoing.
      </p>
    </div>
  );
};
