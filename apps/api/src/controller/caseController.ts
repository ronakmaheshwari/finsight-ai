import { type Request, type Response, Router } from "express";
import db from "@repo/db";
import {
  caseIdParamSchema,
  caseListQuerySchema,
  caseNoteSchema,
  caseUpdateSchema,
  decisionSchema,
  investigateSchema,
  reviewSchema,
} from "@repo/shared";
import { ApiError } from "@repo/utils";
import userMiddleware from "../middleware/userMiddleware";
import { rateLimit, userKey } from "../middleware/rateLimit";
import { assertViewerCanSeeCase, getCaseForUser } from "../lib/access";
import { AUDIT_ACTIONS, audit } from "../lib/audit";
import { pageMeta } from "../lib/pagination";
import { listCases } from "../services/cases/queries";
import {
  assertDecisionAllowed,
  assertPatchTransition,
  DECISION_STATUSES,
} from "../services/cases/transitions";
import { enqueueInvestigation } from "../jobs/queues";
import { streamCasePdf } from "../services/export/casePdf";

const caseRouter: Router = Router();

const investigationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyOf: userKey,
});

const parseCaseId = (req: Request): string => {
  const params = caseIdParamSchema.safeParse(req.params);
  if (!params.success) throw ApiError.badRequest("Invalid case id");
  return params.data.id;
};

caseRouter.get("/", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const query = caseListQuerySchema.safeParse(req.query);
    if (!query.success) throw ApiError.badRequest(query.error.issues[0]?.message ?? "Invalid query");

    const result = await listCases(req.user, query.data);

    return res.status(200).json({
      success: true,
      data: result.rows,
      meta: pageMeta(result.total, result.paging),
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while listing cases: ${error}`);
    throw ApiError.internal();
  }
});

caseRouter.get("/:id", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const caseId = parseCaseId(req);
    const riskCase = await getCaseForUser(req.user, caseId);
    assertViewerCanSeeCase(req.user, riskCase.status);

    const full = await db.case.findUnique({
      where: { id: caseId },
      include: {
        run: { select: { id: true, finishedAt: true } },
        signals: { orderBy: { weight: "desc" } },
        notes: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true } } },
        },
        assignedTo: { select: { id: true, name: true } },
        decidedBy: { select: { id: true, name: true } },
        ai: { select: { status: true, reviewStatus: true } },
      },
    });

    if (!full) throw ApiError.notFound("Case not found");

    return res.status(200).json({
      success: true,
      data: {
        id: full.id,
        code: full.code,
        title: full.title,
        primaryEntityType: full.primaryEntityType,
        primaryEntityId: full.primaryEntityId,
        primaryEntityLabel: full.primaryEntityLabel,
        entities: full.entities,
        riskScore: full.riskScore,
        severity: full.severity,
        exposureAmount: Number(full.exposureAmount),
        priority: full.priority,
        signalCount: full.signalCount,
        status: full.status,
        decisionReason: full.decisionReason,
        decidedAt: full.decidedAt,
        decidedBy: full.decidedBy,
        assignedTo: full.assignedTo,
        scoreBreakdown: full.scoreBreakdown,
        graph: full.graph,
        createdAt: full.createdAt,
        updatedAt: full.updatedAt,
        run: full.run,
        signals: full.signals.map((signal) => ({
          ...signal,
          exposureAmount: signal.exposureAmount === null ? null : Number(signal.exposureAmount),
        })),
        notes: full.notes.map((note) => ({
          id: note.id,
          body: note.body,
          author: note.author,
          createdAt: note.createdAt,
        })),
        ai: full.ai,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while reading a case: ${error}`);
    throw ApiError.internal();
  }
});

caseRouter.patch("/:id", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.role === "VIEWER") throw ApiError.forbidden();

    const caseId = parseCaseId(req);
    const riskCase = await getCaseForUser(req.user, caseId);

    const parsed = caseUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid update");
    }

    const isAnalyst = req.user.role === "ANALYST";

    if (isAnalyst && riskCase.assignedToId !== req.user.userId) {
      if (parsed.data.assignedToId !== req.user.userId || riskCase.assignedToId !== null) {
        throw ApiError.forbidden("You can only act on a case assigned to you");
      }
    }

    let nextStatus = riskCase.status;
    const data: Record<string, unknown> = {};

    if (parsed.data.status && parsed.data.status !== riskCase.status) {
      assertPatchTransition(riskCase.status, parsed.data.status);

      if (isAnalyst) {
        const allowed =
          (riskCase.status === "OPEN" && parsed.data.status === "IN_REVIEW") ||
          (riskCase.status === "IN_REVIEW" && parsed.data.status === "ESCALATED");
        if (!allowed) throw ApiError.forbidden("Analysts cannot make this status change");
      }

      nextStatus = parsed.data.status;
      data.status = parsed.data.status;
    }

    if (parsed.data.assignedToId !== undefined) {
      if (isAnalyst) {
        if (parsed.data.assignedToId !== req.user.userId) {
          throw ApiError.forbidden("Analysts can only assign a case to themselves");
        }
        if (riskCase.assignedToId !== null) {
          throw ApiError.forbidden("This case is already assigned");
        }
      } else if (parsed.data.assignedToId !== null) {
        const membership = await db.engagementMember.findUnique({
          where: {
            engagementId_userId: {
              engagementId: riskCase.engagementId,
              userId: parsed.data.assignedToId,
            },
          },
          include: { user: { select: { userStatus: true } } },
        });

        if (!membership || membership.user.userStatus !== "ACTIVE") {
          throw ApiError.badRequest("Assignee must be an active member of the engagement");
        }
      }

      data.assignedToId = parsed.data.assignedToId;

      if (parsed.data.assignedToId === req.user.userId && riskCase.status === "OPEN") {
        nextStatus = "IN_REVIEW";
        data.status = "IN_REVIEW";
      }
    }

    const updated = await db.case.update({ where: { id: caseId }, data });

    if (data.status && data.status !== riskCase.status) {
      await audit({
        orgId: req.user.orgId,
        userId: req.user.userId,
        action: AUDIT_ACTIONS.CASE_STATUS_CHANGED,
        entityType: "Case",
        entityId: caseId,
        meta: { from: riskCase.status, to: nextStatus },
        ip: req.ip ?? null,
      });
    }

    if (parsed.data.assignedToId !== undefined) {
      await audit({
        orgId: req.user.orgId,
        userId: req.user.userId,
        action: AUDIT_ACTIONS.CASE_ASSIGNED,
        entityType: "Case",
        entityId: caseId,
        meta: { from: riskCase.assignedToId, to: parsed.data.assignedToId },
        ip: req.ip ?? null,
      });
    }

    return res.status(200).json({
      success: true,
      data: { id: updated.id, status: updated.status, assignedToId: updated.assignedToId },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while updating a case: ${error}`);
    throw ApiError.internal();
  }
});

caseRouter.post("/:id/decision", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.role !== "ADMIN" && req.user.role !== "MANAGER") throw ApiError.forbidden();

    const caseId = parseCaseId(req);
    const riskCase = await getCaseForUser(req.user, caseId);

    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid decision");
    }

    const { decision, reason } = parsed.data;

    if (decision !== "CLOSED" && (!reason || reason.trim().length < 10)) {
      throw ApiError.badRequest("A reason of at least 10 characters is required");
    }

    const nextStatus = assertDecisionAllowed(riskCase.status, decision);

    const reopened = decision === "REOPEN";

    const updated = await db.case.update({
      where: { id: caseId },
      data: {
        status: nextStatus,
        decisionReason: reopened ? null : reason ?? null,
        decidedById: reopened ? null : req.user.userId,
        decidedAt: reopened ? null : new Date(),
      },
    });

    await audit({
      orgId: req.user.orgId,
      userId: req.user.userId,
      action: AUDIT_ACTIONS.CASE_DECIDED,
      entityType: "Case",
      entityId: caseId,
      meta: { decision, from: riskCase.status, to: nextStatus },
      ip: req.ip ?? null,
    });

    return res.status(200).json({
      success: true,
      data: { id: updated.id, status: updated.status, decision: DECISION_STATUSES[decision] },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while deciding a case: ${error}`);
    throw ApiError.internal();
  }
});

caseRouter.post("/:id/notes", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.role === "VIEWER") throw ApiError.forbidden();

    const caseId = parseCaseId(req);
    await getCaseForUser(req.user, caseId);

    const parsed = caseNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid note");
    }

    const note = await db.caseNote.create({
      data: { caseId, authorId: req.user.userId, body: parsed.data.body },
      include: { author: { select: { id: true, name: true } } },
    });

    await audit({
      orgId: req.user.orgId,
      userId: req.user.userId,
      action: AUDIT_ACTIONS.CASE_NOTE_ADDED,
      entityType: "Case",
      entityId: caseId,
      ip: req.ip ?? null,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: note.id,
        body: note.body,
        author: note.author,
        createdAt: note.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while adding a case note: ${error}`);
    throw ApiError.internal();
  }
});

caseRouter.post(
  "/:id/investigate",
  userMiddleware,
  investigationLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) throw ApiError.unauthorized();
      if (req.user.role === "VIEWER") throw ApiError.forbidden();

      const caseId = parseCaseId(req);
      await getCaseForUser(req.user, caseId);

      const parsed = investigateSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw ApiError.badRequest("Invalid request");

      const existing = await db.aiInvestigation.findUnique({ where: { caseId } });
      const regenerate = parsed.data.regenerate === true;

      if (existing && (existing.status === "QUEUED" || existing.status === "RUNNING") && !regenerate) {
        return res.status(202).json({ success: true, data: { status: existing.status } });
      }

      if (existing && existing.status === "COMPLETED" && !regenerate) {
        return res.status(200).json({ success: true, data: { status: existing.status } });
      }

      await db.aiInvestigation.upsert({
        where: { caseId },
        create: { caseId, requestedById: req.user.userId, status: "QUEUED" },
        update: {
          status: "QUEUED",
          error: null,
          requestedById: req.user.userId,
          reviewStatus: "PENDING",
        },
      });

      await enqueueInvestigation(caseId, regenerate);

      await audit({
        orgId: req.user.orgId,
        userId: req.user.userId,
        action: AUDIT_ACTIONS.AI_INVESTIGATION_REQUESTED,
        entityType: "Case",
        entityId: caseId,
        meta: { regenerate },
        ip: req.ip ?? null,
      });

      return res.status(202).json({ success: true, data: { status: "QUEUED" } });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error(`Error took place while requesting an AI investigation: ${error}`);
      throw ApiError.internal();
    }
  },
);

caseRouter.get("/:id/investigation", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const caseId = parseCaseId(req);
    const riskCase = await getCaseForUser(req.user, caseId);
    assertViewerCanSeeCase(req.user, riskCase.status);

    const investigation = await db.aiInvestigation.findUnique({
      where: { caseId },
      include: { reviewedBy: { select: { id: true, name: true } } },
    });

    if (!investigation) {
      return res.status(200).json({
        success: true,
        data: {
          status: "QUEUED",
          error: null,
          model: null,
          promptVersion: null,
          reviewStatus: "PENDING",
          reviewedBy: null,
          reviewedAt: null,
          output: null,
          edited: false,
          original: null,
          createdAt: null,
          notRequested: true,
        },
      });
    }

    const edited = investigation.editedOutput !== null;

    return res.status(200).json({
      success: true,
      data: {
        status: investigation.status,
        error: investigation.error,
        model: investigation.model,
        promptVersion: investigation.promptVersion,
        reviewStatus: investigation.reviewStatus,
        reviewedBy: investigation.reviewedBy,
        reviewedAt: investigation.reviewedAt,
        output: edited ? investigation.editedOutput : investigation.output,
        edited,
        original: edited ? investigation.output : null,
        createdAt: investigation.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while reading an AI investigation: ${error}`);
    throw ApiError.internal();
  }
});

caseRouter.patch("/:id/investigation", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.role === "VIEWER") throw ApiError.forbidden();

    const caseId = parseCaseId(req);
    await getCaseForUser(req.user, caseId);

    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid review");
    }

    const investigation = await db.aiInvestigation.findUnique({ where: { caseId } });
    if (!investigation) throw ApiError.notFound("No investigation for this case");
    if (investigation.status !== "COMPLETED") {
      throw ApiError.conflict("The investigation is not ready to review");
    }

    const { action, editedOutput } = parsed.data;

    if (action === "EDIT" && !editedOutput) {
      throw ApiError.badRequest("editedOutput is required for an edit");
    }

    if (editedOutput) {
      const signalIds = new Set(
        (
          await db.riskSignal.findMany({ where: { caseId }, select: { id: true } })
        ).map((signal) => signal.id),
      );

      for (const finding of editedOutput.keyFindings) {
        for (const id of finding.evidenceSignalIds) {
          if (!signalIds.has(id)) {
            throw ApiError.badRequest("Every cited signal must belong to this case");
          }
        }
      }
    }

    const reviewStatus =
      action === "ACCEPT" ? "ACCEPTED" : action === "REJECT" ? "REJECTED" : "EDITED";

    const updated = await db.aiInvestigation.update({
      where: { caseId },
      data: {
        reviewStatus,
        reviewedById: req.user.userId,
        reviewedAt: new Date(),
        ...(action === "EDIT" && editedOutput ? { editedOutput } : {}),
      },
    });

    await audit({
      orgId: req.user.orgId,
      userId: req.user.userId,
      action: AUDIT_ACTIONS.AI_INVESTIGATION_REVIEWED,
      entityType: "Case",
      entityId: caseId,
      meta: { action },
      ip: req.ip ?? null,
    });

    return res.status(200).json({
      success: true,
      data: { status: updated.status, reviewStatus: updated.reviewStatus },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while reviewing an AI investigation: ${error}`);
    throw ApiError.internal();
  }
});

caseRouter.get("/:id/export", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const caseId = parseCaseId(req);
    const riskCase = await getCaseForUser(req.user, caseId);
    assertViewerCanSeeCase(req.user, riskCase.status);

    await audit({
      orgId: req.user.orgId,
      userId: req.user.userId,
      action: AUDIT_ACTIONS.EXPORT_GENERATED,
      entityType: "Case",
      entityId: caseId,
      ip: req.ip ?? null,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="FinSight-${riskCase.code}.pdf"`);

    await streamCasePdf(caseId, { id: req.user.userId, name: req.user.name }, res);
    return res;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while exporting a case PDF: ${error}`);
    throw ApiError.internal();
  }
});

export default caseRouter;
