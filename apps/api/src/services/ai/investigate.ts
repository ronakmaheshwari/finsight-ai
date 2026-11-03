import db from "@repo/db";
import { env } from "@repo/utils";
import { AUDIT_ACTIONS, writeAudit } from "../../lib/audit";
import { generateInvestigation, REMINDER_MESSAGE } from "./client";
import { buildMaskedPacket } from "./packet";
import { PROMPT_VERSION } from "./prompt";
import { validateInvestigation } from "./validate";

const SAFE_ERRORS = new Set([
  "SCHEMA_VIOLATION",
  "CITATION_VIOLATION",
  "GUARDRAIL_VIOLATION",
  "ALIAS_VIOLATION",
  "MASKING_LEAK",
]);

/**
 * Runs one AI investigation job. Only the masked packet leaves the process; the
 * alias map lives in this function's memory and is never persisted or logged.
 */
export const investigateCase = async (caseId: string, options: { regenerate?: boolean } = {}) => {
  const investigation = await db.aiInvestigation.findUnique({
    where: { caseId },
    include: { case: { include: { engagement: { select: { orgId: true } } } } },
  });

  if (!investigation) throw new Error(`No investigation row for case ${caseId}`);

  const orgId = investigation.case.engagement.orgId;

  await db.aiInvestigation.update({
    where: { caseId },
    data: { status: "RUNNING", error: null },
  });

  const startedAt = Date.now();

  try {
    const masked = await buildMaskedPacket(caseId);

    if (
      !options.regenerate &&
      investigation.status === "COMPLETED" &&
      investigation.packetHash === masked.hash &&
      investigation.output
    ) {
      return investigation.output;
    }

    let result = await generateInvestigation(masked.packet);
    let validated = validateInvestigation(result.output, masked.context, masked.signalIdByAlias);

    if (!validated.ok) {
      result = await generateInvestigation(masked.packet, { reminder: REMINDER_MESSAGE });
      validated = validateInvestigation(result.output, masked.context, masked.signalIdByAlias);
    }

    if (!validated.ok) {
      throw new Error(validated.reason);
    }

    await db.aiInvestigation.update({
      where: { caseId },
      data: {
        status: "COMPLETED",
        error: null,
        output: validated.output,
        model: env.LLM_MODEL,
        promptVersion: PROMPT_VERSION,
        packetHash: masked.hash,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });

    await writeAudit(db, {
      orgId,
      userId: investigation.requestedById,
      action: AUDIT_ACTIONS.AI_INVESTIGATION_GENERATED,
      entityType: "Case",
      entityId: caseId,
      meta: {
        model: env.LLM_MODEL,
        promptVersion: PROMPT_VERSION,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs: Date.now() - startedAt,
      },
    });

    return validated.output;
  } catch (error) {
    const raw = error instanceof Error ? error.message : "LLM request failed";
    const message = SAFE_ERRORS.has(raw) ? raw : "LLM request failed";

    await db.aiInvestigation.update({
      where: { caseId },
      data: { status: "FAILED", error: message },
    });

    console.error(`Investigation failed for case ${caseId}: ${message}`);
    throw error;
  }
};
