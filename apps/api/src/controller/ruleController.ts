import { type Request, type Response, Router } from "express";
import db from "@repo/db";
import {
  RULE_CATALOG,
  defaultParamsOf,
  ruleKeyParamSchema,
  ruleResetSchema,
  ruleUpdateSchema,
  type RuleKey,
} from "@repo/shared";
import { ApiError } from "@repo/utils";
import userMiddleware from "../middleware/userMiddleware";
import { requireRole } from "../middleware/requireRole";
import { AUDIT_ACTIONS, audit } from "../lib/audit";
import { listRules, onlyOverrides, validateParams } from "../services/analysis/rules";

const ruleRouter: Router = Router();

const readRuleKey = (req: Request): RuleKey => {
  const params = ruleKeyParamSchema.safeParse(req.params);
  if (!params.success) {
    throw ApiError.badRequest(params.error.issues[0]?.message ?? "Unknown rule");
  }
  return params.data.ruleKey;
};

ruleRouter.get("/", userMiddleware, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const data = await listRules(req.user.orgId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while listing rules: ${error}`);
    throw ApiError.internal();
  }
});

ruleRouter.patch("/:ruleKey", userMiddleware, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const ruleKey = readRuleKey(req);

    const parsed = ruleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid rule update");
    }

    if (parsed.data.params) {
      const problem = validateParams(ruleKey, parsed.data.params);
      if (problem) throw ApiError.badRequest(problem);
    }

    const existing = await db.ruleConfig.findUnique({
      where: { orgId_ruleKey: { orgId: req.user.orgId, ruleKey } },
    });

    const before = {
      enabled: existing?.enabled ?? true,
      weight: existing?.weight ?? RULE_CATALOG[ruleKey].defaultWeight,
      params: { ...defaultParamsOf(ruleKey), ...((existing?.params ?? {}) as Record<string, number>) },
    };

    const mergedParams = { ...before.params, ...(parsed.data.params ?? {}) };
    const storedParams = onlyOverrides(ruleKey, mergedParams);

    const after = {
      enabled: parsed.data.enabled ?? before.enabled,
      weight: parsed.data.weight ?? before.weight,
      params: mergedParams,
    };

    await db.ruleConfig.upsert({
      where: { orgId_ruleKey: { orgId: req.user.orgId, ruleKey } },
      create: {
        orgId: req.user.orgId,
        ruleKey,
        enabled: after.enabled,
        weight: after.weight,
        params: storedParams,
        updatedById: req.user.userId,
      },
      update: {
        enabled: after.enabled,
        weight: after.weight,
        params: storedParams,
        updatedById: req.user.userId,
      },
    });

    await audit({
      orgId: req.user.orgId,
      userId: req.user.userId,
      action: AUDIT_ACTIONS.RULE_UPDATED,
      entityType: "RuleConfig",
      entityId: ruleKey,
      meta: { before, after },
      ip: req.ip ?? null,
    });

    const rules = await listRules(req.user.orgId);
    const updated = rules.find((rule) => rule.ruleKey === ruleKey) ?? null;

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while updating a rule: ${error}`);
    throw ApiError.internal();
  }
});

ruleRouter.post("/reset", userMiddleware, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const parsed = ruleResetSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw ApiError.badRequest("Invalid reset request");

    const ruleKey = parsed.data.ruleKey;
    if (ruleKey !== undefined && !(ruleKey in RULE_CATALOG)) {
      throw ApiError.badRequest("Unknown rule");
    }

    const where = ruleKey
      ? { orgId: req.user.orgId, ruleKey }
      : { orgId: req.user.orgId };

    const removed = await db.ruleConfig.deleteMany({ where });

    await audit({
      orgId: req.user.orgId,
      userId: req.user.userId,
      action: AUDIT_ACTIONS.RULE_UPDATED,
      entityType: "RuleConfig",
      entityId: ruleKey ?? null,
      meta: { reset: true, ruleKey: ruleKey ?? "ALL", removed: removed.count },
      ip: req.ip ?? null,
    });

    return res.status(200).json({ success: true, data: { removed: removed.count } });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Error took place while resetting rules: ${error}`);
    throw ApiError.internal();
  }
});

export default ruleRouter;
