import { buildContext, RULES } from "./rules";
import { buildCases } from "./scorer";
import { sum } from "./stats";
import type {
  EngineData, EngineOptions, EngineResult, EngineSummary, RiskSignal, RuleKey, Severity,
} from "./types";

export * from "./types";
export { RULES, buildContext } from "./rules";
export { buildGraphEdges, caseGraph } from "./graph";
export { scoreSignals, bandOf } from "./scorer";

export function runRiskEngine(data: EngineData, options: EngineOptions = {}): EngineResult {
  const scale = options.scoreScale ?? 2.5;
  const minScore = options.minScore ?? 15;
  const ctx = buildContext(data, options.holidays ?? []);

  // 1. run every enabled rule
  const signals: RiskSignal[] = [];
  let n = 0;
  for (const rule of RULES) {
    const cfg = options.config?.[rule.key];
    if (cfg?.enabled === false) continue;
    const weight = cfg?.weight ?? rule.defaultWeight;
    const params = { ...rule.defaultParams, ...(cfg?.params ?? {}) };
    for (const raw of rule.run(ctx, params)) {
      signals.push({ ...raw, id: `SIG-${String(++n).padStart(5, "0")}`, ruleKey: rule.key, category: rule.category, weight });
    }
  }

  // 2. group into cases and score them (also stamps signal.caseId)
  const cases = buildCases(signals, data, { scoreScale: scale, minScore });

  // 3. summary
  const casesBySeverity: Record<Severity, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  cases.forEach((c) => casesBySeverity[c.severity]++);
  const signalsByRule: Partial<Record<RuleKey, number>> = {};
  signals.forEach((s) => (signalsByRule[s.ruleKey] = (signalsByRule[s.ruleKey] ?? 0) + 1));
  const signalById = new Map(signals.map((s) => [s.id, s]));
  const flagged = new Set(cases.flatMap((c) => c.signalIds.flatMap((id) => signalById.get(id)?.invoiceIds ?? [])));
  const population = data.invoices.length;
  const summary: EngineSummary = {
    populationInvoices: population, signalCount: signals.length, caseCount: cases.length,
    casesBySeverity, signalsByRule, flaggedInvoices: flagged.size,
    totalExposure: Math.round(sum(cases.map((c) => c.exposureAmount)) * 100) / 100,
    // honest estimate: records a reviewer no longer has to read x minutes each. Label it "estimated" in the UI.
    estimatedHoursSaved: Math.round(((population - flagged.size) * (options.minutesPerRecord ?? 3)) / 60 * 10) / 10,
  };
  return { signals, cases, summary };
}
