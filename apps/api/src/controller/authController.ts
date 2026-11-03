import { createHash, randomBytes } from "node:crypto";
import { type Request, type Response, Router } from "express";
import { Prisma } from "@prisma/client";
import db from "@repo/db";
import { loginSchema, registerSchema } from "@repo/shared";
import { ApiError, env, hashPassword, jwtTokenGenerator, verifyPassword } from "@repo/utils";
import userMiddleware from "../middleware/userMiddleware";
import { rateLimit } from "../middleware/rateLimit";
import { AUDIT_ACTIONS, audit } from "../lib/audit";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "../lib/cookies";

const authRouter: Router = Router();

const REFRESH_TTL_MS = env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

const issueRefreshToken = async (userId: string): Promise<string> => {
  const token = randomBytes(48).toString("hex");

  await db.jWTToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  return token;
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyOf: (req) => `${req.ip ?? "unknown"}:${String((req.body as { email?: string }).email ?? "")}`,
});

/** Five new organisations per hour per address is plenty for a real team. */
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });

const toSessionUser = (user: {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "ANALYST" | "VIEWER";
  orgId: string;
}) => ({ id: user.id, name: user.name, email: user.email, role: user.role, orgId: user.orgId });

/**
 * Self-service sign-up. Creates a brand new organisation and makes the first
 * user its ADMIN, so a new account never lands inside an existing tenant.
 */
authRouter.post("/register", registerLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid sign-up request");
    }

    const { name, organizationName, email, password } = parsed.data;

    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw ApiError.emailAlreadyExists("An account with this email already exists. Sign in instead.");
    }

    const passwordHash = await hashPassword(password);

    const user = await db.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { name: organizationName } });
      return tx.user.create({
        data: {
          orgId: organization.id,
          name,
          email,
          password: passwordHash,
          role: "ADMIN",
          userStatus: "ACTIVE",
        },
      });
    });

    const { token } = jwtTokenGenerator(user.id, user.orgId, user.name, user.email, user.role);
    const refreshToken = await issueRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

    await audit({
      orgId: user.orgId,
      userId: user.id,
      action: AUDIT_ACTIONS.USER_CREATED,
      entityType: "User",
      entityId: user.id,
      meta: { source: "self-service", organizationName },
      ip: req.ip ?? null,
    });

    return res.status(201).json({
      success: true,
      data: { accessToken: token, user: toSessionUser(user) },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw ApiError.emailAlreadyExists("An account with this email already exists. Sign in instead.");
    }
    console.error(`Error took place while registering an organisation: ${error}`);
    throw ApiError.internal();
  }
});

authRouter.post("/login", loginLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid login request");
    }

    const { email, password } = parsed.data;
    const user = await db.user.findUnique({ where: { email } });

    // Same error and roughly the same timing for an unknown email and a bad password.
    if (!user) {
      await hashPassword(password);
      throw ApiError.invalidCredentials();
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) throw ApiError.invalidCredentials();

    if (user.userStatus !== "ACTIVE") {
      throw ApiError.forbidden("This account is not active. Please contact an administrator.");
    }

    const { token } = jwtTokenGenerator(user.id, user.orgId, user.name, user.email, user.role);
    const refreshToken = await issueRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

    await audit({
      orgId: user.orgId,
      userId: user.id,
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      entityType: "User",
      entityId: user.id,
      ip: req.ip ?? null,
    });

    return res.status(200).json({
      success: true,
      data: {
        accessToken: token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, orgId: user.orgId },
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while logging a user in: ${error}`);
    throw ApiError.internal();
  }
});

authRouter.post("/refresh", async (req: Request, res: Response) => {
  try {
    const raw = readRefreshCookie(req);
    if (!raw) throw ApiError.unauthorized("No refresh token");

    const tokenHash = hashToken(raw);
    const stored = await db.jWTToken.findUnique({ where: { tokenHash } });

    if (!stored) {
      clearRefreshCookie(res);
      throw ApiError.unauthorized("Invalid refresh token");
    }

    // Reuse of a rotated token revokes the whole family.
    if (stored.revokedAt !== null) {
      await db.jWTToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      clearRefreshCookie(res);
      throw ApiError.unauthorized("Refresh token was already used");
    }

    if (stored.expiresAt <= new Date()) {
      clearRefreshCookie(res);
      throw ApiError.unauthorized("Refresh token expired");
    }

    const user = await db.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.userStatus !== "ACTIVE") {
      clearRefreshCookie(res);
      throw ApiError.unauthorized("User is not active");
    }

    await db.jWTToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    const { token } = jwtTokenGenerator(user.id, user.orgId, user.name, user.email, user.role);
    const rotated = await issueRefreshToken(user.id);
    setRefreshCookie(res, rotated);

    return res.status(200).json({
      success: true,
      data: {
        accessToken: token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, orgId: user.orgId },
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while refreshing a session: ${error}`);
    throw ApiError.internal();
  }
});

authRouter.post("/logout", userMiddleware, async (req: Request, res: Response) => {
  try {
    const raw = readRefreshCookie(req);

    if (raw) {
      await db.jWTToken.updateMany({
        where: { tokenHash: hashToken(raw), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    clearRefreshCookie(res);

    return res.status(200).json({ success: true, data: { loggedOut: true } });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while logging a user out: ${error}`);
    throw ApiError.internal();
  }
});

authRouter.get("/me", userMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const user = await db.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true, orgId: true, userStatus: true },
    });

    if (!user) throw ApiError.notFound("User not found");
    if (user.userStatus !== "ACTIVE") throw ApiError.forbidden("This account is not active");

    return res.status(200).json({
      success: true,
      data: { id: user.id, name: user.name, email: user.email, role: user.role, orgId: user.orgId },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while reading the current user: ${error}`);
    throw ApiError.internal();
  }
});

export default authRouter;
