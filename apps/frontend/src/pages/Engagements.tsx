import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { createEngagementSchema } from "@repo/shared";

import { Button } from "@repo/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Skeleton } from "@repo/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { toast } from "sonner";
import { createEngagement, listEngagements } from "@/api/engagements";
import { errorMessage } from "@/api/client";
import { RoleGate } from "@/auth/RoleGate";
import { EmptyState, ErrorState, PageHeader, Spinner } from "@/components/States";
import { queryKeys } from "@/lib/queryKeys";
import { formatDate, formatNumber } from "@/lib/format";
import { writeLastEngagement } from "@/lib/download";

interface FormState {
  clientName: string;
  title: string;
  periodStart: string;
  periodEnd: string;
}

const EMPTY: FormState = { clientName: "", title: "", periodStart: "", periodEnd: "" };

export const Engagements = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const engagements = useQuery({ queryKey: queryKeys.engagements, queryFn: listEngagements, staleTime: 30_000 });

  const create = useMutation({
    mutationFn: (values: FormState) =>
      createEngagement({
        clientName: values.clientName,
        title: values.title,
        periodStart: new Date(`${values.periodStart}T00:00:00.000Z`).toISOString(),
        periodEnd: new Date(`${values.periodEnd}T00:00:00.000Z`).toISOString(),
      }),
    onSuccess: (engagement) => {
      toast.success("Engagement created");
      writeLastEngagement(engagement.id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.engagements });
      setOpen(false);
      setForm(EMPTY);
      navigate(`/engagements/${engagement.id}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submit = () => {
    const parsed = createEngagementSchema.safeParse({
      clientName: form.clientName,
      title: form.title,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    create.mutate(form);
  };

  const field = (key: keyof FormState, label: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        value={form[key]}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `${key}-error` : undefined}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      />
      {errors[key] ? (
        <p id={`${key}-error`} role="alert" className="text-xs text-destructive">
          {errors[key]}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engagements"
        description="Each engagement holds one client review: its datasets, analysis runs and cases."
        actions={
          <RoleGate allow={["ADMIN", "MANAGER"]}>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" aria-hidden />
              New engagement
            </Button>
          </RoleGate>
        }
      />

      {engagements.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : engagements.isError ? (
        <ErrorState message={errorMessage(engagements.error)} onRetry={() => void engagements.refetch()} />
      ) : engagements.data.length === 0 ? (
        <EmptyState
          title="No engagements yet"
          description={
            <RoleGate
              allow={["ADMIN", "MANAGER"]}
              fallback="Ask a manager to add you to an engagement."
            >
              Create the first engagement to start a review.
            </RoleGate>
          }
          action={
            <RoleGate allow={["ADMIN", "MANAGER"]}>
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="size-4" aria-hidden />
                New engagement
              </Button>
            </RoleGate>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Datasets</TableHead>
                <TableHead className="text-right">Open cases</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {engagements.data.map((engagement) => (
                <TableRow key={engagement.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/engagements/${engagement.id}`}
                      className="hover:underline"
                      onClick={() => writeLastEngagement(engagement.id)}
                    >
                      {engagement.clientName}
                    </Link>
                  </TableCell>
                  <TableCell>{engagement.title}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(engagement.periodStart)} – {formatDate(engagement.periodEnd)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(engagement.datasetCount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(engagement.openCaseCount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(engagement.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New engagement</DialogTitle>
            <DialogDescription>The review period bounds the dataset checks.</DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            {field("clientName", "Client name")}
            {field("title", "Engagement title")}
            <div className="grid gap-4 sm:grid-cols-2">
              {field("periodStart", "Period start", "date")}
              {field("periodEnd", "Period end", "date")}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? <Spinner label="Creating…" /> : "Create engagement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
