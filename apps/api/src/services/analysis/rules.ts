import db from "@repo/db";
import {
  RULE_CATALOG,
  RULE_LIST,
  defaultParamsOf,
  type RuleKey,
  type RuleParamView,
  type RuleView,
} from "@repo/shared";
import type { RuleConfigMap } from "../../utils/riskEngine/types";

/**
 * Rule config lives per organisation; an analysis run snapshots the resolved
 * config so past runs stay reproducible after a rule changes.
 */

export const resolveRuleSnapshot = async (orgId: string): Promise<RuleConfigMap> => {
  const rows = await db.ruleConfig.findMany({ where: { orgId } });
  const snapshot: RuleConfigMap = {};

  for (const entry of RULE_LIST) {
    snapshot[entry.ruleKey] = {
      enabled: true,
      weight: entry.defaultWeight,
      params: defaultParamsOf(entry.ruleKey),
    };
  }

  for (const row of rows) {
    if (!(row.ruleKey in RULE_CATALOG)) continue;
    const key = row.ruleKey as RuleKey;
    snapshot[key] = {
      enabled: row.enabled,
      weight: row.weight,
      params: {
        ...defaultParamsOf(key),
        ...((row.params ?? {}) as Record<string, number>),
      },
    };
  }

  return snapshot;
};

export const listRules = async (orgId: string): Promise<RuleView[]> => {
  const rows = await db.ruleConfig.findMany({ where: { orgId } });
  const overrides = new Map(rows.map((row) => [row.ruleKey, row]));

  return RULE_LIST.map((entry) => {
    const override = overrides.get(entry.ruleKey);
    const overrideParams = (override?.params ?? {}) as Record<string, number>;

    const params: Record<string, RuleParamView> = {};
    for (const [name, definition] of Object.entries(entry.params)) {
      params[name] = {
        value: overrideParams[name] ?? definition.default,
        default: definition.default,
        min: definition.min,
        max: definition.max,
        step: definition.step,
        label: definition.label,
      };
    }

    return {
      ruleKey: entry.ruleKey,
      label: entry.label,
      category: entry.category,
      description: entry.description,
      enabled: override?.enabled ?? true,
      weight: override?.weight ?? entry.defaultWeight,
      defaultWeight: entry.defaultWeight,
      params,
    };
  });
};

/** Drops values that equal the catalog default so only real overrides are stored. */
export const onlyOverrides = (
  ruleKey: RuleKey,
  params: Record<string, number>,
): Record<string, number> => {
  const defaults = defaultParamsOf(ruleKey);
  return Object.fromEntries(
    Object.entries(params).filter(([key, value]) => defaults[key] !== value),
  );
};

export const validateParams = (
  ruleKey: RuleKey,
  params: Record<string, number>,
): string | null => {
  const definitions = RULE_CATALOG[ruleKey].params;

  for (const [name, value] of Object.entries(params)) {
    const definition = definitions[name];
    if (!definition) return `Unknown parameter "${name}" for ${ruleKey}`;
    if (typeof value !== "number" || Number.isNaN(value)) return `"${name}" must be a number`;
    if (value < definition.min || value > definition.max) {
      return `"${name}" must be between ${definition.min} and ${definition.max}`;
    }
  }

  return null;
};
