import { InvestigationOutputSchema, type InvestigationOutput } from "@repo/shared";
import { checkLanguage } from "./languageRules";
import { findUnknownAliases, unmaskValue, type MaskContext } from "./mask";

export type ValidationResult =
  | { ok: true; output: InvestigationOutput }
  | { ok: false; reason: string };

/**
 * Guardrails (§9.4.7): schema, citations, forbidden language, invented aliases.
 * Only after all four pass is the output unmasked and its S-ids mapped to the
 * real database signal ids that the API and UI use.
 */
export const validateInvestigation = (
  raw: unknown,
  context: MaskContext,
  signalIdByAlias: Map<string, string>,
): ValidationResult => {
  const parsed = InvestigationOutputSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, reason: "SCHEMA_VIOLATION" };
  }

  const output = parsed.data;

  for (const finding of output.keyFindings) {
    for (const id of finding.evidenceSignalIds) {
      if (!signalIdByAlias.has(id)) {
        return { ok: false, reason: "CITATION_VIOLATION" };
      }
    }
  }

  const violations = checkLanguage(output);
  if (violations.length > 0) {
    return { ok: false, reason: "GUARDRAIL_VIOLATION" };
  }

  const unknown = findUnknownAliases(output, context);
  if (unknown.length > 0) {
    return { ok: false, reason: "ALIAS_VIOLATION" };
  }

  const unmasked = unmaskValue(output, context);

  const mapped: InvestigationOutput = {
    ...unmasked,
    keyFindings: unmasked.keyFindings.map((finding) => ({
      ...finding,
      evidenceSignalIds: finding.evidenceSignalIds
        .map((alias) => signalIdByAlias.get(alias))
        .filter((id): id is string => typeof id === "string"),
    })),
  };

  return { ok: true, output: mapped };
};
