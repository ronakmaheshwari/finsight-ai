import type { AuditRow } from "@repo/shared";

import { api } from "./client";

export interface AuditQuery {
  page?: number;
  pageSize?: number;
  userId?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
}

export const listAuditLogs = (query: AuditQuery) =>
  api.page<AuditRow>("/audit-logs", query as Record<string, unknown>);
