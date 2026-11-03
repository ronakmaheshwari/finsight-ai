import { MulterError } from "multer";
import { ApiError } from "@repo/utils";
import type { NextFunction, Request, Response } from "express";

/**
 * Catches every unmatched route and forwards a typed `ApiError`.
 */
const notFoundMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Single place that turns thrown errors into the standard JSON body.
 *
 * Multer failures are mapped here too: an oversized file is `413`, a rejected
 * file type or any other upload problem is `400` (§8.9).
 */
const errorMiddleware = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response => {
  if (error instanceof MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        error: { code: "PAYLOAD_TOO_LARGE", message: "The uploaded file is too large" },
      });
    }

    return res.status(400).json({
      success: false,
      error: { code: "INVALID_UPLOAD", message: error.message },
    });
  }

  if (error instanceof Error && /Only CSV and XLSX files are allowed/.test(error.message)) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_FILE_TYPE", message: error.message },
    });
  }

  const apiError = ApiError.from(error);

  if (apiError.statusCode >= 500) {
    console.error(`Unhandled API error [${apiError.code}]:`, error);
  }

  return res.status(apiError.statusCode).json(apiError.toJSON());
};

export { errorMiddleware, notFoundMiddleware };
