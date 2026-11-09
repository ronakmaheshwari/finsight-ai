import express, { type Express, type Request, type Response } from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import { initRedis } from "@repo/cache";
import { env, validateEnv } from "@repo/utils";
import router from "./routes/router";
import healthRouter from "./controller/healthController";
import { errorMiddleware, notFoundMiddleware } from "./middleware/errorMiddleware";
import { activeProvider } from "./services/ai/client";
import { runDatabaseMigrations, runDatabaseReset } from "@repo/db";

const app: Express = express();
const port = env.PORT;

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
}

app.use(healthRouter);

app.get("/", (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    data: { name: "FinSight AI API", version: "v1", docs: "/api/v1" },
  });
});

app.use("/api/v1", router);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

const startServer = async (): Promise<void> => {
  try {
    validateEnv();
  } catch (error) {
    console.error("Invalid environment configuration:", error);
    process.exit(1);
  }

  try {
    await initRedis();
  } catch (error) {
    // Redis powers queues and caching only. Without it the API stays up and the
    // queue helper falls back to inline execution, so /health reports it down.
    console.warn(`Redis is unavailable, continuing without it: ${error}`);
  }

  if(env.RUN_MIGRATION) {
    await runDatabaseMigrations();
  } else {
    console.log("Database migrations skipped (RUN_MIGRATION is not true)")
  }

  if(env.RUN_MIGRATION_RESET) {
    await runDatabaseReset();
  } else {
    console.log("Database migrations reset skipped (RUN_MIGRATION_RESET is not true)")
  }

  app.listen(port, () => {
    console.log(`FinSight API listening on http://localhost:${port}`);
    console.log(`AI provider: ${activeProvider()}`);
  });
};

void startServer();

export { startServer };
export default app;
