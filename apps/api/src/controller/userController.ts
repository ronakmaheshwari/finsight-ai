import { type Request, type Response, Router } from "express";
import db from "@repo/db";
import {
  createUserSchema,
  updateUserSchema,
  userListQuerySchema,
  idParamSchema,
} from "@repo/shared";
import { ApiError, hashPassword } from "@repo/utils";
import userMiddleware from "../middleware/userMiddleware";
import { requireRole } from "../middleware/requireRole";
import { AUDIT_ACTIONS, audit } from "../lib/audit";
import { getPaging, pageMeta } from "../lib/pagination";

const userRouter: Router = Router();

const toUserRow = (user: {
  id: string;
  name: string;
  email: string;
  role: string;
  userStatus: string;
  createdAt: Date;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.userStatus === "ACTIVE",
  createdAt: user.createdAt.toISOString(),
});

userRouter.get("/", userMiddleware, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const parsed = userListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid query");
    }

    const paging = getPaging(parsed.data);
    const where = {
      orgId: req.user.orgId,
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.isActive
        ? { userStatus: parsed.data.isActive === "true" ? ("ACTIVE" as const) : { not: "ACTIVE" as const } }
        : {}),
      ...(parsed.data.q
        ? {
            OR: [
              { name: { contains: parsed.data.q, mode: "insensitive" as const } },
              { email: { contains: parsed.data.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: paging.skip,
        take: paging.take,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          userStatus: true,
          createdAt: true,
        },
      }),
    ]);

    return res.status(200).json({ success: true, data: users.map(toUserRow), meta: pageMeta(total, paging) });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while listing users: ${error}`);
    throw ApiError.internal();
  }
});

userRouter.get(
  "/directory",
  userMiddleware,
  requireRole("ADMIN", "MANAGER"),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) throw ApiError.unauthorized();

      const users = await db.user.findMany({
        where: { orgId: req.user.orgId, userStatus: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, role: true },
      });

      return res.status(200).json({ success: true, data: users });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error(`Error took place while reading the user directory: ${error}`);
      throw ApiError.internal();
    }
  },
);

userRouter.post("/", userMiddleware, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid user");
    }

    const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) throw ApiError.emailAlreadyExists();

    const password = await hashPassword(parsed.data.password);

    const user = await db.user.create({
      data: {
        orgId: req.user.orgId,
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        password,
        userStatus: "ACTIVE",
      },
    });

    await audit({
      orgId: req.user.orgId,
      userId: req.user.userId,
      action: AUDIT_ACTIONS.USER_CREATED,
      entityType: "User",
      entityId: user.id,
      meta: { role: user.role },
      ip: req.ip ?? null,
    });

    return res.status(201).json({ success: true, data: toUserRow(user) });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while creating a user: ${error}`);
    throw ApiError.internal();
  }
});

userRouter.patch("/:id", userMiddleware, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const params = idParamSchema.safeParse(req.params);
    if (!params.success) throw ApiError.badRequest("Invalid user id");

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid update");
    }

    const target = await db.user.findUnique({ where: { id: params.data.id } });
    if (!target || target.orgId !== req.user.orgId) throw ApiError.notFound("User not found");

    const isSelf = target.id === req.user.userId;
    if (isSelf && parsed.data.role && parsed.data.role !== target.role) {
      throw ApiError.badRequest("You cannot change your own role");
    }
    if (isSelf && parsed.data.isActive === false) {
      throw ApiError.badRequest("You cannot deactivate yourself");
    }

    const password = parsed.data.password ? await hashPassword(parsed.data.password) : undefined;

    const updated = await db.user.update({
      where: { id: target.id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.role ? { role: parsed.data.role } : {}),
        ...(parsed.data.isActive !== undefined
          ? { userStatus: parsed.data.isActive ? "ACTIVE" : "INACTIVE" }
          : {}),
        ...(password ? { password } : {}),
      },
    });

    if (parsed.data.role && parsed.data.role !== target.role) {
      await audit({
        orgId: req.user.orgId,
        userId: req.user.userId,
        action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
        entityType: "User",
        entityId: target.id,
        meta: { from: target.role, to: parsed.data.role },
        ip: req.ip ?? null,
      });
    }

    return res.status(200).json({ success: true, data: toUserRow(updated) });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while updating a user: ${error}`);
    throw ApiError.internal();
  }
});

export default userRouter;
