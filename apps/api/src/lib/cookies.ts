import type { Request, Response } from "express";
import { env } from "@repo/utils";

const COOKIE_NAME = "refresh_token";
const COOKIE_PATH = "/api/v1/auth";
const MAX_AGE_MS = env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Minimal cookie reader so the API does not need an extra dependency. */
export const readCookie = (req: Request, name: string): string | null => {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (rawKey?.trim() === name) return decodeURIComponent(rest.join("=").trim());
  }

  return null;
};

export const readRefreshCookie = (req: Request): string | null => readCookie(req, COOKIE_NAME);

export const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: MAX_AGE_MS,
  });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: COOKIE_PATH,
  });
};
