import { Queue } from "bullmq";
import { env } from "@repo/utils";
import db from "@repo/db";
import { runAnalysis } from "../utils/riskEngine/runAnalysis";
import { investigateCase } from "../services/ai/investigate";

/**
 * BullMQ queues with a deliberate inline fallback: when Redis is unavailable
 * (local demo, CI without services) the same work runs in-process so the
 * product still works end to end. The interface does not change.
 */

export const QUEUE_NAMES = { analysis: "analysis", investigate: "investigate" } as const;

export const redisConnection = (): Record<string, unknown> => {
  const url = new URL(env.REDIS_URL);
  const dbIndex = url.pathname.replace("/", "");

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: url.username } : {}),
    ...(url.password ? { password: url.password } : {}),
    ...(dbIndex ? { db: Number(dbIndex) } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
};

const jobOptions = {
  attempts: 2,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

const queues = new Map<string, Queue>();

const getQueue = (name: string): Queue => {
  const existing = queues.get(name);
  if (existing) return existing;

  const queue = new Queue(name, { connection: redisConnection() });
  queues.set(name, queue);
  return queue;
};

const runInline = (task: () => Promise<unknown>, label: string): void => {
  setTimeout(() => {
    task().catch((error) => {
      console.error(`Inline ${label} job failed: ${error}`);
    });
  }, 0);
};

export const enqueueAnalysis = async (runId: string): Promise<string | null> => {
  try {
    const job = await getQueue(QUEUE_NAMES.analysis).add("analysis", { runId }, jobOptions);
    return job.id ?? null;
  } catch (error) {
    console.warn(`Redis queue unavailable, running analysis inline: ${error}`);
    runInline(() => runAnalysis(db, runId), "analysis");
    return null;
  }
};

export const enqueueInvestigation = async (
  caseId: string,
  regenerate = false,
): Promise<string | null> => {
  try {
    const job = await getQueue(QUEUE_NAMES.investigate).add(
      "investigate",
      { caseId, regenerate },
      jobOptions,
    );
    return job.id ?? null;
  } catch (error) {
    console.warn(`Redis queue unavailable, running investigation inline: ${error}`);
    runInline(() => investigateCase(caseId, { regenerate }), "investigate");
    return null;
  }
};

export const closeQueues = async (): Promise<void> => {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
};
