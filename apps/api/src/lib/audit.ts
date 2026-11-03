import type { Prisma, PrismaClient } from "@prisma/client";
import db from "@repo/db";

/** Every action name the API writes (Appendix D). */
export const AUDIT_ACTIONS = {
  AUTH_LOGIN: "AUTH_LOGIN",
  USER_CREATED: "USER_CREATED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  ENGAGEMENT_CREATED: "ENGAGEMENT_CREATED",
  DATASET_CREATED: "DATASET_CREATED",
  DATASET_UPLOADED: "DATASET_UPLOADED",
  DATASET_VALIDATED: "DATASET_VALIDATED",
  DATASET_DELETED: "DATASET_DELETED",
  RUN_QUEUED: "RUN_QUEUED",
  RUN_COMPLETED: "RUN_COMPLETED",
  RUN_FAILED: "RUN_FAILED",
  CASE_STATUS_CHANGED: "CASE_STATUS_CHANGED",
  CASE_ASSIGNED: "CASE_ASSIGNED",
  CASE_DECIDED: "CASE_DECIDED",
  CASE_NOTE_ADDED: "CASE_NOTE_ADDED",
  AI_INVESTIGATION_REQUESTED: "AI_INVESTIGATION_REQUESTED",
  AI_INVESTIGATION_GENERATED: "AI_INVESTIGATION_GENERATED",
  AI_INVESTIGATION_REVIEWED: "AI_INVESTIGATION_REVIEWED",
  RULE_UPDATED: "RULE_UPDATED",
  EXPORT_GENERATED: "EXPORT_GENERATED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditInput {
  orgId: string;
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
}

type AuditClient = PrismaClient | Prisma.TransactionClient;

/**
 * Best effort by design: an audit write must never fail the request it
 * describes. Never put row contents, tokens or secrets in `meta`.
 */
export const writeAudit = async (client: AuditClient, input: AuditInput): Promise<void> => {
  try {
    await client.auditLog.create({
      data: {
        orgId: input.orgId,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: input.ip ?? null,
      },
    });
  } catch (error) {
    console.error(`Audit write failed for ${input.action}: ${error}`);
  }
};

/** Convenience overload for routes that do not need a transaction client. */
export const audit = (input: AuditInput): Promise<void> => writeAudit(db, input);
