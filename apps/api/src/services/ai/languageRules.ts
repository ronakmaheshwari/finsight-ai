/**
 * Definitive-accusation patterns. "Potential fraud" and "indicators consistent
 * with fraud" are allowed; stating that fraud happened is not.
 */
const FORBIDDEN_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(committed|perpetrated)\b.*\b(fraud|theft)\b/i, label: "committed fraud" },
  { pattern: /\b(is|are|was|were)\s+guilty\b/i, label: "is guilty" },
  { pattern: /\bproves?\b.*\bfraud\b/i, label: "proves fraud" },
  { pattern: /\bfraud\s+(has been|was)\s+(committed|confirmed|proven)\b/i, label: "fraud confirmed" },
  { pattern: /\bembezzle(d|ment)\b/i, label: "embezzled" },
  { pattern: /\b(stole|stolen)\b/i, label: "stole" },
  { pattern: /\btheft\s+(has been|was)\s+(committed|confirmed|proven)\b/i, label: "theft confirmed" },
];

export interface LanguageViolation {
  label: string;
  match: string;
}

/** Flattens every string in the model output and checks it against the rules. */
export const checkLanguage = (value: unknown): LanguageViolation[] => {
  const text = collectStrings(value).join("\n");
  const violations: LanguageViolation[] = [];

  for (const rule of FORBIDDEN_PATTERNS) {
    const match = text.match(rule.pattern);
    if (match) violations.push({ label: rule.label, match: match[0] });
  }

  return violations;
};

export const collectStrings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
  }
  return [];
};

export const FORBIDDEN_EXAMPLES = [
  "The vendor committed fraud.",
  "The employee is guilty.",
  "This proves fraud.",
  "Fraud was committed by the approver.",
  "The analyst embezzled the funds.",
  "They stole the money.",
];

export const ALLOWED_EXAMPLES = [
  "The indicators are consistent with potential fraud and warrant review.",
  "The pattern may suggest a control weakness; a professional must decide.",
  "This is not a finding of wrongdoing.",
];
