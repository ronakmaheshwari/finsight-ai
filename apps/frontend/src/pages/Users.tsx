import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { createUserSchema, ROLES } from "@repo/shared";
import type { Role, UserRow } from "@repo/shared";
import type { z } from "zod";

import { Button } from "@repo/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Skeleton } from "@repo/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { toast } from "sonner";
import { createUser, listUsers, updateUser } from "@/api/users";
import { errorMessage } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { Pagination } from "@/components/Pagination";
import { EmptyState, ErrorState, PageHeader, Spinner } from "@/components/States";
import { queryKeys } from "@/lib/queryKeys";
import { formatDate } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/severity";

type CreateValues = z.infer<typeof createUserSchema>;

export const Users = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "ALL">("ALL");
  const [open, setOpen] = useState(false);

  const query = {
    page,
    pageSize: 25,
    ...(q ? { q } : {}),
    ...(role === "ALL" ? {} : { role }),
  };

  const users = useQuery({
    queryKey: queryKeys.users(query),
    queryFn: () => listUsers(query),
    staleTime: 30_000,
  });

  const form = useForm<CreateValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", role: "ANALYST", password: "" },
  });
  // `useWatch` keeps the render subscribed without calling `form.watch()`.
  const selectedRole = useWatch({ control: form.control, name: "role" });

  const create = useMutation({
    mutationFn: (values: CreateValues) => createUser(values),
    onSuccess: (created) => {
      toast.success(`${created.name} created`);
      setOpen(false);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role?: Role; isActive?: boolean } }) =>
      updateUser(id, body),
    onSuccess: (updated) => {
      toast.success(`${updated.name} updated`);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.directory });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const changeRole = (row: UserRow, nextRole: Role) => {
    if (row.role === nextRole) return;
    update.mutate({ id: row.id, body: { role: nextRole } });
  };

  const toggleActive = (row: UserRow) => {
    update.mutate({ id: row.id, body: { isActive: !row.isActive } });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Accounts in this organisation. Roles decide what each person can see and change."
        actions={
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="size-4" aria-hidden />
            New user
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setQ(search.trim());
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="user-search" className="text-xs uppercase tracking-wide text-muted-foreground">
              Search
            </Label>
            <Input
              id="user-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or email"
              className="w-56"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>

        <div className="space-y-1">
          <Label htmlFor="role-filter" className="text-xs uppercase tracking-wide text-muted-foreground">
            Role
          </Label>
          <Select
            value={role}
            onValueChange={(value) => {
              setPage(1);
              setRole(value as Role | "ALL");
            }}
          >
            <SelectTrigger id="role-filter" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All roles</SelectItem>
              {ROLES.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {ROLE_LABEL[entry]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {q || role !== "ALL" ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch("");
              setQ("");
              setRole("ALL");
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {users.isPending ? (
        <Skeleton className="h-56 w-full" />
      ) : users.isError ? (
        <ErrorState message={errorMessage(users.error)} onRetry={() => void users.refetch()} />
      ) : users.data.rows.length === 0 ? (
        <EmptyState title="No users match" description="Adjust the search or role filter." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-44">Role</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-36">Created</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.rows.map((row) => {
                  const isSelf = row.id === user?.id;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.name}
                        {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.email}</TableCell>
                      <TableCell>
                        <Select
                          value={row.role}
                          disabled={isSelf || update.isPending}
                          onValueChange={(value) => changeRole(row, value as Role)}
                        >
                          <SelectTrigger
                            aria-label={`Role for ${row.name}`}
                            className="w-40"
                            title={isSelf ? "You cannot change your own role" : undefined}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((entry) => (
                              <SelectItem key={entry} value={entry}>
                                {ROLE_LABEL[entry]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            row.isActive
                              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                              : "inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }
                        >
                          {row.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isSelf || update.isPending}
                          title={isSelf ? "You cannot deactivate yourself" : undefined}
                          onClick={() => toggleActive(row)}
                        >
                          {row.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={users.data.meta} onPage={setPage} />
        </>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) form.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New user</DialogTitle>
            <DialogDescription>
              The password is shared with the user out of band. It is never shown again after creation.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={form.handleSubmit((values) => create.mutate(values))} noValidate>
            <div className="space-y-2">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                autoComplete="off"
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register("name")}
              />
              {form.formState.errors.name ? (
                <p role="alert" className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                autoComplete="off"
                aria-invalid={Boolean(form.formState.errors.email)}
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p role="alert" className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-role">Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(value) => form.setValue("role", value as Role, { shouldValidate: true })}
              >
                <SelectTrigger id="new-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {ROLE_LABEL[entry]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Temporary password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.password)}
                {...form.register("password")}
              />
              <p className="text-xs text-muted-foreground">At least 10 characters.</p>
              {form.formState.errors.password ? (
                <p role="alert" className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? <Spinner label="Creating…" /> : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
