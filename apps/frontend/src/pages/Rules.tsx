import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import type { RuleCategory, RuleKey, RuleView } from "@repo/shared";
import { RULE_CATEGORIES, WEIGHT_MAX, WEIGHT_MIN } from "@repo/shared";

import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Skeleton } from "@repo/ui/skeleton";
import { Switch } from "@repo/ui/switch";
import { toast } from "sonner";
import { listRules, resetRule, updateRule } from "@/api/rules";
import { errorMessage } from "@/api/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorState, PageHeader, Spinner } from "@/components/States";
import { queryKeys } from "@/lib/queryKeys";

const CATEGORY_LABEL: Record<RuleCategory, string> = {
  ANOMALY: "Anomaly detection",
  RELATIONSHIP: "Relationship checks",
  CONTROL: "Control checks",
};

const CATEGORY_DESCRIPTION: Record<RuleCategory, string> = {
  ANOMALY: "Statistical and duplicate patterns in the invoice population.",
  RELATIONSHIP: "Shared identifiers that link vendors, employees and accounts.",
  CONTROL: "Approval, purchase-order and payment-timing checks.",
};

interface Draft {
  enabled: boolean;
  weight: string;
  params: Record<string, string>;
}

const toDraft = (rule: RuleView): Draft => ({
  enabled: rule.enabled,
  weight: String(rule.weight),
  params: Object.fromEntries(Object.entries(rule.params).map(([key, param]) => [key, String(param.value)])),
});

const isDirty = (rule: RuleView, draft: Draft): boolean => {
  if (draft.enabled !== rule.enabled) return true;
  if (draft.weight !== String(rule.weight)) return true;
  return Object.entries(draft.params).some(([key, value]) => value !== String(rule.params[key]?.value ?? ""));
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const Rules = () => {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const [resetTarget, setResetTarget] = useState<RuleKey | "ALL" | null>(null);

  const rules = useQuery({ queryKey: queryKeys.rules, queryFn: listRules, staleTime: 30_000 });

  const clearEdit = (ruleKey: string) =>
    setEdits((current) => {
      const next = { ...current };
      delete next[ruleKey];
      return next;
    });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.rules });
  };

  const save = useMutation({
    mutationFn: ({ rule, draft }: { rule: RuleView; draft: Draft }) =>
      updateRule(rule.ruleKey, {
        enabled: draft.enabled,
        weight: clamp(Number(draft.weight), WEIGHT_MIN, WEIGHT_MAX),
        params: Object.fromEntries(
          Object.entries(draft.params).map(([key, value]) => {
            const definition = rule.params[key];
            const parsed = Number(value);
            return [key, definition ? clamp(parsed, definition.min, definition.max) : parsed];
          }),
        ),
      }),
    onSuccess: (updated, variables) => {
      toast.success(`${updated.label} saved`, { description: "Changes apply to the next analysis run." });
      clearEdit(variables.rule.ruleKey);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const reset = useMutation({
    mutationFn: (target: RuleKey | "ALL") => resetRule(target === "ALL" ? undefined : target),
    onSuccess: (result, target) => {
      toast.success(target === "ALL" ? "All rules reset to defaults" : "Rule reset to defaults", {
        description: `${result.removed} override${result.removed === 1 ? "" : "s"} removed. Changes apply to the next analysis run.`,
      });
      setResetTarget(null);
      setEdits({});
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const grouped = useMemo(() => {
    const map = new Map<RuleCategory, RuleView[]>();
    for (const rule of rules.data ?? []) {
      const list = map.get(rule.category) ?? [];
      list.push(rule);
      map.set(rule.category, list);
    }
    return map;
  }, [rules.data]);

  if (rules.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (rules.isError) {
    return <ErrorState message={errorMessage(rules.error)} onRetry={() => void rules.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Rule settings"
        description="Weights and thresholds are organisation-wide. Changes apply to the next analysis run; existing cases are not re-scored."
        actions={
          <Button variant="outline" size="sm" onClick={() => setResetTarget("ALL")}>
            <RotateCcw className="size-4" aria-hidden />
            Reset all rules
          </Button>
        }
      />

      <p className="flex items-start gap-2 rounded-lg border border-low/25 bg-low/10 px-3 py-2 text-xs text-low">
        <SlidersHorizontal className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Disabling a rule stops it raising signals, but the deterministic engine still records it as disabled in the
          run snapshot for auditability.
        </span>
      </p>

      {RULE_CATEGORIES.map((category) => {
        const list = grouped.get(category) ?? [];
        if (list.length === 0) return null;

        return (
          <section key={category} className="space-y-3" aria-label={CATEGORY_LABEL[category]}>
            <div>
              <h2 className="text-sm font-semibold">{CATEGORY_LABEL[category]}</h2>
              <p className="text-xs text-muted-foreground">{CATEGORY_DESCRIPTION[category]}</p>
            </div>

            <div className="space-y-3">
              {list.map((rule) => {
                const baseDraft = toDraft(rule);
                const draft = edits[rule.ruleKey] ?? baseDraft;
                const dirty = isDirty(rule, draft);
                const weightNumber = Number(draft.weight);
                const weightInvalid =
                  !Number.isFinite(weightNumber) || weightNumber < WEIGHT_MIN || weightNumber > WEIGHT_MAX;
                const paramErrors = Object.entries(draft.params).filter(([key, value]) => {
                  const definition = rule.params[key];
                  const parsed = Number(value);
                  return (
                    !definition ||
                    !Number.isFinite(parsed) ||
                    parsed < definition.min ||
                    parsed > definition.max
                  );
                });

                const setDraft = (patch: Partial<Draft>) =>
                  setEdits((current) => ({
                    ...current,
                    [rule.ruleKey]: { ...(current[rule.ruleKey] ?? baseDraft), ...patch },
                  }));

                return (
                  <Card key={rule.ruleKey} className="gap-0 py-4">
                    <CardHeader className="px-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="text-sm">{rule.label}</CardTitle>
                          <CardDescription className="mt-1 text-xs">{rule.description}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`enabled-${rule.ruleKey}`}
                            checked={draft.enabled}
                            onCheckedChange={(checked) => setDraft({ enabled: checked })}
                            aria-label={`Enable ${rule.label}`}
                          />
                          <Label htmlFor={`enabled-${rule.ruleKey}`} className="text-xs font-normal">
                            {draft.enabled ? "Enabled" : "Disabled"}
                          </Label>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 px-4">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-1">
                          <Label htmlFor={`weight-${rule.ruleKey}`} className="text-xs">
                            Weight ({WEIGHT_MIN}–{WEIGHT_MAX})
                          </Label>
                          <Input
                            id={`weight-${rule.ruleKey}`}
                            type="number"
                            min={WEIGHT_MIN}
                            max={WEIGHT_MAX}
                            step={1}
                            value={draft.weight}
                            aria-invalid={weightInvalid}
                            onChange={(event) => setDraft({ weight: event.target.value })}
                          />
                          <p className="text-[11px] text-muted-foreground">Default {rule.defaultWeight}</p>
                        </div>

                        {Object.entries(rule.params).map(([key, definition]) => {
                          const value = draft.params[key] ?? String(definition.value);
                          const parsed = Number(value);
                          const invalid =
                            !Number.isFinite(parsed) || parsed < definition.min || parsed > definition.max;

                          return (
                            <div className="space-y-1" key={key}>
                              <Label htmlFor={`${rule.ruleKey}-${key}`} className="text-xs">
                                {definition.label}
                              </Label>
                              <Input
                                id={`${rule.ruleKey}-${key}`}
                                type="number"
                                min={definition.min}
                                max={definition.max}
                                step={definition.step}
                                value={value}
                                aria-invalid={invalid}
                                onChange={(event) =>
                                  setDraft({ params: { ...draft.params, [key]: event.target.value } })
                                }
                              />
                              <p className="text-[11px] text-muted-foreground">
                                Default {definition.default} · range {definition.min}–{definition.max}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          disabled={!dirty || weightInvalid || paramErrors.length > 0 || save.isPending}
                          onClick={() => save.mutate({ rule, draft })}
                        >
                          {save.isPending && save.variables?.rule.ruleKey === rule.ruleKey ? (
                            <Spinner label="Saving…" />
                          ) : (
                            <>
                              <Save className="size-4" aria-hidden />
                              Save
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!dirty || save.isPending}
                          onClick={() => clearEdit(rule.ruleKey)}
                        >
                          Discard changes
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setResetTarget(rule.ruleKey)}
                          disabled={reset.isPending}
                        >
                          <RotateCcw className="size-4" aria-hidden />
                          Reset to default
                        </Button>
                        {weightInvalid ? (
                          <span role="alert" className="text-xs text-destructive">
                            Weight must be between {WEIGHT_MIN} and {WEIGHT_MAX}.
                          </span>
                        ) : null}
                        {paramErrors.length > 0 ? (
                          <span role="alert" className="text-xs text-destructive">
                            {paramErrors.length} parameter{paramErrors.length === 1 ? "" : "s"} outside the allowed
                            range.
                          </span>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}

      <ConfirmDialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        title={resetTarget === "ALL" ? "Reset every rule?" : "Reset this rule?"}
        description="The stored overrides are deleted and the rule returns to its catalog defaults. This is recorded in the audit log."
        confirmLabel="Reset"
        pending={reset.isPending}
        onConfirm={() => {
          if (resetTarget) reset.mutate(resetTarget);
        }}
      />
    </div>
  );
};
