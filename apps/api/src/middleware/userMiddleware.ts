import type { NextFunction, Request, Response } from "express";
import { ApiError, jwtTokenVerifier } from "@repo/utils";
import type { AuthUser } from "../lib/access";

declare module "express-serve-static-core" {
    interface Request {
        user?: AuthUser;
    }
}

/**
 * Verifies the bearer access token and attaches `{ userId, orgId, role }` to the
 * request. Every protected route starts with this middleware.
 */
const userMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            next(ApiError.unauthorized());
            return;
        }

        const token = authHeader.slice("Bearer ".length).trim();
        const decoded = jwtTokenVerifier(token);

        if (!decoded) {
            next(ApiError.unauthorized("Invalid or expired token"));
            return;
        }

        req.user = decoded;
        next();
    } catch (error) {
        console.error(`Error took place while verifying the access token: ${error}`);
        next(ApiError.internal());
    }
};

export default userMiddleware;
