import type { NextFunction, Request, Response } from "express";
import { ApiError } from "@repo/utils";

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Defaults to the client IP. Use a custom key for per-user limits. */
  keyOf?: (req: Request) => string;
}

const buckets = new Map<string, Bucket>();

/**
 * Small in-process fixed-window limiter. Good enough for a single API instance
 * and for the demo; swap for a Redis store when the API is horizontally scaled.
 */
export const rateLimit = ({ windowMs, max, keyOf }: RateLimitOptions) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = keyOf ? keyOf(req) : (req.ip ?? "unknown");
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;

    if (bucket.count > max) {
      next(ApiError.tooManyRequests());
      return;
    }

    next();
  };
};

export const userKey = (req: Request): string => req.user?.userId ?? req.ip ?? "unknown";
