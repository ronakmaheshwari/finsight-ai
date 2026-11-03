import type { Prisma } from "@prisma/client";
import db from "@repo/db";
import { ApiError } from "@repo/utils";
import type { CaseListRow } from "@repo/shared";
import { assertEngagementAccess, getRunForUser, type AuthUser } from "../../lib/access";
import { csvList, getPaging, type Paging } from "../../lib/pagination";

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

export interface CaseListResult {
  rows: CaseListRow[];
  total: number;
  paging: Paging;
}

export const resolveRunId = async (
  user: AuthUser,
  query: { runId?: string; engagementId?: string },
): Promise<string | null> => {
  if (query.runId) {
    await getRunForUser(user, query.runId);
    return query.runId;
  }

  if (!query.engagementId) {
    throw ApiError.badRequest("Provide runId or engagementId");
  }

  await assertEngagementAccess(user, query.engagementId);

  const latest = await db.analysisRun.findFirst({
    where: { dataset: { engagementId: query.engagementId }, status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
    select: { id: true },
  });

  return latest?.id ?? null;
};

export const toCaseRow = (riskCase: {
  id: string;
  code: string;
  title: string;
  primaryEntityType: string;
  primaryEntityLabel: string;
  riskScore: number;
  severity: string;
  exposureAmount: unknown;
  signalCount: number;
  status: string;
  createdAt: Date;
  assignedTo: { id: string; name: string } | null;
  ai: { status: string; reviewStatus: string } | null;
}): CaseListRow => ({
  id: riskCase.id,
  code: riskCase.code,
  title: riskCase.title,
  primaryEntityType: riskCase.primaryEntityType as CaseListRow["primaryEntityType"],
  primaryEntityLabel: riskCase.primaryEntityLabel,
  riskScore: riskCase.riskScore,
  severity: riskCase.severity as CaseListRow["severity"],
  exposureAmount: Number(riskCase.exposureAmount),
  signalCount: riskCase.signalCount,
  status: riskCase.status as CaseListRow["status"],
  assignedTo: riskCase.assignedTo,
  aiStatus: (riskCase.ai?.status as CaseListRow["aiStatus"]) ?? "NONE",
  ...(riskCase.ai?.reviewStatus
    ? { aiReviewStatus: riskCase.ai.reviewStatus as CaseListRow["aiReviewStatus"] }
    : {}),
  createdAt: riskCase.createdAt.toISOString(),
});

export const listCases = async (user: AuthUser, query: CaseQuery): Promise<CaseListResult> => {
  const runId = await resolveRunId(user, query);
  const paging = getPaging(query);

  if (!runId) return { rows: [], total: 0, paging };

  const statuses = csvList(query.status);
  const severities = csvList(query.severity);

  const where: Prisma.CaseWhereInput = { runId };

  if (user.role === "VIEWER") {
    where.status = { in: ["CONFIRMED", "DISMISSED", "CLOSED"] };
  } else if (statuses.length > 0) {
    where.status = { in: statuses as never };
  }

  if (severities.length > 0) {
    where.severity = { in: severities as never };
  }

  if (query.assignedTo === "me") {
    where.assignedToId = user.userId;
  } else if (query.assignedTo === "unassigned") {
    where.assignedToId = null;
  } else if (query.assignedTo) {
    where.assignedToId = query.assignedTo;
  }

  if (query.minScore !== undefined) where.riskScore = { gte: query.minScore };

  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { primaryEntityLabel: { contains: query.q, mode: "insensitive" } },
      { code: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const orderField = query.sortBy ?? "priority";
  const orderDir = query.sortDir ?? "desc";

  const [total, cases] = await Promise.all([
    db.case.count({ where }),
    db.case.findMany({
      where,
      orderBy: { [orderField]: orderDir } as Prisma.CaseOrderByWithRelationInput,
      skip: paging.skip,
      take: paging.take,
      include: {
        assignedTo: { select: { id: true, name: true } },
        ai: { select: { status: true, reviewStatus: true } },
      },
    }),
  ]);

  return { rows: cases.map(toCaseRow), total, paging };
};
