import type { CaseStatus, Role, Severity } from "@repo/shared";

/** Severity is never communicated by colour alone: every badge has an icon and a label. */
export const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

/** Deep red / orange / amber / slate-blue. All pass WCAG AA on the tinted background. */
export const SEVERITY_CLASS: Record<Severity, string> = {
  CRITICAL: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  HIGH: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200",
  MEDIUM: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  LOW: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
};

export const SEVERITY_BAR: Record<Severity, string> = {
  CRITICAL: "bg-red-700 dark:bg-red-500",
  HIGH: "bg-orange-600 dark:bg-orange-400",
  MEDIUM: "bg-amber-500 dark:bg-amber-400",
  LOW: "bg-sky-600 dark:bg-sky-400",
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
  OPEN: "border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  IN_REVIEW: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  ESCALATED: "border-purple-300 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200",
  DISMISSED: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  CONFIRMED: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  CLOSED: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
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
