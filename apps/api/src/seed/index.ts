import bcrypt from "bcrypt";
import type { Prisma } from "@prisma/client";
import db from "@repo/db";
import { env } from "@repo/utils";

import { ORDER } from "../datasets/spec";
import { ingestParsedRows } from "../datasets/ingest";
import { validateDataset } from "../datasets/validateDataset";
import { resolveRuleSnapshot } from "../services/analysis/rules";
import { investigateCase } from "../services/ai/investigate";
import { runAnalysis } from "../utils/riskEngine/runAnalysis";
import { DEMO_SCENARIOS, generateDemoSheets } from "./generateDemoData";

/**
 * `npm run db:seed`
 *
 * Creates the demo organisation from scratch. Idempotent: the demo org and all
 * of its rows are removed first. Refuses to run in production.
 */

const ORG_NAME = "Demo Advisory Co";
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Demo@1234";

const USERS = [
  { email: "admin@demo.com", name: "Asha Admin", role: "ADMIN" as const },
  { email: "manager@demo.com", name: "Mohan Manager", role: "MANAGER" as const },
  { email: "analyst@demo.com", name: "Anika Analyst", role: "ANALYST" as const },
  { email: "viewer@demo.com", name: "Vikram Viewer", role: "VIEWER" as const },
];

const fail = (message: string): never => {
  throw new Error(`Seed failed: ${message}`);
};

const main = async (): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    fail("refusing to run with NODE_ENV=production");
  }

  console.log("Seeding FinSight demo data...");

  const existing = await db.organization.findFirst({ where: { name: ORG_NAME } });
  if (existing) {
    // Delete children before parents: `Dataset.uploadedBy` and
    // `AnalysisRun.triggeredBy` restrict user deletion, so the engagements
    // (and their datasets/runs/cases) must go first.
    await db.$transaction([
      db.engagement.deleteMany({ where: { orgId: existing.id } }),
      db.auditLog.deleteMany({ where: { orgId: existing.id } }),
      db.ruleConfig.deleteMany({ where: { orgId: existing.id } }),
      db.user.deleteMany({ where: { orgId: existing.id } }),
      db.organization.delete({ where: { id: existing.id } }),
    ]);
    console.log("Removed the previous demo organisation");
  }

  const org = await db.organization.create({ data: { name: ORG_NAME } });

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const users = await Promise.all(
    USERS.map((user) =>
      db.user.create({
        data: {
          orgId: org.id,
          name: user.name,
          email: user.email,
          password: passwordHash,
          role: user.role,
          userStatus: "ACTIVE",
        },
      }),
    ),
  );

  const admin = users.find((user) => user.role === "ADMIN") ?? fail("admin user missing");
  const manager = users.find((user) => user.role === "MANAGER") ?? fail("manager user missing");
  const analyst = users.find((user) => user.role === "ANALYST") ?? fail("analyst user missing");

  const engagement = await db.engagement.create({
    data: {
      orgId: org.id,
      ownerId: admin.id,
      clientName: "Demo Manufacturing Ltd",
      title: "FY2026 Procure-to-Pay Review",
      periodStart: new Date("2025-11-01T00:00:00.000Z"),
      periodEnd: new Date("2026-10-31T00:00:00.000Z"),
      members: { create: users.map((user) => ({ userId: user.id })) },
    },
  });

  const dataset = await db.dataset.create({
    data: {
      engagementId: engagement.id,
      uploadedById: admin.id,
      name: "FY26 P2P ledger",
    },
  });

  const sheets = generateDemoSheets();

  for (const entity of ORDER) {
    const sheet = sheets[entity];
    const outcome = await ingestParsedRows(dataset.id, entity, sheet.header, sheet.rows);

    if (!outcome.ok) {
      console.error(outcome.errors.slice(0, 10));
      throw new Error(`Seed failed: ${entity}: ${outcome.total} invalid row(s)`);
    }

    console.log(`  ${entity}: ${outcome.inserted} rows`);
  }

  const validation = await validateDataset(dataset.id);
  if (validation.status !== "VALIDATED") {
    console.error(validation.errors);
    throw new Error(`Seed failed: dataset validation ended as ${validation.status}`);
  }
  console.log(`  validation: ${validation.status}`);

  const ruleSnapshot = await resolveRuleSnapshot(org.id);

  const run = await db.analysisRun.create({
    data: {
      datasetId: dataset.id,
      triggeredById: admin.id,
      ruleSnapshot: ruleSnapshot as unknown as Prisma.InputJsonValue,
    },
  });

  await runAnalysis(db, run.id);

  const finished = await db.analysisRun.findUnique({ where: { id: run.id } });
  if (!finished || finished.status !== "COMPLETED") {
    throw new Error(
      `Seed failed: analysis run ended as ${finished?.status ?? "missing"}: ${finished?.error ?? ""}`,
    );
  }

  const signals = await db.riskSignal.findMany({
    where: { runId: run.id },
    select: { ruleKey: true, title: true },
  });

  for (const scenario of DEMO_SCENARIOS) {
    const found = signals.some(
      (signal) => signal.ruleKey === scenario.ruleKey && signal.title.includes(scenario.match),
    );
    if (!found) fail(`scenario ${scenario.id} (${scenario.ruleKey} / ${scenario.match}) was not detected`);
  }
  console.log(`  ${DEMO_SCENARIOS.length} planted scenarios detected`);

  /* ------------------------------- demo state ------------------------------ */

  const nearLimitCase = await db.case.findFirst({
    where: { runId: run.id, primaryEntityType: "EMPLOYEE", primaryEntityLabel: { startsWith: "E-012" } },
    orderBy: { riskScore: "desc" },
  });

  if (nearLimitCase) {
    await db.case.update({
      where: { id: nearLimitCase.id },
      data: { assignedToId: analyst.id, status: "IN_REVIEW" },
    });
  }

  const selfApprovalCase = await db.case.findFirst({
    where: { runId: run.id, primaryEntityLabel: { startsWith: "V-904" } },
    orderBy: { riskScore: "desc" },
  });

  if (selfApprovalCase) {
    await db.case.update({
      where: { id: selfApprovalCase.id },
      data: {
        status: "CONFIRMED",
        decisionReason:
          "Vendor creator also approved its invoices; no independent approval on file",
        decidedById: manager.id,
        decidedAt: new Date(),
      },
    });
  }

  /* ---------------------------- AI investigations -------------------------- */

  process.env.MOCK_LLM = "true";

  const topCases = await db.case.findMany({
    where: { runId: run.id },
    orderBy: { priority: "desc" },
    take: 3,
    select: { id: true },
  });

  for (const [index, riskCase] of topCases.entries()) {
    if (index >= 2) break; // the third stays ungenerated for the live demo

    // The row is normally created by `POST /cases/:id/investigation`; the
    // seeder calls the job directly, so it creates the row first.
    await db.aiInvestigation.upsert({
      where: { caseId: riskCase.id },
      create: { caseId: riskCase.id, requestedById: analyst.id, status: "QUEUED" },
      update: { status: "QUEUED", error: null, requestedById: analyst.id, reviewStatus: "PENDING" },
    });

    await investigateCase(riskCase.id);

    if (index === 1) {
      await db.aiInvestigation.update({
        where: { caseId: riskCase.id },
        data: { reviewStatus: "ACCEPTED", reviewedById: analyst.id, reviewedAt: new Date() },
      });
    }
  }

  const summary = finished.summary as Record<string, unknown> | null;

  console.log("\nDemo data ready.");
  console.log(`  organisation: ${ORG_NAME}`);
  console.log(`  engagement:   ${engagement.title} (${engagement.id})`);
  console.log(`  run:          ${run.id}`);
  console.log(`  cases:        ${summary?.caseCount ?? "?"}`);
  console.log(`  signals:      ${summary?.signalCount ?? "?"}`);
  console.log(`  login:        ${USERS[0]!.email} / ${SEED_PASSWORD}`);

  if (env.NODE_ENV !== "production") {
    console.log("  (all demo passwords are identical; change them before any real use)");
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
