import type { CaseStatus } from "@prisma/client";
import { ApiError } from "@repo/utils";

const DECIDED: CaseStatus[] = ["CONFIRMED", "DISMISSED", "CLOSED"];

export const isDecidedStatus = (status: CaseStatus): boolean => DECIDED.includes(status);

/**
 * Case state machine (§7.4). Decisions (CONFIRMED/DISMISSED) and closing are
 * only reachable through `POST /cases/:id/decision`, never through PATCH.
 */
export const legalTransition = (from: CaseStatus, to: CaseStatus): boolean => {
  if (from === to) return true;

  switch (from) {
    case "OPEN":
      return to === "IN_REVIEW" || to === "ESCALATED";
    case "IN_REVIEW":
      return to === "ESCALATED" || to === "OPEN";
    case "ESCALATED":
      return to === "IN_REVIEW" || to === "OPEN";
    case "CONFIRMED":
    case "DISMISSED":
      return to === "IN_REVIEW" || to === "CLOSED";
    case "CLOSED":
      return to === "IN_REVIEW";
    default:
      return false;
  }
};

export const assertLegalTransition = (from: CaseStatus, to: CaseStatus): void => {
  if (!legalTransition(from, to)) {
    throw ApiError.conflict(`Cannot move a case from ${from} to ${to}`);
  }
};

/** PATCH may only move a case within the working statuses. */
export const assertPatchTransition = (from: CaseStatus, to: CaseStatus): void => {
  if (DECIDED.includes(to)) {
    throw ApiError.conflict("Use the decision route to confirm, dismiss or close a case");
  }
  assertLegalTransition(from, to);
};

export const DECISION_STATUSES: Record<string, CaseStatus> = {
  CONFIRMED: "CONFIRMED",
  DISMISSED: "DISMISSED",
  CLOSED: "CLOSED",
  REOPEN: "IN_REVIEW",
};

export const assertDecisionAllowed = (from: CaseStatus, decision: string): CaseStatus => {
  const to = DECISION_STATUSES[decision];
  if (!to) throw ApiError.badRequest("Unknown decision");

  if (decision === "REOPEN") {
    if (!DECIDED.includes(from)) {
      throw ApiError.conflict("Only a decided case can be reopened");
    }
    return to;
  }

  if (decision === "CLOSED") {
    if (from !== "CONFIRMED" && from !== "DISMISSED") {
      throw ApiError.conflict("Only a confirmed or dismissed case can be closed");
    }
    return to;
  }

  if (DECIDED.includes(from)) {
    throw ApiError.conflict("This case already has a decision; reopen it first");
  }

  return to;
};
