import type { Prisma, PrismaClient } from "@prisma/client";
import type { RuleConfigMap, RuleKey } from "./types";
import { buildGraphEdges, caseGraph, runRiskEngine } from "./index";
import { loadEngineData } from "./loadData";
import { writeAudit, AUDIT_ACTIONS } from "../../lib/audit";

export async function loadRuleConfig(prisma: PrismaClient, orgId: string): Promise<RuleConfigMap> {
  const rows = await prisma.ruleConfig.findMany({ where: { orgId } });
  const cfg: RuleConfigMap = {};
  for (const r of rows) {
    cfg[r.ruleKey as RuleKey] = {
      enabled: r.enabled,
      weight: r.weight,
      params: (r.params ?? {}) as Record<string, number>,
    };
  }
  return cfg;
}

const labelOfEntity = (
  data: Awaited<ReturnType<typeof loadEngineData>>,
  type: string,
  id: string,
): string => {
  if (type === "VENDOR") {
    const vendor = data.vendors.find((v) => v.id === id);
    return vendor ? `${vendor.ref} (${vendor.name})` : id;
  }
  if (type === "EMPLOYEE") {
    const employee = data.employees.find((e) => e.id === id);
    return employee ? `${employee.ref} (${employee.name})` : id;
  }
  if (type === "BANK_ACCOUNT") {
    const account = data.bankAccounts.find((a) => a.id === id);
    return account ? `Account ${account.ref}` : id;
  }
  if (type === "INVOICE") {
    return data.invoices.find((i) => i.id === id)?.ref ?? id;
  }
  if (type === "PO") {
    return data.purchaseOrders.find((p) => p.id === id)?.ref ?? id;
  }
  return id;
};

/**
 * Executes one analysis run. Idempotent per runId: a retried job deletes any
 * rows from an earlier attempt before writing. Reads the rule config from
 * `run.ruleSnapshot` so a past run stays reproducible after rules change.
 */
export async function runAnalysis(prisma: PrismaClient, runId: string) {
  const run = await prisma.analysisRun.findUnique({
    where: { id: runId },
    include: { dataset: { include: { engagement: { select: { orgId: true } } } } },
  });
  if (!run) throw new Error(`AnalysisRun ${runId} not found`);

  const orgId = run.dataset.engagement.orgId;

  await prisma.analysisRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: new Date(), error: null },
  });

  try {
    const data = await loadEngineData(prisma, run.datasetId);
    const config = (run.ruleSnapshot ?? {}) as RuleConfigMap;
    const result = runRiskEngine(data, { config });
    const edges = buildGraphEdges(data);

    await prisma.$transaction(
      async (tx) => {
        await tx.riskSignal.deleteMany({ where: { runId } });
        await tx.case.deleteMany({ where: { runId } });

        const dbCaseId = new Map<string, string>();

        for (const c of result.cases) {
          const primaryLabel = labelOfEntity(data, c.primaryEntity.type, c.primaryEntity.id);

          const row = await tx.case.create({
            data: {
              engagementId: run.dataset.engagementId,
              runId,
              code: c.id,
              title: c.title.slice(0, 500),
              primaryEntityType: c.primaryEntity.type,
              primaryEntityId: c.primaryEntity.id,
              primaryEntityLabel: primaryLabel.slice(0, 300),
              entities: c.entities as unknown as Prisma.InputJsonValue,
              riskScore: Math.round(c.riskScore),
              severity: c.severity,
              exposureAmount: c.exposureAmount,
              priority: c.priority,
              signalCount: c.signalIds.length,
              scoreBreakdown: c.scoreBreakdown as unknown as Prisma.InputJsonValue,
              graph: caseGraph(data, edges, c, result.signals) as unknown as Prisma.InputJsonValue,
            },
          });

          dbCaseId.set(c.id, row.id);
        }

        const rows = result.signals.map((s) => ({
          runId,
          caseId: s.caseId ? dbCaseId.get(s.caseId) ?? null : null,
          ruleKey: s.ruleKey,
          category: s.category,
          severity: s.severity,
          weight: s.weight,
          title: s.title.slice(0, 500),
          entityType: s.entityType,
          entityId: s.entityId,
          vendorId: s.entities.find((e) => e.type === "VENDOR")?.id ?? null,
          entities: s.entities,
          invoiceIds: s.invoiceIds,
          exposureAmount: s.exposureAmount,
          evidence: s.evidence,
        }));

        for (let i = 0; i < rows.length; i += 1000) {
          await tx.riskSignal.createMany({
            data: rows.slice(i, i + 1000) as unknown as Prisma.RiskSignalCreateManyInput[],
          });
        }
      },
      { timeout: 120_000 },
    );

    await prisma.analysisRun.update({
      where: { id: runId },
      data: { status: "COMPLETED", finishedAt: new Date(), summary: result.summary as unknown as Prisma.InputJsonValue },
    });

    await writeAudit(prisma, {
      orgId,
      userId: run.triggeredById,
      action: AUDIT_ACTIONS.RUN_COMPLETED,
      entityType: "AnalysisRun",
      entityId: runId,
      meta: { cases: result.summary.caseCount, signals: result.summary.signalCount },
    });

    return result.summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";

    await prisma.analysisRun.update({
      where: { id: runId },
      data: { status: "FAILED", finishedAt: new Date(), error: message.slice(0, 500) },
    });

    await writeAudit(prisma, {
      orgId,
      userId: run.triggeredById,
      action: AUDIT_ACTIONS.RUN_FAILED,
      entityType: "AnalysisRun",
      entityId: runId,
      meta: { message: message.slice(0, 200) },
    });

    throw error;
  }
}
