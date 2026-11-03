import type {
  CaseDetail,
  CaseListRow,
  CaseStatus,
  InvestigationOutput,
  InvestigationView,
  Role,
  Severity,
} from "@repo/shared";

import { api } from "./client";

export interface CaseQuery {
  runId?: string;
  engagementId?: string;
  status?: string;
  severity?: string;
  assignedTo?: string;
  minScore?: number;
  q?: string;
  sortBy?: "priority" | "riskScore" | "exposureAmount" | "createdAt";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export const listCases = (query: CaseQuery) =>
  api.page<CaseListRow>("/cases", query as Record<string, unknown>);

export const getCase = (id: string): Promise<CaseDetail> => api.get<CaseDetail>(`/cases/${id}`);

export const updateCase = (id: string, body: { status?: CaseStatus; assignedToId?: string | null }) =>
  api.patch<CaseDetail>(`/cases/${id}`, body);

export const decideCase = (
  id: string,
  body: { decision: "CONFIRMED" | "DISMISSED" | "CLOSED" | "REOPEN"; reason?: string },
) => api.post<CaseDetail>(`/cases/${id}/decision`, body);

export const addNote = (id: string, body: string) =>
  api.post<{ id: string; body: string; author: { id: string; name: string }; createdAt: string }>(
    `/cases/${id}/notes`,
    { body },
  );

export const requestInvestigation = (id: string, regenerate = false) =>
  api.post<{ status: string }>(`/cases/${id}/investigate`, { regenerate });

export const getInvestigation = (id: string): Promise<InvestigationView> =>
  api.get<InvestigationView>(`/cases/${id}/investigation`);

export const reviewInvestigation = (
  id: string,
  body: { action: "ACCEPT" | "EDIT" | "REJECT"; editedOutput?: InvestigationOutput },
) => api.patch<{ status: string; reviewStatus: string }>(`/cases/${id}/investigation`, body);

export type CaseAssignee = { id: string; name: string; role: Role };
export type { CaseDetail, CaseListRow, InvestigationOutput, InvestigationView, Severity };
