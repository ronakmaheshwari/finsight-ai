import db from "@repo/db";
import { env } from "@repo/utils";
import {
  assertNoLeak,
  createAliasContext,
  maskValue,
  packetHash,
  type MaskContext,
} from "./mask";
import { PROMPT_VERSION } from "./prompt";

export interface MaskedPacket {
  packet: Record<string, unknown>;
  context: MaskContext;
  signalIdByAlias: Map<string, string>;
  signalAliases: Set<string>;
  omittedSignals: number;
  hash: string;
}

const MAX_SIGNALS = 40;
const MAX_SAMPLE_RECORDS = 6;
const MAX_PACKET_BYTES = 12_000;

const round2 = (value: number): number => Math.round(value * 100) / 100;
const day = (date: Date): string => date.toISOString().slice(0, 10);

const asEntities = (value: unknown): { type: string; id: string }[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is { type: string; id: string } =>
      entry !== null &&
      typeof entry === "object" &&
      typeof (entry as Record<string, unknown>).type === "string" &&
      typeof (entry as Record<string, unknown>).id === "string",
    )
    .map((entry) => ({ type: entry.type, id: entry.id }));
};

/**
 * Builds the evidence packet for one case, then masks every real name and ref.
 * The raw packet never leaves this function; the caller only receives the masked
 * version plus the in-memory alias map.
 */
export const buildMaskedPacket = async (caseId: string): Promise<MaskedPacket> => {
  const riskCase = await db.case.findUnique({
    where: { id: caseId },
    include: {
      signals: { orderBy: { weight: "desc" } },
      run: { select: { datasetId: true } },
      engagement: { select: { periodStart: true, periodEnd: true } },
    },
  });

  if (!riskCase) throw new Error(`Case ${caseId} not found`);

  const datasetId = riskCase.run.datasetId;
  const [vendors, employees, accounts] = await Promise.all([
    db.vendor.findMany({
      where: { datasetId },
      select: { id: true, externalId: true, name: true, createdAt: true },
    }),
    db.employee.findMany({
      where: { datasetId },
      select: { id: true, externalId: true, name: true, department: true, approvalLimit: true },
    }),
    db.bankAccount.findMany({
      where: { datasetId },
      select: { id: true, externalId: true, bankName: true, accountNumberHash: true },
    }),
  ]);

  const context = createAliasContext({
    vendors: vendors.map((vendor) => ({ id: vendor.id, ref: vendor.externalId, name: vendor.name })),
    employees: employees.map((employee) => ({ id: employee.id, ref: employee.externalId, name: employee.name })),
    accounts: accounts.map((account) => ({ id: account.id, ref: account.externalId, name: `Account ${account.externalId}` })),
    sensitive: accounts.map((account) => account.accountNumberHash),
  });

  const aliasOf = new Map(context.entries.map((entry) => [`${entry.kind}:${entry.id}`, entry.alias]));
  const aliasById = new Map(context.entries.map((entry) => [entry.id, entry.alias]));

  const caseEntities = asEntities(riskCase.entities);
  const vendorIds = caseEntities.filter((e) => e.type === "VENDOR").map((e) => e.id);
  const invoiceGroups = vendorIds.length
    ? await db.invoice.groupBy({
        by: ["vendorId"],
        where: { datasetId, vendorId: { in: vendorIds } },
        _count: { _all: true },
        _sum: { amount: true },
      })
    : [];
  const invoiceStats = new Map(
    invoiceGroups.map((group) => [
      group.vendorId,
      { count: group._count._all, total: Number(group._sum.amount ?? 0) },
    ]),
  );

  const entities = caseEntities.map((entity) => {
    const alias = aliasOf.get(`${entity.type}:${entity.id}`) ?? "Unknown entity";

    if (entity.type === "VENDOR") {
      const vendor = vendors.find((row) => row.id === entity.id);
      const stats = invoiceStats.get(entity.id);
      return {
        alias,
        kind: "VENDOR",
        ageDays: vendor ? Math.max(0, Math.round((Date.now() - vendor.createdAt.getTime()) / 86_400_000)) : null,
        invoiceCount: stats?.count ?? 0,
        invoiceTotal: round2(stats?.total ?? 0),
      };
    }

    if (entity.type === "EMPLOYEE") {
      const employee = employees.find((row) => row.id === entity.id);
      return {
        alias,
        kind: "EMPLOYEE",
        department: employee?.department ?? null,
        approvalLimit: employee?.approvalLimit === null || employee?.approvalLimit === undefined
          ? null
          : Number(employee.approvalLimit),
      };
    }

    if (entity.type === "BANK_ACCOUNT") {
      const account = accounts.find((row) => row.id === entity.id);
      return { alias, kind: "BANK_ACCOUNT", bankName: account?.bankName ?? null };
    }

    return { alias, kind: entity.type };
  });

  const allSignalInvoiceIds = [...new Set(riskCase.signals.flatMap((signal) => signal.invoiceIds))];
  const sampleInvoices = allSignalInvoiceIds.length
    ? await db.invoice.findMany({
        where: { id: { in: allSignalInvoiceIds.slice(0, MAX_SAMPLE_RECORDS) } },
        include: {
          vendor: { select: { externalId: true, name: true } },
          purchaseOrder: { select: { externalId: true, amount: true } },
          approvedBy: { select: { id: true, externalId: true, name: true } },
        },
      })
    : [];

  const signalIdByAlias = new Map<string, string>();
  const signals = riskCase.signals.slice(0, MAX_SIGNALS).map((signal, index) => {
    const alias = `S${index + 1}`;
    signalIdByAlias.set(alias, signal.id);
    const evidence = (signal.evidence ?? {}) as Record<string, unknown>;

    return {
      id: alias,
      rule: signal.ruleKey,
      category: signal.category,
      severity: signal.severity,
      title: signal.title,
      explanation: typeof evidence.explanation === "string" ? evidence.explanation : "",
      observed: evidence.observed ?? {},
      threshold: evidence.threshold ?? {},
      exposureAmount: signal.exposureAmount === null ? null : Number(signal.exposureAmount),
    };
  });

  const graph = (riskCase.graph ?? {}) as {
    nodes?: { id: string; label: string; type: string }[];
    edges?: { source: string; target: string; label: string }[];
  };

  const nodeAlias = new Map<string, string>();
  for (const node of graph.nodes ?? []) {
    const [, ...rest] = node.id.split(":");
    const id = rest.join(":");
    nodeAlias.set(node.id, aliasOf.get(`${node.type}:${id}`) ?? node.label);
  }

  const relationships = (graph.edges ?? []).slice(0, 40).map((edge) => ({
    from: nodeAlias.get(edge.source) ?? "Unknown entity",
    relation: edge.label,
    to: nodeAlias.get(edge.target) ?? "Unknown entity",
  }));

  const scoreBreakdown = Array.isArray(riskCase.scoreBreakdown)
    ? (riskCase.scoreBreakdown as Record<string, unknown>[])
    : [];

  const rawPacket = {
    case: {
      riskScore: riskCase.riskScore,
      severity: riskCase.severity,
      exposureAmount: Number(riskCase.exposureAmount),
      scoreBreakdown: scoreBreakdown.map((line) => ({
        rule: line.ruleKey,
        points: line.points,
        severity: line.severity,
        signals: line.signalCount,
      })),
    },
    engagement: {
      periodStart: day(riskCase.engagement.periodStart),
      periodEnd: day(riskCase.engagement.periodEnd),
    },
    signals,
    omittedSignals: Math.max(0, riskCase.signals.length - signals.length),
    entities,
    relationships,
    sampleRecords: sampleInvoices.map((invoice) => ({
      invoice: invoice.externalId,
      vendor: aliasById.get(invoice.vendorId) ?? "Unknown vendor",
      amount: round2(Number(invoice.amount)),
      date: day(invoice.invoiceDate),
      approvedBy: invoice.approvedBy ? aliasById.get(invoice.approvedBy.id) ?? "Unknown approver" : null,
      poAmount: invoice.purchaseOrder ? round2(Number(invoice.purchaseOrder.amount)) : null,
    })),
  };

  // Hard cap: drop sample records first, then the weakest signals.
  let trimmed = rawPacket;
  while (Buffer.byteLength(JSON.stringify(trimmed)) > MAX_PACKET_BYTES && trimmed.sampleRecords.length > 0) {
    trimmed = { ...trimmed, sampleRecords: trimmed.sampleRecords.slice(0, -1) };
  }

  while (Buffer.byteLength(JSON.stringify(trimmed)) > MAX_PACKET_BYTES && trimmed.signals.length > 1) {
    const dropped = trimmed.signals.length - 1;
    trimmed = {
      ...trimmed,
      signals: trimmed.signals.slice(0, -1),
      omittedSignals: trimmed.omittedSignals + 1,
    };
    if (dropped <= 0) break;
  }

  const masked = maskValue(trimmed, context);
  assertNoLeak(masked, context);

  return {
    packet: masked,
    context,
    signalIdByAlias,
    signalAliases: new Set(signalIdByAlias.keys()),
    omittedSignals: trimmed.omittedSignals,
    hash: packetHash(masked, PROMPT_VERSION, env.LLM_MODEL),
  };
};
