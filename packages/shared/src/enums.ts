/**
 * Enum mirrors of the Prisma enums.
 *
 * The web app must not import `@prisma/client`, so the string unions live here
 * and are reused by the API, the validators and the UI. Keep them in sync with
 * `packages/db/prisma/schema.prisma`.
 */

export const ROLES = ["ADMIN", "MANAGER", "ANALYST", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CASE_STATUSES = [
  "OPEN",
  "IN_REVIEW",
  "ESCALATED",
  "DISMISSED",
  "CONFIRMED",
  "CLOSED",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const DECIDED_STATUSES: readonly CaseStatus[] = ["CONFIRMED", "DISMISSED", "CLOSED"];

export const ENTITY_TYPES = [
  "EMPLOYEE",
  "VENDOR",
  "BANK_ACCOUNT",
  "TRANSACTION",
  "INVOICE",
  "PO",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const RUN_STATUSES = ["QUEUED", "RUNNING", "COMPLETED", "FAILED"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const DATASET_STATUSES = ["UPLOADED", "VALIDATING", "VALIDATED", "FAILED"] as const;
export type DatasetStatus = (typeof DATASET_STATUSES)[number];

export const RULE_CATEGORIES = ["ANOMALY", "RELATIONSHIP", "CONTROL"] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const AI_JOB_STATUSES = ["QUEUED", "RUNNING", "COMPLETED", "FAILED"] as const;
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];

export const AI_REVIEW_STATUSES = ["PENDING", "ACCEPTED", "EDITED", "REJECTED"] as const;
export type AiReviewStatus = (typeof AI_REVIEW_STATUSES)[number];

/** `NONE` is a UI-only state meaning "no investigation requested yet". */
export type AiStatus = "NONE" | AiJobStatus;

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  OPEN: "Open",
  IN_REVIEW: "In review",
  ESCALATED: "Escalated for senior review",
  CONFIRMED: "Risk confirmed, follow-up required",
  DISMISSED: "Dismissed, explained or false positive",
  CLOSED: "Closed",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};
