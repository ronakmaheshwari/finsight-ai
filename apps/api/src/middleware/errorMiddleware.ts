import { ApiError } from "@repo/utils";
import type { NextFunction, Request, Response } from "express";

/**
 * Catches every unmatched route and forwards a typed `ApiError`.
 */
const notFoundMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
    next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Single place that turns thrown `ApiError`s into the standard JSON body.
 */
const errorMiddleware = (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): Response => {
    const apiError = ApiError.from(error);

    if (apiError.statusCode >= 500) {
        console.error(`Unhandled API error [${apiError.code}]:`, error);
    }

    return res.status(apiError.statusCode).json(apiError.toJSON());
};

export { errorMiddleware, notFoundMiddleware };
