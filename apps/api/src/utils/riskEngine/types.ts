export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Category = "ANOMALY" | "RELATIONSHIP" | "CONTROL";
export type EntityType = "EMPLOYEE" | "VENDOR" | "BANK_ACCOUNT" | "TRANSACTION" | "INVOICE" | "PO";

export type RuleKey =
  | "DUPLICATE_INVOICE"
  | "AMOUNT_OUTLIER"
  | "JUST_BELOW_LIMIT"
  | "ROUND_AMOUNT"
  | "BENFORD_DEVIATION"
  | "NEW_VENDOR_HIGH_VALUE"
  | "VELOCITY_SPIKE"
  | "INVOICE_PO_MISMATCH"
  | "SELF_APPROVAL"
  | "SHARED_BANK_ACCOUNT"
  | "SHARED_ADDRESS_PHONE"
  | "WEEKEND_OFFHOURS";

export interface EngEmployee {
  id: string; ref: string; name: string; department?: string | null;
  approvalLimit: number | null; bankAccountId: string | null;
  address: string | null; phone: string | null;
}
export interface EngVendor {
  id: string; ref: string; name: string; taxId?: string | null;
  address: string | null; phone: string | null;
  createdAt: Date; bankAccountId: string | null;
  createdById: string | null; 
}
export interface EngBankAccount { id: string; ref: string; accountNumberHash?: string | null; bankName?: string | null }
export interface EngPO { id: string; ref: string; vendorId: string; amount: number; issuedDate: Date; approvedById: string | null }
export interface EngInvoice {
  id: string; ref: string; vendorId: string; poId: string | null; invoiceNumber: string;
  amount: number; invoiceDate: Date; approvedById: string | null;
}
export interface EngTransaction {
  id: string; ref: string; invoiceId: string | null; vendorId: string | null;
  amount: number; postedAt: Date;
}
export interface EngineData {
  employees: EngEmployee[]; vendors: EngVendor[]; bankAccounts: EngBankAccount[];
  purchaseOrders: EngPO[]; invoices: EngInvoice[]; transactions: EngTransaction[];
}

export interface EntityRef { type: EntityType; id: string }

export interface Evidence {
  explanation: string;                       // one plain sentence a reviewer (and the LLM) can read
  observed: Record<string, unknown>;         // what we saw
  threshold: Record<string, unknown>;        // what we compared it against
  recordIds: string[];                       // internal ids of the records involved
  recordRefs: string[];                      // human ids (V-001, INV-000123 ...) for display
}

export interface RawSignal {
  severity: Severity;
  title: string;
  entityType: EntityType; entityId: string;  // primary entity of the signal
  entities: EntityRef[];                     // everyone involved. VENDOR/EMPLOYEE refs decide which signals share a case
  invoiceIds: string[];
  exposureAmount: number;
  evidence: Evidence;
}

export interface RiskSignal extends RawSignal {
  id: string; ruleKey: RuleKey; category: Category; weight: number;
  caseId?: string;                           // filled in by the scorer
}

/* ---------------------------------- cases -------------------------------- */

export interface ScoreLine {
  ruleKey: RuleKey; weight: number; severity: Severity; signalCount: number;
  strength: number;   // 0..1 probability-like strength of this rule in this case
  points: number;     // share of the final score contributed by this rule (sums to riskScore)
}

export interface RiskCase {
  id: string; title: string;
  primaryEntity: EntityRef; entities: EntityRef[];
  riskScore: number;          // 0..100
  severity: Severity;         // band of the score
  exposureAmount: number;     // distinct invoices touched by the case (or the largest signal exposure)
  priority: number;           // used to order the queue: score x log10(exposure)
  signalIds: string[];
  scoreBreakdown: ScoreLine[];
}

/* ---------------------------------- config ------------------------------- */

export type Params = Record<string, number>;
export interface RuleOverride { enabled?: boolean; weight?: number; params?: Params }
export type RuleConfigMap = Partial<Record<RuleKey, RuleOverride>>;

export interface EngineOptions {
  config?: RuleConfigMap;     // e.g. rows of your RuleConfig table
  scoreScale?: number;        // default 2.5, see scorer.ts
  minScore?: number;          // cases below this score are dropped (signals are kept). default 15
  holidays?: string[];        // "yyyy-mm-dd" non-working days for WEEKEND_OFFHOURS
  minutesPerRecord?: number;  // for the hours-saved estimate. default 3
}

export interface EngineSummary {
  populationInvoices: number; signalCount: number; caseCount: number;
  casesBySeverity: Record<Severity, number>; signalsByRule: Partial<Record<RuleKey, number>>;
  flaggedInvoices: number; totalExposure: number; estimatedHoursSaved: number;
}
export interface EngineResult { signals: RiskSignal[]; cases: RiskCase[]; summary: EngineSummary }
