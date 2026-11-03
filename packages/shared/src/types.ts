import type {
  AiJobStatus,
  AiReviewStatus,
  CaseStatus,
  EntityType,
  Role,
  RuleCategory,
  RunStatus,
  Severity,
  DatasetStatus,
} from "./enums";
import type { InvestigationOutput } from "./schemas";
import type { RuleKey } from "./ruleCatalog";

/** Response envelope shared by every endpoint (§3.3). */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PageMeta;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export interface AuthUserView {
  id: string;
  name: string;
  email: string;
  role: Role;
  orgId: string;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface EngagementRow {
  id: string;
  clientName: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  datasetCount: number;
  openCaseCount: number;
  createdAt: string;
}

export interface EntityRef {
  type: EntityType;
  id: string;
}

export interface Evidence {
  explanation: string;
  observed: Record<string, unknown>;
  threshold: Record<string, unknown>;
  recordIds: string[];
  recordRefs: string[];
}

export interface ScoreLine {
  ruleKey: RuleKey;
  weight: number;
  severity: Severity;
  signalCount: number;
  strength: number;
  points: number;
}

export interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  flagged: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated?: boolean;
}

export interface SignalRow {
  id: string;
  ruleKey: string;
  category: RuleCategory;
  severity: Severity;
  weight: number;
  title: string;
  entityType: EntityType;
  entityId: string;
  caseId: string | null;
  caseCode: string | null;
  exposureAmount: number | null;
  evidence: Evidence;
}

export interface CaseListRow {
  id: string;
  code: string;
  title: string;
  primaryEntityType: EntityType;
  primaryEntityLabel: string;
  riskScore: number;
  severity: Severity;
  exposureAmount: number;
  signalCount: number;
  status: CaseStatus;
  assignedTo: { id: string; name: string } | null;
  aiStatus: AiJobStatus | "NONE";
  aiReviewStatus?: AiReviewStatus;
  createdAt: string;
}

export interface RunSummaryView {
  id: string;
  status: RunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  summary: Record<string, unknown> | null;
  error: string | null;
  dataset: { id: string; name: string; engagementId: string };
}

export interface InvestigationView {
  status: AiJobStatus;
  error: string | null;
  model: string | null;
  promptVersion: string | null;
  reviewStatus: AiReviewStatus;
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
  output: InvestigationOutput | null;
  edited: boolean;
  original: InvestigationOutput | null;
  createdAt: string | null;
  /** True when no investigation has ever been requested for the case. */
  notRequested?: boolean;
}

export interface DashboardView {
  runId: string;
  runFinishedAt: string | null;
  kpis: {
    casesTotal: number;
    casesBySeverity: Record<Severity, number>;
    openCases: number;
    totalExposure: number;
    confirmedExposure: number;
    dismissedCount: number;
    flaggedInvoices: number;
    populationInvoices: number;
    flaggedPct: number;
    estimatedHoursSaved: number;
  };
  riskByMonth: { month: string; flaggedInvoices: number; exposure: number }[];
  topVendors: { vendorId: string; ref: string; name: string; maxScore: number; exposure: number }[];
  ruleBreakdown: { ruleKey: string; count: number }[];
  recentCases: CaseListRow[];
}

export interface RuleParamView {
  value: number;
  default: number;
  min: number;
  max: number;
  step: number;
  label: string;
}

export interface RuleView {
  ruleKey: RuleKey;
  label: string;
  category: RuleCategory;
  description: string;
  enabled: boolean;
  weight: number;
  defaultWeight: number;
  params: Record<string, RuleParamView>;
}

export interface AuditRow {
  id: string;
  createdAt: string;
  user: { id: string; name: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
}

/* -------------------------------------------------------------------------- */
/* Views not covered by the lists above                                       */
/* -------------------------------------------------------------------------- */

export interface EngagementDetail {
  id: string;
  clientName: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  datasetCount: number;
  caseCount: number;
  members: { id: string; name: string; email: string; role: Role }[];
  latestRun: { id: string; status: RunStatus; finishedAt: string | null; summary: Record<string, unknown> | null } | null;
}

export interface DatasetRow {
  id: string;
  name: string;
  status: DatasetStatus;
  rowCounts: Record<string, number> | null;
  createdAt: string;
  uploadedBy: { id: string; name: string };
  latestRun: { id: string; status: RunStatus; finishedAt: string | null } | null;
}

export interface DatasetRunRow {
  id: string;
  status: RunStatus;
  finishedAt: string | null;
  summary: Record<string, unknown> | null;
  createdAt: string;
}

export interface ValidationIssueView {
  code: string;
  message: string;
}

export interface DatasetValidationView {
  status: "VALIDATED" | "FAILED";
  errors: ValidationIssueView[];
  warnings: ValidationIssueView[];
  info: ValidationIssueView[];
  stats: {
    invoices: number;
    vendors: number;
    employees: number;
    dateRange: { from: string | null; to: string | null };
    invoiceTotal: number;
    paymentTotal: number;
  };
}

export interface DatasetDetail {
  id: string;
  name: string;
  status: DatasetStatus;
  rowCounts: Record<string, number> | null;
  validationErrors: unknown;
  createdAt: string;
  engagement: { id: string; title: string; clientName: string };
  runs: DatasetRunRow[];
}

export interface UploadResultView {
  entity: string;
  inserted: number;
  rowCounts: Record<string, number>;
}

export interface RowFailureView {
  row: number;
  errors: string[];
}

export interface RunRow {
  id: string;
  status: RunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  summary: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
}

export interface CaseDetail {
  id: string;
  code: string;
  title: string;
  primaryEntityType: EntityType;
  primaryEntityId: string;
  primaryEntityLabel: string;
  entities: EntityRef[];
  riskScore: number;
  severity: Severity;
  exposureAmount: number;
  priority: number;
  signalCount: number;
  status: CaseStatus;
  decisionReason: string | null;
  decidedAt: string | null;
  decidedBy: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
  scoreBreakdown: ScoreLine[];
  graph: GraphPayload | null;
  createdAt: string;
  updatedAt: string;
  run: { id: string; finishedAt: string | null };
  signals: SignalRow[];
  notes: { id: string; body: string; author: { id: string; name: string }; createdAt: string }[];
  ai: { status: AiJobStatus; reviewStatus: AiReviewStatus } | null;
}

export interface RunStatsView {
  amountHistogram: { from: number; to: number; count: number }[];
  benford: { n: number; chiSquare: number; observed: number[]; expected: number[] };
  monthlyVolume: { month: string; count: number; amount: number; flaggedCount: number }[];
  vendorScatter: {
    vendorRef: string;
    name: string;
    invoiceCount: number;
    meanAmount: number;
    maxAmount: number;
    flagged: boolean;
  }[];
}

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface DatasetTemplateEntity {
  entity: string;
  required: boolean;
  columns: { key: string; required: boolean; type: string; description: string; example: string }[];
}

