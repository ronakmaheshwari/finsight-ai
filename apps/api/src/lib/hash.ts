import { createHash, createHmac } from "node:crypto";
import { env } from "@repo/utils";

/**
 * Bank account numbers are never stored or logged: only this HMAC leaves the
 * ingest step. Changing ACCOUNT_HASH_SECRET invalidates cross-dataset matching.
 */
export const hashAccountNumber = (accountNumber: string): string =>
  createHmac("sha256", env.ACCOUNT_HASH_SECRET)
    .update(accountNumber.trim())
    .digest("hex");

export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
