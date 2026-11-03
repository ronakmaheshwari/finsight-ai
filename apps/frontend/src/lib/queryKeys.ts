/** Central query keys (§11.6). */
export const queryKeys = {
  me: ["me"] as const,
  engagements: ["engagements"] as const,
  engagement: (id: string) => ["engagement", id] as const,
  datasets: (engagementId: string) => ["datasets", engagementId] as const,
  dataset: (id: string) => ["dataset", id] as const,
  dataRows: (id: string, entity: string, params: Record<string, unknown>) =>
    ["dataRows", id, entity, params] as const,
  runs: (datasetId: string) => ["runs", datasetId] as const,
  run: (id: string) => ["run", id] as const,
  runGraph: (id: string, caseId?: string) => ["runGraph", id, caseId ?? null] as const,
  runStats: (id: string) => ["runStats", id] as const,
  signals: (runId: string, params: Record<string, unknown>) => ["signals", runId, params] as const,
  cases: (params: Record<string, unknown>) => ["cases", params] as const,
  case: (id: string) => ["case", id] as const,
  investigation: (caseId: string) => ["investigation", caseId] as const,
  dashboard: (engagementId: string, runId?: string) => ["dashboard", engagementId, runId ?? "latest"] as const,
  rules: ["rules"] as const,
  users: (params: Record<string, unknown>) => ["users", params] as const,
  directory: ["directory"] as const,
  audit: (params: Record<string, unknown>) => ["audit", params] as const,
};
