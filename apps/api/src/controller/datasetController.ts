import { type Request, type Response, Router } from "express";
import db from "@repo/db";
import {
  browseQuerySchema,
  entityParamSchema,
  idParamSchema,
} from "@repo/shared";
import { ApiError } from "@repo/utils";
import userMiddleware from "../middleware/userMiddleware";
import { forbidViewer } from "../middleware/requireRole";
import { getDatasetForUser } from "../lib/access";
import { AUDIT_ACTIONS, audit } from "../lib/audit";
import { pageMeta } from "../lib/pagination";
import { isEntity, type Entity } from "../datasets/spec";
import { buildCsvTemplate, buildTemplateWorkbook } from "../datasets/templates";
import { ingestFile } from "../datasets/ingest";
import { validateDataset } from "../datasets/validateDataset";
import { browseDataset } from "../datasets/browse";
import upload from "../utils/fileStorage";

const datasetRouter: Router = Router();

const TEMPLATE_ENTITIES = ["all", "bank-accounts", "employees", "vendors", "purchase-orders", "invoices", "transactions"] as const;

/** Registered before `/:id` routes so "templates" is never read as an id. */
datasetRouter.get("/templates/:entity", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const entity = String(req.params.entity ?? "");
    const format = String(req.query.format ?? "xlsx");

    if (!(TEMPLATE_ENTITIES as readonly string[]).includes(entity)) {
      throw ApiError.badRequest(`Unknown template "${entity}"`);
    }

    if (format === "csv") {
      if (entity === "all") throw ApiError.badRequest("CSV is not available for the full template");
      const csv = buildCsvTemplate(entity as Entity);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${entity}-template.csv"`);
      return res.status(200).send(csv);
    }

    if (format !== "xlsx") throw ApiError.badRequest('format must be "xlsx" or "csv"');

    const buffer = await buildTemplateWorkbook();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${entity === "all" ? "finsight-upload-template" : `${entity}-template`}.xlsx"`,
    );
    return res.status(200).send(buffer);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while building a template: ${error}`);
    throw ApiError.internal();
  }
});

datasetRouter.post(
  "/:id/upload/:entity",
  userMiddleware,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) throw ApiError.unauthorized();

      const datasetId = String(req.params.id ?? "");
      const entity = String(req.params.entity ?? "");

      if (!isEntity(entity)) {
        throw ApiError.badRequest(`Unknown entity "${entity}". Use a single entity, not "all"`);
      }

      if (!req.file) {
        throw ApiError.badRequest(
          'No file received. Send multipart/form-data with the file in a field named "file".',
        );
      }

      const outcome = await ingestFile(req.user, datasetId, entity, req.file);

      if (!outcome.ok) {
        return res.status(422).json({
          success: false,
          message: `${outcome.total} row(s) in the ${outcome.entity} file are invalid. Nothing was imported.`,
          entity: outcome.entity,
          inserted: 0,
          errorCount: outcome.total,
          errors: outcome.errors,
        });
      }

      await audit({
        orgId: req.user.orgId,
        userId: req.user.userId,
        action: AUDIT_ACTIONS.DATASET_UPLOADED,
        entityType: "Dataset",
        entityId: datasetId,
        meta: { entity, inserted: outcome.inserted },
        ip: req.ip ?? null,
      });

      return res.status(201).json({
        success: true,
        data: {
          entity: outcome.entity,
          inserted: outcome.inserted,
          rowCounts: outcome.rowCounts,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error(`Error took place while uploading dataset rows: ${error}`);
      throw ApiError.internal();
    }
  },
);

datasetRouter.post("/:id/validate", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    forbidViewer(req);

    const params = idParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid dataset id");

    await getDatasetForUser(req.user, params.data.id);

    const result = await validateDataset(params.data.id);

    await audit({
      orgId: req.user.orgId,
      userId: req.user.userId,
      action: AUDIT_ACTIONS.DATASET_VALIDATED,
      entityType: "Dataset",
      entityId: params.data.id,
      meta: { status: result.status, errors: result.errors.length, warnings: result.warnings.length },
      ip: req.ip ?? null,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while validating a dataset: ${error}`);
    throw ApiError.internal();
  }
});

datasetRouter.get("/:id/data/:entity", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    forbidViewer(req);

    const params = entityParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid dataset id or entity");

    const query = browseQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw ApiError.badRequest(query.error.issues[0]?.message ?? "Invalid query");
    }

    await getDatasetForUser(req.user, params.data.id);

    const result = await browseDataset(params.data.id, params.data.entity, query.data);

    return res.status(200).json({
      success: true,
      data: result.rows,
      meta: pageMeta(result.total, result.paging),
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while browsing dataset rows: ${error}`);
    throw ApiError.internal();
  }
});

datasetRouter.get("/:id", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    forbidViewer(req);

    const params = idParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid dataset id");

    const dataset = await getDatasetForUser(req.user, params.data.id);

    const runs = await db.analysisRun.findMany({
      where: { datasetId: dataset.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, finishedAt: true, summary: true, createdAt: true },
    });

    return res.status(200).json({
      success: true,
      data: {
        id: dataset.id,
        name: dataset.name,
        status: dataset.status,
        rowCounts: dataset.rowCounts,
        validationErrors: dataset.validationErrors,
        createdAt: dataset.createdAt.toISOString(),
        engagement: {
          id: dataset.engagement.id,
          title: dataset.engagement.title,
          clientName: dataset.engagement.clientName,
        },
        runs: runs.map((run) => ({ ...run, finishedAt: run.finishedAt?.toISOString() ?? null })),
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while reading a dataset: ${error}`);
    throw ApiError.internal();
  }
});

datasetRouter.delete("/:id", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    if (req.user.role !== "ADMIN" && req.user.role !== "MANAGER") {
      throw ApiError.forbidden();
    }

    const params = idParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid dataset id");

    if (req.query.confirm !== "true") {
      throw ApiError.badRequest('Add confirm=true to delete a dataset');
    }

    const dataset = await getDatasetForUser(req.user, params.data.id);

    const activeRun = await db.analysisRun.count({
      where: { datasetId: dataset.id, status: { in: ["QUEUED", "RUNNING"] } },
    });

    if (activeRun > 0) {
      throw ApiError.conflict("A run is queued or running for this dataset");
    }

    await db.dataset.delete({ where: { id: dataset.id } });

    await audit({
      orgId: req.user.orgId,
      userId: req.user.userId,
      action: AUDIT_ACTIONS.DATASET_DELETED,
      entityType: "Dataset",
      entityId: dataset.id,
      meta: { name: dataset.name },
      ip: req.ip ?? null,
    });

    return res.status(200).json({ success: true, data: { deleted: true } });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while deleting a dataset: ${error}`);
    throw ApiError.internal();
  }
});

export default datasetRouter;
