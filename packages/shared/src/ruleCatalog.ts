import type { RuleCategory } from "./enums";

export const RULE_KEYS = [
  "DUPLICATE_INVOICE",
  "AMOUNT_OUTLIER",
  "JUST_BELOW_LIMIT",
  "ROUND_AMOUNT",
  "BENFORD_DEVIATION",
  "NEW_VENDOR_HIGH_VALUE",
  "VELOCITY_SPIKE",
  "INVOICE_PO_MISMATCH",
  "SELF_APPROVAL",
  "SHARED_BANK_ACCOUNT",
  "SHARED_ADDRESS_PHONE",
  "WEEKEND_OFFHOURS",
] as const;

export type RuleKey = (typeof RULE_KEYS)[number];

export interface RuleParamDefinition {
  label: string;
  default: number;
  min: number;
  max: number;
  step: number;
}

export interface RuleCatalogEntry {
  ruleKey: RuleKey;
  label: string;
  category: RuleCategory;
  description: string;
  defaultWeight: number;
  params: Record<string, RuleParamDefinition>;
}

export const WEIGHT_MIN = 1;
export const WEIGHT_MAX = 50;

export const RULE_CATALOG: Record<RuleKey, RuleCatalogEntry> = {
  DUPLICATE_INVOICE: {
    ruleKey: "DUPLICATE_INVOICE",
    label: "Duplicate invoice",
    category: "ANOMALY",
    description: "Same vendor, amount and invoice number close together in time.",
    defaultWeight: 25,
    params: {
      windowDays: { label: "Window (days)", default: 7, min: 1, max: 60, step: 1 },
    },
  },
  AMOUNT_OUTLIER: {
    ruleKey: "AMOUNT_OUTLIER",
    label: "Amount outlier",
    category: "ANOMALY",
    description: "Invoice amount far above the vendor's own history.",
    defaultWeight: 15,
    params: {
      zScore: { label: "Z-score", default: 3, min: 1.5, max: 6, step: 0.1 },
      minHistory: { label: "Minimum history", default: 5, min: 3, max: 50, step: 1 },
      minRatio: { label: "Minimum ratio", default: 2, min: 1.2, max: 10, step: 0.1 },
      fenceMultiplier: { label: "Fence multiplier", default: 3, min: 1.5, max: 6, step: 0.1 },
    },
  },
  JUST_BELOW_LIMIT: {
    ruleKey: "JUST_BELOW_LIMIT",
    label: "Approval-limit avoidance",
    category: "CONTROL",
    description: "Repeated invoices parked just below an approver's limit.",
    defaultWeight: 20,
    params: {
      lowerPct: { label: "Lower bound (% of limit)", default: 0.95, min: 0.8, max: 0.99, step: 0.01 },
      minOccurrences: { label: "Minimum occurrences", default: 3, min: 2, max: 20, step: 1 },
    },
  },
  ROUND_AMOUNT: {
    ruleKey: "ROUND_AMOUNT",
    label: "Round amounts",
    category: "ANOMALY",
    description: "Unusually many round-number invoices from one vendor.",
    defaultWeight: 8,
    params: {
      multiple: { label: "Multiple", default: 1000, min: 100, max: 10000, step: 100 },
      minInvoices: { label: "Minimum invoices", default: 10, min: 5, max: 100, step: 1 },
      minShare: { label: "Minimum share", default: 0.5, min: 0.2, max: 0.9, step: 0.05 },
      largeThreshold: { label: "Large threshold", default: 100000, min: 0, max: 10000000, step: 1000 },
    },
  },
  BENFORD_DEVIATION: {
    ruleKey: "BENFORD_DEVIATION",
    label: "Benford deviation",
    category: "ANOMALY",
    description: "First-digit distribution departs from Benford's law.",
    defaultWeight: 10,
    params: {
      minInvoices: { label: "Minimum invoices", default: 50, min: 30, max: 1000, step: 10 },
      chiSquareCritical: { label: "Chi-square critical", default: 20.09, min: 15, max: 30, step: 0.01 },
    },
  },
  NEW_VENDOR_HIGH_VALUE: {
    ruleKey: "NEW_VENDOR_HIGH_VALUE",
    label: "New vendor, high value",
    category: "ANOMALY",
    description: "A recently created vendor receiving unusually large invoices.",
    defaultWeight: 15,
    params: {
      maxAgeDays: { label: "Maximum vendor age (days)", default: 30, min: 7, max: 180, step: 1 },
      percentile: { label: "Amount percentile", default: 0.9, min: 0.7, max: 0.99, step: 0.01 },
    },
  },
  VELOCITY_SPIKE: {
    ruleKey: "VELOCITY_SPIKE",
    label: "Velocity spike",
    category: "ANOMALY",
    description: "A burst of invoices far above a vendor's normal weekly rate.",
    defaultWeight: 12,
    params: {
      multiplier: { label: "Multiplier", default: 3, min: 1.5, max: 10, step: 0.5 },
      minCount: { label: "Minimum count", default: 4, min: 2, max: 30, step: 1 },
      minBaselineWeeks: { label: "Minimum baseline weeks", default: 12, min: 4, max: 52, step: 1 },
    },
  },
  INVOICE_PO_MISMATCH: {
    ruleKey: "INVOICE_PO_MISMATCH",
    label: "Invoice / PO mismatch",
    category: "CONTROL",
    description: "Invoice amount differs from its purchase order, or there is no PO.",
    defaultWeight: 20,
    params: {
      tolerancePct: { label: "Tolerance", default: 0.1, min: 0.01, max: 0.5, step: 0.01 },
      highPct: { label: "High severity threshold", default: 0.2, min: 0.05, max: 1, step: 0.05 },
    },
  },
  SELF_APPROVAL: {
    ruleKey: "SELF_APPROVAL",
    label: "Self-approval",
    category: "RELATIONSHIP",
    description: "An employee approved an invoice or PO for a vendor they created.",
    defaultWeight: 25,
    params: {},
  },
  SHARED_BANK_ACCOUNT: {
    ruleKey: "SHARED_BANK_ACCOUNT",
    label: "Shared bank account",
    category: "RELATIONSHIP",
    description: "A vendor and an employee (or two vendors) use the same bank account.",
    defaultWeight: 30,
    params: {},
  },
  SHARED_ADDRESS_PHONE: {
    ruleKey: "SHARED_ADDRESS_PHONE",
    label: "Shared address or phone",
    category: "RELATIONSHIP",
    description: "A vendor and an employee share an address or phone number.",
    defaultWeight: 22,
    params: {
      minAddressLength: { label: "Minimum address length", default: 8, min: 4, max: 30, step: 1 },
      minPhoneDigits: { label: "Minimum phone digits", default: 7, min: 5, max: 15, step: 1 },
    },
  },
  WEEKEND_OFFHOURS: {
    ruleKey: "WEEKEND_OFFHOURS",
    label: "Weekend / off-hours posting",
    category: "CONTROL",
    description: "Payments posted on weekends or outside normal hours.",
    defaultWeight: 6,
    params: {
      percentile: { label: "Hour percentile", default: 0.9, min: 0.7, max: 0.99, step: 0.01 },
    },
  },
};

export const RULE_LIST: RuleCatalogEntry[] = RULE_KEYS.map((key) => RULE_CATALOG[key]);

export const isRuleKey = (value: string): value is RuleKey =>
  (RULE_KEYS as readonly string[]).includes(value);

export const defaultParamsOf = (ruleKey: RuleKey): Record<string, number> => {
  const params = RULE_CATALOG[ruleKey].params;
  return Object.fromEntries(Object.entries(params).map(([key, def]) => [key, def.default]));
};