import type {
  DatasetDetail,
  DatasetRow,
  DatasetRunRow,
  EngagementDetail,
  EngagementRow,
  RunStatus,
} from "@repo/shared";

import { api } from "./client";

export const listEngagements = (): Promise<EngagementRow[]> => api.get<EngagementRow[]>("/engagements");

export const getEngagement = (id: string): Promise<EngagementDetail> =>
  api.get<EngagementDetail>(`/engagements/${id}`);

export const createEngagement = (body: {
  clientName: string;
  title: string;
  periodStart: string;
  periodEnd: string;
}): Promise<EngagementRow> => api.post<EngagementRow>("/engagements", body);

export const updateEngagement = (
  id: string,
  body: { clientName?: string; title?: string; periodStart?: string; periodEnd?: string },
): Promise<EngagementRow> => api.patch<EngagementRow>(`/engagements/${id}`, body);

export const addMember = (engagementId: string, userId: string): Promise<{ userId: string }> =>
  api.post<{ userId: string }>(`/engagements/${engagementId}/members`, { userId });

export const removeMember = (engagementId: string, userId: string): Promise<{ userId: string }> =>
  api.delete<{ userId: string }>(`/engagements/${engagementId}/members/${userId}`);

export const listDatasets = (engagementId: string): Promise<DatasetRow[]> =>
  api.get<DatasetRow[]>(`/engagements/${engagementId}/datasets`);

export const createDataset = (engagementId: string, name: string): Promise<{ id: string; name: string }> =>
  api.post<{ id: string; name: string }>(`/engagements/${engagementId}/datasets`, { name });

export type { DatasetDetail, DatasetRow, DatasetRunRow, EngagementDetail, EngagementRow, RunStatus };
