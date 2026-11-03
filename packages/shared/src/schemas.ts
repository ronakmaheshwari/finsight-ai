import { z } from "zod";
import {
  CASE_STATUSES,
  ENTITY_TYPES,
  ROLES,
} from "./enums";
import { RULE_KEYS } from "./ruleCatalog";

/**
 * Zod schemas shared by the API (request validation) and the web app (forms).
 * Every route validates its body, query and params with one of these.
 */

const cuid = z.string().min(1).max(64);
const isoDate = z.coerce.date();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const idParamSchema = z.object({ id: cuid });
export const engagementIdParamSchema = z.object({ id: cuid });
export const entityParamSchema = z.object({
  id: cuid,
  entity: z.enum(["bank-accounts", "employees", "vendors", "purchase-orders", "invoices", "transactions"]),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required").max(200),
});

export const createUserSchema = z.object({
  name: z.string().min(2).max(64).trim(),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  role: z.enum(ROLES),
  password: z.string().min(10, "Password must be at least 10 characters").max(200),
});

export const updateUserSchema = z
  .object({
    name: z.string().min(2).max(64).trim().optional(),
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(10).max(200).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field" });

export const userListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export const createEngagementSchema = z
  .object({
    clientName: z.string().min(2).max(120).trim(),
    title: z.string().min(2).max(160).trim(),
    periodStart: isoDate,
    periodEnd: isoDate,
  })
  .refine((value) => value.periodEnd >= value.periodStart, {
    message: "Period end must be on or after period start",
    path: ["periodEnd"],
  });

export const updateEngagementSchema = z
  .object({
    clientName: z.string().min(2).max(120).trim().optional(),
    title: z.string().min(2).max(160).trim().optional(),
    periodStart: isoDate.optional(),
    periodEnd: isoDate.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field" });

export const addMemberSchema = z.object({ userId: cuid });

export const createDatasetSchema = z.object({ name: z.string().min(1).max(120).trim() });

export const datasetListQuerySchema = paginationSchema;

export const browseQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  sortBy: z.string().trim().max(40).optional(),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export const signalQuerySchema = paginationSchema.extend({
  severity: z.string().trim().max(120).optional(),
  ruleKey: z.string().trim().max(60).optional(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  caseId: cuid.optional(),
  q: z.string().trim().max(120).optional(),
});

export const caseListQuerySchema = paginationSchema.extend({
  runId: cuid.optional(),
  engagementId: cuid.optional(),
  status: z.string().trim().max(200).optional(),
  severity: z.string().trim().max(200).optional(),
  assignedTo: z.string().trim().max(64).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  q: z.string().trim().max(120).optional(),
  sortBy: z.enum(["priority", "riskScore", "exposureAmount", "createdAt"]).default("priority"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const caseUpdateSchema = z
  .object({
    status: z.enum(CASE_STATUSES).optional(),
    assignedToId: cuid.nullable().optional(),
  })
  .refine((value) => value.status !== undefined || value.assignedToId !== undefined, {
    message: "Provide status or assignedToId",
  });

export const decisionSchema = z.object({
  decision: z.enum(["CONFIRMED", "DISMISSED", "CLOSED", "REOPEN"]),
  reason: z.string().min(10).max(2000).optional(),
});

export const caseNoteSchema = z.object({ body: z.string().min(1).max(4000).trim() });

export const investigateSchema = z.object({ regenerate: z.boolean().optional() }).default({});

export const InvestigationOutputSchema = z.object({
  summary: z.string().min(20).max(600),
  riskNarrative: z.string().min(20).max(1200),
  keyFindings: z
    .array(
      z.object({
        finding: z.string().min(5).max(400),
        evidenceSignalIds: z.array(z.string()).min(1),
      }),
    )
    .min(1)
    .max(6),
  alternativeExplanations: z.array(z.string().max(300)).min(1).max(4),
  recommendedSteps: z
    .array(
      z.object({
        step: z.string().min(5).max(300),
        priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
      }),
    )
    .min(1)
    .max(6),
  documentsToRequest: z.array(z.string().max(200)).max(6),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  limitations: z.string().min(5).max(500),
});

export type InvestigationOutput = z.infer<typeof InvestigationOutputSchema>;

export const reviewSchema = z.object({
  action: z.enum(["ACCEPT", "EDIT", "REJECT"]),
  editedOutput: InvestigationOutputSchema.optional(),
});

export const ruleUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    weight: z.number().int().min(1).max(50).optional(),
    params: z.record(z.string(), z.number()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field" });

export const ruleResetSchema = z.object({ ruleKey: z.string().optional() });

export const ruleKeyParamSchema = z.object({ ruleKey: z.enum(RULE_KEYS) });

export const auditQuerySchema = paginationSchema.extend({
  userId: cuid.optional(),
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const dashboardQuerySchema = z.object({ runId: cuid.optional() });
export const dashboardParamSchema = z.object({ engagementId: cuid });

export const runIdParamSchema = z.object({ id: cuid });
export const caseIdParamSchema = z.object({ id: cuid });
