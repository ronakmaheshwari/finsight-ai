import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ApiError } from "@repo/utils";

/** Role gate used after `userMiddleware`. The server is always the authority. */
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(ApiError.forbidden());
      return;
    }

    next();
  };

export const forbidViewer = (req: Request): void => {
  if (req.user?.role === "VIEWER") {
    throw ApiError.forbidden();
  }
};
