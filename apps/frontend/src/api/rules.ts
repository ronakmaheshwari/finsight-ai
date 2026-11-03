import type { RuleKey, RuleView } from "@repo/shared";

import { api } from "./client";

export const listRules = (): Promise<RuleView[]> => api.get<RuleView[]>("/rules");

export const updateRule = (
  ruleKey: RuleKey,
  body: { enabled?: boolean; weight?: number; params?: Record<string, number> },
): Promise<RuleView> => api.patch<RuleView>(`/rules/${ruleKey}`, body);

export const resetRule = (ruleKey?: RuleKey): Promise<{ removed: number }> =>
  api.post<{ removed: number }>("/rules/reset", ruleKey ? { ruleKey } : {});
