import { type Request, type Response, Router } from "express";
import { Prisma } from "@prisma/client";
import db from "@repo/db";
import {
  dashboardParamSchema,
  dashboardQuerySchema,
  type DashboardView,
  type Severity,
} from "@repo/shared";
import { ApiError } from "@repo/utils";
import userMiddleware from "../middleware/userMiddleware";
import { assertEngagementAccess, getRunForUser } from "../lib/access";
import { toCaseRow } from "../services/cases/queries";

const dashboardRouter: Router = Router();

const DECIDED = ["CONFIRMED", "DISMISSED", "CLOSED"] as const;
const ACTIVE = ["OPEN", "IN_REVIEW", "ESCALATED"] as const;

const summaryNumber = (summary: unknown, key: string): number | null => {
  if (!summary || typeof summary !== "object") return null;
  const value = (summary as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
};

dashboardRouter.get("/:engagementId", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const params = dashboardParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid engagement id");

    const query = dashboardQuerySchema.safeParse(req.query);
    if (!query.success) throw ApiError.badRequest(query.error.issues[0]?.message ?? "Invalid query");

    await assertEngagementAccess(req.user, params.data.engagementId);

    const run = query.data.runId
      ? await getRunForUser(req.user, query.data.runId)
      : await db.analysisRun.findFirst({
          where: {
            dataset: { engagementId: params.data.engagementId },
            status: "COMPLETED",
          },
          orderBy: { finishedAt: "desc" },
          include: { dataset: { select: { id: true, name: true, engagementId: true } } },
        });

    if (!run) {
      throw ApiError.notFound("No completed analysis run for this engagement");
    }

    if (run.dataset.engagementId !== params.data.engagementId) {
      throw ApiError.notFound("Analysis run not found in this engagement");
    }

    const isViewer = req.user.role === "VIEWER";

    const caseWhere: Prisma.CaseWhereInput = {
      runId: run.id,
      ...(isViewer ? { status: { in: [...DECIDED] } } : {}),
    };

    const viewerSignalFilter = isViewer
      ? Prisma.sql`JOIN "Case" c ON c.id = s."caseId" AND c.status::text IN ('CONFIRMED', 'DISMISSED', 'CLOSED')`
      : Prisma.empty;

    const [severityGroups, exposureSum, confirmedSum, dismissedCount, openCases, populationInvoices, riskByMonthRows, ruleGroups, topVendorCases, recentCases] =
      await Promise.all([
        db.case.groupBy({ by: ["severity"], where: caseWhere, _count: { _all: true } }),
        db.case.aggregate({ where: caseWhere, _sum: { exposureAmount: true }, _count: { _all: true } }),
        db.case.aggregate({
          where: { ...caseWhere, status: "CONFIRMED" },
          _sum: { exposureAmount: true },
        }),
        db.case.count({ where: { ...caseWhere, status: "DISMISSED" } }),
        db.case.count({ where: { ...caseWhere, status: { in: [...ACTIVE] } } }),
        db.invoice.count({ where: { datasetId: run.datasetId } }),
        db.$queryRaw<{ month: string; flaggedInvoices: number; exposure: unknown }[]>(Prisma.sql`
          WITH flagged AS (
            SELECT DISTINCT i.id, i."invoiceDate", i.amount
            FROM "RiskSignal" s
            CROSS JOIN LATERAL unnest(s."invoiceIds") AS inv(id)
            JOIN "Invoice" i ON i.id = inv.id
            ${viewerSignalFilter}
            WHERE s."runId" = ${run.id}
          )
          SELECT to_char("invoiceDate", 'YYYY-MM') AS month,
                 COUNT(*)::int AS "flaggedInvoices",
                 COALESCE(SUM(amount), 0) AS exposure
          FROM flagged
          GROUP BY 1
          ORDER BY 1
        `),
        db.riskSignal.groupBy({
          by: ["ruleKey"],
          where: { runId: run.id, ...(isViewer ? { case: { status: { in: [...DECIDED] } } } : {}) },
          _count: { _all: true },
          orderBy: { _count: { ruleKey: "desc" } },
        }),
        db.case.findMany({
          where: { ...caseWhere, primaryEntityType: "VENDOR" },
          orderBy: { riskScore: "desc" },
          take: 10,
          select: { primaryEntityId: true, riskScore: true, exposureAmount: true },
        }),
        db.case.findMany({
          where: caseWhere,
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            assignedTo: { select: { id: true, name: true } },
            ai: { select: { status: true, reviewStatus: true } },
          },
        }),
      ]);

    const casesBySeverity: Record<Severity, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const group of severityGroups) {
      casesBySeverity[group.severity as Severity] = group._count._all;
    }

    const riskByMonth = riskByMonthRows.map((row) => ({
      month: row.month,
      flaggedInvoices: Number(row.flaggedInvoices),
      exposure: Number(row.exposure),
    }));

    const vendorIds = topVendorCases.map((entry) => entry.primaryEntityId);
    const vendors = vendorIds.length
      ? await db.vendor.findMany({
          where: { id: { in: vendorIds } },
          select: { id: true, externalId: true, name: true },
        })
      : [];
    const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));

    const topVendors = topVendorCases.map((entry) => {
      const vendor = vendorById.get(entry.primaryEntityId);
      return {
        vendorId: entry.primaryEntityId,
        ref: vendor?.externalId ?? "",
        name: vendor?.name ?? "Unknown vendor",
        maxScore: entry.riskScore,
        exposure: Number(entry.exposureAmount),
      };
    });

    const summary = run.summary;
    const flaggedFromSummary = summaryNumber(summary, "flaggedInvoices");
    const flaggedInvoices = isViewer
      ? riskByMonth.reduce((total, row) => total + row.flaggedInvoices, 0)
      : flaggedFromSummary ?? riskByMonth.reduce((total, row) => total + row.flaggedInvoices, 0);

    const population = summaryNumber(summary, "populationInvoices") ?? populationInvoices;

    const data: DashboardView = {
      runId: run.id,
      runFinishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      kpis: {
        casesTotal: exposureSum._count._all,
        casesBySeverity,
        openCases,
        totalExposure: Number(exposureSum._sum.exposureAmount ?? 0),
        confirmedExposure: Number(confirmedSum._sum.exposureAmount ?? 0),
        dismissedCount,
        flaggedInvoices,
        populationInvoices: population,
        flaggedPct: population > 0 ? Math.round((flaggedInvoices / population) * 1000) / 10 : 0,
        estimatedHoursSaved: summaryNumber(summary, "estimatedHoursSaved") ?? 0,
      },
      riskByMonth,
      topVendors,
      ruleBreakdown: ruleGroups.map((group) => ({
        ruleKey: group.ruleKey,
        count: group._count._all,
      })),
      recentCases: recentCases.map(toCaseRow),
    };

    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while building the dashboard: ${error}`);
    throw ApiError.internal();
  }
});

export default dashboardRouter;
