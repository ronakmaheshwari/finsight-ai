import type { Role } from "@prisma/client";
import db from "@repo/db";
import { ApiError } from "@repo/utils";

/** Shape attached to `req.user` by `userMiddleware`. */
export interface AuthUser {
  userId: string;
  orgId: string;
  name: string;
  email: string;
  role: Role;
}

export const requireUser = (user: AuthUser | undefined): AuthUser => {
  if (!user) throw ApiError.unauthorized();
  return user;
};

export const isAdmin = (user: AuthUser): boolean => user.role === "ADMIN";

/**
 * Org scoping is the tenancy boundary: an engagement outside the caller's org
 * is reported as 404 so its existence is never leaked (§3.4).
 */
export const assertEngagementAccess = async (
  user: AuthUser,
  engagementId: string,
): Promise<{ id: string; orgId: string; periodStart: Date; periodEnd: Date }> => {
  const engagement = await db.engagement.findUnique({
    where: { id: engagementId },
    select: { id: true, orgId: true, periodStart: true, periodEnd: true },
  });

  if (!engagement || engagement.orgId !== user.orgId) {
    throw ApiError.notFound("Engagement not found");
  }

  if (user.role === "ADMIN") return engagement;

  const membership = await db.engagementMember.findUnique({
    where: { engagementId_userId: { engagementId, userId: user.userId } },
    select: { userId: true },
  });

  if (!membership) {
    throw ApiError.forbidden("You are not a member of this engagement");
  }

  return engagement;
};

export const getDatasetForUser = async (user: AuthUser, datasetId: string) => {
  const dataset = await db.dataset.findUnique({
    where: { id: datasetId },
    include: { engagement: { select: { id: true, orgId: true, title: true, clientName: true } } },
  });

  if (!dataset) throw ApiError.notFound("Dataset not found");
  await assertEngagementAccess(user, dataset.engagementId);

  return dataset;
};

export const getRunForUser = async (user: AuthUser, runId: string) => {
  const run = await db.analysisRun.findUnique({
    where: { id: runId },
    include: { dataset: { select: { id: true, name: true, engagementId: true } } },
  });

  if (!run) throw ApiError.notFound("Analysis run not found");
  await assertEngagementAccess(user, run.dataset.engagementId);

  return run;
};

export const getCaseForUser = async (user: AuthUser, caseId: string) => {
  const riskCase = await db.case.findUnique({
    where: { id: caseId },
    include: { engagement: { select: { id: true, orgId: true, title: true, clientName: true, periodStart: true, periodEnd: true } } },
  });

  if (!riskCase) throw ApiError.notFound("Case not found");
  await assertEngagementAccess(user, riskCase.engagementId);

  return riskCase;
};

/** A VIEWER may only read cases that reached a decided status. */
export const VIEWER_VISIBLE_STATUSES = ["CONFIRMED", "DISMISSED", "CLOSED"] as const;

export const assertViewerCanSeeCase = (user: AuthUser, status: string): void => {
  if (user.role !== "VIEWER") return;
  if (!(VIEWER_VISIBLE_STATUSES as readonly string[]).includes(status)) {
    throw ApiError.forbidden("Viewers can only open decided cases");
  }
};
