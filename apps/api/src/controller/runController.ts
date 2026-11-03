import { type Request, type Response, Router } from "express";
import type { Prisma } from "@prisma/client";
import db from "@repo/db";
import { redis } from "@repo/cache";
import {
  idParamSchema,
  signalQuerySchema,
} from "@repo/shared";
import { ApiError } from "@repo/utils";
import userMiddleware from "../middleware/userMiddleware";
import { forbidViewer } from "../middleware/requireRole";
import { getDatasetForUser, getRunForUser } from "../lib/access";
import { AUDIT_ACTIONS, audit } from "../lib/audit";
import { csvList, getPaging, pageMeta } from "../lib/pagination";
import { enqueueAnalysis } from "../jobs/queues";
import { resolveRuleSnapshot } from "../services/analysis/rules";
import { computeRunStats } from "../services/analysis/stats";

const runRouter: Router = Router();

const ACTIVE_RUN_STATUSES = ["QUEUED", "RUNNING"] as const;

runRouter.post("/datasets/:id/runs", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    forbidViewer(req);

    const params = idParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid dataset id");

    const dataset = await getDatasetForUser(req.user, params.data.id);

    if (dataset.status !== "VALIDATED") {
      throw ApiError.conflict("Validate the dataset first");
    }

    const active = await db.analysisRun.count({
      where: { datasetId: dataset.id, status: { in: [...ACTIVE_RUN_STATUSES] } },
    });

    if (active > 0) {
      throw ApiError.conflict("An analysis is already queued or running for this dataset");
    }

    const ruleSnapshot = await resolveRuleSnapshot(req.user.orgId);

    const run = await db.analysisRun.create({
      data: {
        datasetId: dataset.id,
        triggeredById: req.user.userId,
        ruleSnapshot: ruleSnapshot as unknown as Prisma.InputJsonValue,
      },
    });

    const jobId = await enqueueAnalysis(run.id);

    if (jobId) {
      await db.analysisRun.update({ where: { id: run.id }, data: { jobId } });
    }

    await audit({
      orgId: req.user.orgId,
      userId: req.user.userId,
      action: AUDIT_ACTIONS.RUN_QUEUED,
      entityType: "AnalysisRun",
      entityId: run.id,
      meta: { datasetId: dataset.id },
      ip: req.ip ?? null,
    });

    return res.status(202).json({ success: true, data: { id: run.id, status: run.status } });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while queueing an analysis: ${error}`);
    throw ApiError.internal();
  }
});

runRouter.get("/datasets/:id/runs", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    forbidViewer(req);

    const params = idParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid dataset id");

    await getDatasetForUser(req.user, params.data.id);

    const runs = await db.analysisRun.findMany({
      where: { datasetId: params.data.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        summary: true,
        error: true,
        createdAt: true,
      },
    });

    return res.status(200).json({ success: true, data: runs });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while listing runs: ${error}`);
    throw ApiError.internal();
  }
});

runRouter.get("/runs/:id", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    forbidViewer(req);

    const params = idParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid run id");

    const run = await getRunForUser(req.user, params.data.id);
    const durationMs =
      run.startedAt && run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null;

    return res.status(200).json({
      success: true,
      data: {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        durationMs,
        summary: run.summary,
        error: run.error,
        dataset: run.dataset,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while reading a run: ${error}`);
    throw ApiError.internal();
  }
});

runRouter.get("/runs/:id/signals", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    forbidViewer(req);

    const params = idParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid run id");

    const query = signalQuerySchema.safeParse(req.query);
    if (!query.success) throw ApiError.badRequest(query.error.issues[0]?.message ?? "Invalid query");

    await getRunForUser(req.user, params.data.id);

    const paging = getPaging(query.data);
    const severities = csvList(query.data.severity);

    const where = {
      runId: params.data.id,
      ...(severities.length > 0 ? { severity: { in: severities as never } } : {}),
      ...(query.data.ruleKey ? { ruleKey: query.data.ruleKey } : {}),
      ...(query.data.entityType ? { entityType: query.data.entityType } : {}),
      ...(query.data.caseId ? { caseId: query.data.caseId } : {}),
      ...(query.data.q ? { title: { contains: query.data.q, mode: "insensitive" as const } } : {}),
    };

    const [total, signals] = await Promise.all([
      db.riskSignal.count({ where }),
      db.riskSignal.findMany({
        where,
        orderBy: [{ severity: "desc" }, { weight: "desc" }],
        skip: paging.skip,
        take: paging.take,
        include: { case: { select: { code: true } } },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: signals.map((signal) => ({
        id: signal.id,
        ruleKey: signal.ruleKey,
        category: signal.category,
        severity: signal.severity,
        weight: signal.weight,
        title: signal.title,
        entityType: signal.entityType,
        entityId: signal.entityId,
        caseId: signal.caseId,
        caseCode: signal.case?.code ?? null,
        exposureAmount: signal.exposureAmount === null ? null : Number(signal.exposureAmount),
        evidence: signal.evidence,
      })),
      meta: pageMeta(total, paging),
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while listing signals: ${error}`);
    throw ApiError.internal();
  }
});

interface GraphNodeView {
  id: string;
  type: string;
  label: string;
  flagged: boolean;
}

interface GraphEdgeView {
  id: string;
  source: string;
  target: string;
  label: string;
}

runRouter.get("/runs/:id/graph", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    forbidViewer(req);

    const params = idParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid run id");

    await getRunForUser(req.user, params.data.id);

    const caseId = typeof req.query.caseId === "string" ? req.query.caseId : undefined;

    if (caseId) {
      const riskCase = await db.case.findUnique({
        where: { id: caseId },
        select: { runId: true, graph: true },
      });

      if (!riskCase || riskCase.runId !== params.data.id) {
        throw ApiError.notFound("Case not found in this run");
      }

      return res.status(200).json({ success: true, data: riskCase.graph ?? { nodes: [], edges: [] } });
    }

    const cases = await db.case.findMany({
      where: { runId: params.data.id, severity: { in: ["MEDIUM", "HIGH", "CRITICAL"] } },
      orderBy: { priority: "desc" },
      select: { graph: true },
    });

    const nodes = new Map<string, GraphNodeView>();
    const edges = new Map<string, GraphEdgeView>();
    let truncated = false;

    for (const riskCase of cases) {
      const graph = (riskCase.graph ?? {}) as { nodes?: GraphNodeView[]; edges?: GraphEdgeView[] };

      for (const node of graph.nodes ?? []) {
        if (nodes.size >= 400 && !nodes.has(node.id)) {
          truncated = true;
          continue;
        }
        nodes.set(node.id, node);
      }

      for (const edge of graph.edges ?? []) {
        if (!nodes.has(edge.source) || !nodes.has(edge.target)) continue;
        edges.set(`${edge.source}|${edge.target}|${edge.label}`, edge);
      }
    }

    return res.status(200).json({
      success: true,
      data: { nodes: [...nodes.values()], edges: [...edges.values()], truncated },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while building the run graph: ${error}`);
    throw ApiError.internal();
  }
});

runRouter.get("/runs/:id/stats", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    forbidViewer(req);

    const params = idParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid run id");

    await getRunForUser(req.user, params.data.id);

    const cacheKey = `finsight:stats:${params.data.id}`;

    if (redis.isReady) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return res.status(200).json({ success: true, data: JSON.parse(cached) });
      } catch (error) {
        console.warn(`Stats cache read failed: ${error}`);
      }
    }

    const stats = await computeRunStats(params.data.id);

    if (redis.isReady) {
      try {
        await redis.setEx(cacheKey, 600, JSON.stringify(stats));
      } catch (error) {
        console.warn(`Stats cache write failed: ${error}`);
      }
    }

    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while computing run stats: ${error}`);
    throw ApiError.internal();
  }
});

export default runRouter;
