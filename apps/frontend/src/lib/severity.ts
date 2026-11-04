import type { CaseStatus, Role, Severity } from "@repo/shared";

/** Severity is never communicated by colour alone: every badge has an icon and a label. */
export const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

/** Deep red / orange / amber / slate-blue, all from the severity tokens. */
export const SEVERITY_CLASS: Record<Severity, string> = {
  CRITICAL: "border-critical/25 bg-critical/10 text-critical",
  HIGH: "border-high/25 bg-high/10 text-high",
  MEDIUM: "border-medium/30 bg-medium/15 text-medium",
  LOW: "border-low/25 bg-low/10 text-low",
};

export const SEVERITY_BAR: Record<Severity, string> = {
  CRITICAL: "bg-critical",
  HIGH: "bg-high",
  MEDIUM: "bg-medium",
  LOW: "bg-low",
};

/** Solid fills for the gauge and graph, where a tint would be too weak. */
export const SEVERITY_SOLID: Record<Severity, string> = {
  CRITICAL: "var(--critical)",
  HIGH: "var(--high)",
  MEDIUM: "var(--medium)",
  LOW: "var(--low)",
};

export const severityRank = (severity: Severity): number => SEVERITY_ORDER.indexOf(severity);

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  OPEN: "Open",
  IN_REVIEW: "In review",
  ESCALATED: "Escalated",
  DISMISSED: "Dismissed",
  CONFIRMED: "Risk confirmed",
  CLOSED: "Closed",
};

export const CASE_STATUS_CLASS: Record<CaseStatus, string> = {
  OPEN: "border-border bg-muted text-foreground",
  IN_REVIEW: "border-primary/25 bg-primary/10 text-primary",
  ESCALATED: "border-high/25 bg-high/10 text-high",
  DISMISSED: "border-border bg-transparent text-muted-foreground",
  CONFIRMED: "border-critical/25 bg-critical/10 text-critical",
  CLOSED: "border-positive/25 bg-positive/10 text-positive",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  MANAGER: "Manager",
  ANALYST: "Analyst",
  VIEWER: "Viewer",
};

export const ROLE_RANK: Record<Role, number> = { ADMIN: 4, MANAGER: 3, ANALYST: 2, VIEWER: 1 };

export const can = (role: Role | undefined, allowed: readonly Role[]): boolean =>
  role !== undefined && allowed.includes(role);

export const ENTITY_LABEL: Record<string, string> = {
  EMPLOYEE: "Employee",
  VENDOR: "Vendor",
  BANK_ACCOUNT: "Bank account",
  TRANSACTION: "Transaction",
  INVOICE: "Invoice",
  PO: "Purchase order",
};

export const ENTITY_COLOR: Record<string, string> = {
  EMPLOYEE: "#2563eb",
  VENDOR: "#7c3aed",
  BANK_ACCOUNT: "#0d9488",
  PO: "#64748b",
  INVOICE: "#94a3b8",
  TRANSACTION: "#0891b2",
};
