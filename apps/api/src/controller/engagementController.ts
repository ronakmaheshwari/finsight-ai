import { type Request, type Response, Router } from "express";
import db from "@repo/db";
import {
  addMemberSchema,
  createDatasetSchema,
  createEngagementSchema,
  idParamSchema,
  updateEngagementSchema,
} from "@repo/shared";
import { ApiError } from "@repo/utils";
import userMiddleware from "../middleware/userMiddleware";
import { forbidViewer, requireRole } from "../middleware/requireRole";
import { assertEngagementAccess } from "../lib/access";
import { AUDIT_ACTIONS, audit } from "../lib/audit";

const engagementRouter: Router = Router();

const memberSelect = {
  user: { select: { id: true, name: true, email: true, role: true } },
} as const;

engagementRouter.get("/", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const user = req.user;

    const engagements = await db.engagement.findMany({
      where:
        user.role === "ADMIN"
          ? { orgId: user.orgId }
          : { orgId: user.orgId, members: { some: { userId: user.userId } } },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            datasets: true,
            cases: { where: { status: { in: ["OPEN", "IN_REVIEW", "ESCALATED"] } } },
          },
        },
      },
    });

    const data = engagements.map((engagement) => ({
      id: engagement.id,
      clientName: engagement.clientName,
      title: engagement.title,
      periodStart: engagement.periodStart.toISOString(),
      periodEnd: engagement.periodEnd.toISOString(),
      datasetCount: engagement._count.datasets,
      openCaseCount: engagement._count.cases,
      createdAt: engagement.createdAt.toISOString(),
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while listing engagements: ${error}`);
    throw ApiError.internal();
  }
});

engagementRouter.post("/", userMiddleware, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const parsed = createEngagementSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid engagement");
    }

    const engagement = await db.engagement.create({
      data: {
        orgId: req.user.orgId,
        ownerId: req.user.userId,
        clientName: parsed.data.clientName,
        title: parsed.data.title,
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
        members: { create: { userId: req.user.userId } },
      },
    });

    await audit({
      orgId: req.user.orgId,
      userId: req.user.userId,
      action: AUDIT_ACTIONS.ENGAGEMENT_CREATED,
      entityType: "Engagement",
      entityId: engagement.id,
      meta: { clientName: engagement.clientName },
      ip: req.ip ?? null,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: engagement.id,
        clientName: engagement.clientName,
        title: engagement.title,
        periodStart: engagement.periodStart.toISOString(),
        periodEnd: engagement.periodEnd.toISOString(),
        datasetCount: 0,
        openCaseCount: 0,
        createdAt: engagement.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while creating an engagement: ${error}`);
    throw ApiError.internal();
  }
});

engagementRouter.get("/:id", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const params = idParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid engagement id");

    await assertEngagementAccess(req.user, params.data.id);

    const engagement = await db.engagement.findUnique({
      where: { id: params.data.id },
      include: {
        members: { include: memberSelect },
        _count: { select: { datasets: true, cases: true } },
        datasets: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            analysisRun: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true, status: true, finishedAt: true, summary: true },
            },
          },
        },
      },
    });

    if (!engagement) throw ApiError.notFound("Engagement not found");

    const latestRun = engagement.datasets[0]?.analysisRun[0] ?? null;

    return res.status(200).json({
      success: true,
      data: {
        id: engagement.id,
        clientName: engagement.clientName,
        title: engagement.title,
        periodStart: engagement.periodStart.toISOString(),
        periodEnd: engagement.periodEnd.toISOString(),
        createdAt: engagement.createdAt.toISOString(),
        datasetCount: engagement._count.datasets,
        caseCount: engagement._count.cases,
        members: engagement.members.map((member) => member.user),
        latestRun,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while reading an engagement: ${error}`);
    throw ApiError.internal();
  }
});

engagementRouter.patch("/:id", userMiddleware, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const params = idParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid engagement id");

    const engagement = await assertEngagementAccess(req.user, params.data.id);
    const parsed = updateEngagementSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid update");
    }

    const periodStart = parsed.data.periodStart ?? engagement.periodStart;
    const periodEnd = parsed.data.periodEnd ?? engagement.periodEnd;
    if (periodEnd < periodStart) {
      throw ApiError.badRequest("Period end must be on or after period start");
    }

    const updated = await db.engagement.update({
      where: { id: engagement.id },
      data: {
        ...(parsed.data.clientName ? { clientName: parsed.data.clientName } : {}),
        ...(parsed.data.title ? { title: parsed.data.title } : {}),
        ...(parsed.data.periodStart ? { periodStart: parsed.data.periodStart } : {}),
        ...(parsed.data.periodEnd ? { periodEnd: parsed.data.periodEnd } : {}),
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        id: updated.id,
        clientName: updated.clientName,
        title: updated.title,
        periodStart: updated.periodStart.toISOString(),
        periodEnd: updated.periodEnd.toISOString(),
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while updating an engagement: ${error}`);
    throw ApiError.internal();
  }
});

engagementRouter.post(
  "/:id/members",
  userMiddleware,
  requireRole("ADMIN", "MANAGER"),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) throw ApiError.unauthorized();

      const params = idParamSchema.safeParse(req.params);
      if (!params.success) throw ApiError.badRequest("Invalid engagement id");

      await assertEngagementAccess(req.user, params.data.id);

      const parsed = addMemberSchema.safeParse(req.body);
      if (!parsed.success) throw ApiError.badRequest("Provide a valid userId");

      const user = await db.user.findUnique({ where: { id: parsed.data.userId } });
      if (!user || user.orgId !== req.user.orgId || user.userStatus !== "ACTIVE") {
        throw ApiError.notFound("User not found");
      }

      await db.engagementMember.upsert({
        where: { engagementId_userId: { engagementId: params.data.id, userId: user.id } },
        create: { engagementId: params.data.id, userId: user.id },
        update: {},
      });

      return res.status(201).json({ success: true, data: { userId: user.id } });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error(`Error took place while adding an engagement member: ${error}`);
      throw ApiError.internal();
    }
  },
);

engagementRouter.delete(
  "/:id/members/:userId",
  userMiddleware,
  requireRole("ADMIN", "MANAGER"),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) throw ApiError.unauthorized();

      const params = idParamSchema.safeParse(req.params);
      if (!params.success) throw ApiError.badRequest("Invalid engagement id");

      const engagementId = params.data.id;
      const userId = String(req.params.userId ?? "");

      await assertEngagementAccess(req.user, engagementId);

      const memberCount = await db.engagementMember.count({ where: { engagementId } });
      if (memberCount <= 1) {
        throw ApiError.conflict("Cannot remove the last member of an engagement");
      }

      const removed = await db.engagementMember.deleteMany({ where: { engagementId, userId } });
      if (removed.count === 0) throw ApiError.notFound("Member not found");

      return res.status(200).json({ success: true, data: { userId } });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error(`Error took place while removing an engagement member: ${error}`);
      throw ApiError.internal();
    }
  },
);

engagementRouter.get("/:id/datasets", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    forbidViewer(req);

    const params = idParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid engagement id");

    await assertEngagementAccess(req.user, params.data.id);

    const datasets = await db.dataset.findMany({
      where: { engagementId: params.data.id },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        analysisRun: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, finishedAt: true },
        },
      },
    });

    const data = datasets.map((dataset) => ({
      id: dataset.id,
      name: dataset.name,
      status: dataset.status,
      rowCounts: dataset.rowCounts,
      createdAt: dataset.createdAt.toISOString(),
      uploadedBy: dataset.uploadedBy,
      latestRun: dataset.analysisRun[0] ?? null,
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while listing datasets: ${error}`);
    throw ApiError.internal();
  }
});

engagementRouter.post("/:id/datasets", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    forbidViewer(req);

    const params = idParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid engagement id");

    await assertEngagementAccess(req.user, params.data.id);

    const parsed = createDatasetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid dataset");
    }

    const dataset = await db.dataset.create({
      data: {
        engagementId: params.data.id,
        uploadedById: req.user.userId,
        name: parsed.data.name,
      },
    });

    await audit({
      orgId: req.user.orgId,
      userId: req.user.userId,
      action: AUDIT_ACTIONS.DATASET_CREATED,
      entityType: "Dataset",
      entityId: dataset.id,
      meta: { name: dataset.name },
      ip: req.ip ?? null,
    });

    return res.status(201).json({ success: true, data: dataset });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while creating a dataset: ${error}`);
    throw ApiError.internal();
  }
});

export default engagementRouter;
