import type { GraphPayload, RunRow, RunStatsView, RunSummaryView, SignalRow } from "@repo/shared";

import { api } from "./client";

export const listRuns = (datasetId: string): Promise<RunRow[]> =>
  api.get<RunRow[]>(`/datasets/${datasetId}/runs`);

export const getRun = (id: string): Promise<RunSummaryView> => api.get<RunSummaryView>(`/runs/${id}`);

export const startRun = (datasetId: string): Promise<{ id: string; status: string }> =>
  api.post<{ id: string; status: string }>(`/datasets/${datasetId}/runs`, {});

export const listSignals = (runId: string, query: Record<string, unknown>) =>
  api.page<SignalRow>(`/runs/${runId}/signals`, query);

export const getRunGraph = (runId: string, caseId?: string): Promise<GraphPayload> =>
  api.get<GraphPayload>(`/runs/${runId}/graph`, caseId ? { caseId } : undefined);

export const getRunStats = (runId: string): Promise<RunStatsView> => api.get<RunStatsView>(`/runs/${runId}/stats`);
