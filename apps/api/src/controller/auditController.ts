import { type Request, type Response, Router } from "express";
import type { Prisma } from "@prisma/client";
import db from "@repo/db";
import { auditQuerySchema, type AuditRow } from "@repo/shared";
import { ApiError } from "@repo/utils";
import userMiddleware from "../middleware/userMiddleware";
import { requireRole } from "../middleware/requireRole";
import { getPaging, pageMeta } from "../lib/pagination";

const auditRouter: Router = Router();

auditRouter.get("/", userMiddleware, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const query = auditQuerySchema.safeParse(req.query);
    if (!query.success) throw ApiError.badRequest(query.error.issues[0]?.message ?? "Invalid query");

    const paging = getPaging(query.data);

    const where: Prisma.AuditLogWhereInput = { orgId: req.user.orgId };

    if (query.data.userId) where.userId = query.data.userId;
    if (query.data.action) where.action = query.data.action;
    if (query.data.entityType) where.entityType = query.data.entityType;

    if (query.data.from || query.data.to) {
      where.createdAt = {
        ...(query.data.from ? { gte: query.data.from } : {}),
        ...(query.data.to ? { lte: query.data.to } : {}),
      };
    }

    const [total, rows] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: paging.skip,
        take: paging.take,
        include: { user: { select: { id: true, name: true } } },
      }),
    ]);

    const data: AuditRow[] = rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      user: row.user,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      meta: (row.meta ?? null) as Record<string, unknown> | null,
      ip: row.ip,
    }));

    return res.status(200).json({ success: true, data, meta: pageMeta(total, paging) });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while listing audit logs: ${error}`);
    throw ApiError.internal();
  }
});

export default auditRouter;
