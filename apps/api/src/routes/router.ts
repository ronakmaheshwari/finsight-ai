import { Router } from "express";
import authRouter from "../controller/authController";
import userRouter from "../controller/userController";
import engagementRouter from "../controller/engagementController";
import datasetRouter from "../controller/datasetController";
import runRouter from "../controller/runController";
import caseRouter from "../controller/caseController";
import ruleRouter from "../controller/ruleController";
import dashboardRouter from "../controller/dashboardController";
import auditRouter from "../controller/auditController";
import healthRouter from "../controller/healthController";

interface RouterInterface {
  path: string;
  router: Router;
}

const router: Router = Router();

const allRouters: RouterInterface[] = [
  { path: "/health", router: healthRouter },
  { path: "/auth", router: authRouter },
  { path: "/users", router: userRouter },
  { path: "/engagements", router: engagementRouter },
  { path: "/datasets", router: datasetRouter },
  { path: "/cases", router: caseRouter },
  { path: "/rules", router: ruleRouter },
  { path: "/dashboard", router: dashboardRouter },
  { path: "/audit-logs", router: auditRouter },
  // Defines `/datasets/:id/runs` and `/runs/:id`, so it mounts at the root.
  { path: "/", router: runRouter },
];

allRouters.forEach((entry) => {
  router.use(entry.path, entry.router);
});

export default router;
