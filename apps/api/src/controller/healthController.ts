import { type Request, type Response, Router } from "express";
import db from "@repo/db";
import { redis } from "@repo/cache";

const healthRouter: Router = Router();

interface DependencyState {
  db: boolean;
  redis: boolean;
}

const checkDependencies = async (): Promise<DependencyState> => {
  let dbOk = false;
  let redisOk = false;

  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (error) {
    console.error(`Health check: database unreachable: ${error}`);
  }

  try {
    if (redis.isReady) {
      await redis.ping();
      redisOk = true;
    }
  } catch (error) {
    console.error(`Health check: redis unreachable: ${error}`);
  }

  return { db: dbOk, redis: redisOk };
};

const respond = async (_req: Request, res: Response): Promise<Response> => {
  const dependencies = await checkDependencies();
  const healthy = dependencies.db && dependencies.redis;

  return res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    db: dependencies.db,
    redis: dependencies.redis,
    time: new Date().toISOString(),
  });
};

healthRouter.get("/", respond);
healthRouter.get("/health", respond);
healthRouter.get("/ready", respond);

export default healthRouter;
