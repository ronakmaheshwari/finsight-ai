import { Worker } from "bullmq";
import db from "@repo/db";
import { env } from "@repo/utils";
import { QUEUE_NAMES, redisConnection } from "./jobs/queues";
import { runAnalysis } from "./utils/riskEngine/runAnalysis";
import { investigateCase } from "./services/ai/investigate";

/**
 * Separate worker process (`npm run worker`). The API and the worker share the
 * same codebase; only the entry point differs.
 */

const STUCK_AFTER_MS = 15 * 60 * 1000;

const failStuckRuns = async (): Promise<void> => {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS);

  const result = await db.analysisRun.updateMany({
    where: { status: "RUNNING", startedAt: { lt: cutoff } },
    data: { status: "FAILED", error: "worker restarted", finishedAt: new Date() },
  });

  if (result.count > 0) {
    console.warn(`Marked ${result.count} stuck analysis run(s) as FAILED`);
  }
};

const start = async (): Promise<void> => {
  await failStuckRuns();

  const analysisWorker = new Worker(
    QUEUE_NAMES.analysis,
    async (job) => {
      const runId = String((job.data as { runId?: string }).runId ?? "");
      if (!runId) throw new Error("analysis job without runId");
      await runAnalysis(db, runId);
    },
    { connection: redisConnection(), concurrency: 1 },
  );

  const investigateWorker = new Worker(
    QUEUE_NAMES.investigate,
    async (job) => {
      const data = job.data as { caseId?: string; regenerate?: boolean };
      if (!data.caseId) throw new Error("investigate job without caseId");
      await investigateCase(data.caseId, { regenerate: Boolean(data.regenerate) });
    },
    { connection: redisConnection(), concurrency: 3 },
  );

  for (const worker of [analysisWorker, investigateWorker]) {
    worker.on("failed", (job, error) => {
      console.error(`Job ${job?.id ?? "?"} failed: ${error.message}`);
    });
  }

  console.log(`Worker started (${env.NODE_ENV})`);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`${signal} received, closing workers`);
    await Promise.all([analysisWorker.close(), investigateWorker.close()]);
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

start().catch((error) => {
  console.error(`Worker failed to start: ${error}`);
  process.exit(1);
});
