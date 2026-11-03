import type { DashboardView } from "@repo/shared";

import { api } from "./client";

export const getDashboard = (engagementId: string, runId?: string): Promise<DashboardView> =>
  api.get<DashboardView>(`/dashboard/${engagementId}`, runId ? { runId } : undefined);
