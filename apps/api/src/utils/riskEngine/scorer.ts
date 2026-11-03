import type { EngineData, EntityRef, RiskCase, RiskSignal, RuleKey, ScoreLine, Severity } from "./types";
import { groupBy, round2, sum } from "./stats";

export const SEVERITY_MULT: Record<Severity, number> = { LOW: 0.4, MEDIUM: 0.7, HIGH: 1.0, CRITICAL: 1.2 };

export const bandOf = (score: number): Severity =>
  score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";

export function scoreSignals(signals: RiskSignal[], scale: number): { score: number; lines: ScoreLine[] } {
  const byRule = groupBy(signals, (s) => s.ruleKey);
  const lines: ScoreLine[] = [];
  byRule.forEach((list, ruleKey) => {
    const worst = list.reduce((a, b) => (SEVERITY_MULT[b.severity] > SEVERITY_MULT[a.severity] ? b : a));
    const repeat = 1 + 0.2 * Math.min(Math.log(list.length), 3);
    const strength = Math.min(0.97, (worst.weight / 100) * SEVERITY_MULT[worst.severity] * scale * repeat);
    lines.push({ ruleKey: ruleKey as RuleKey, weight: worst.weight, severity: worst.severity, signalCount: list.length, strength: round2(strength), points: 0 });
  });
  const miss = lines.reduce((p, l) => p * (1 - l.strength), 1);
  const score = Math.round(100 * (1 - miss) * 10) / 10;
  const totalStrength = sum(lines.map((l) => l.strength)) || 1;
  lines.forEach((l) => (l.points = Math.round((score * l.strength) / totalStrength * 10) / 10));
  lines.sort((a, b) => b.points - a.points);
  return { score, lines };
}

/* -------------------------- grouping signals into cases -------------------------- */

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    this.parent.set(x, r);
    return r;
  }
  union(a: string, b: string) { this.parent.set(this.find(a), this.find(b)); }
}

const keyOf = (e: EntityRef) => `${e.type}:${e.id}`;

export function buildCases(
  signals: RiskSignal[], data: EngineData,
  opts: { scoreScale: number; minScore: number },
): RiskCase[] {
  const uf = new UnionFind();
  const keysOf = (s: RiskSignal) => s.entities.filter((e) => e.type === "VENDOR" || e.type === "EMPLOYEE").map(keyOf);
  for (const s of signals) {
    const ks = keysOf(s);
    ks.forEach((k) => uf.find(k));
    for (let i = 1; i < ks.length; i++) uf.union(ks[0]!, ks[i]!);
  }
  const components = groupBy(signals.filter((s) => keysOf(s).length > 0), (s) => uf.find(keysOf(s)[0]!));
  const invoiceAmount = new Map(data.invoices.map((i) => [i.id, i.amount]));

  const cases: RiskCase[] = [];
  components.forEach((sigs) => {
    const { score, lines } = scoreSignals(sigs, opts.scoreScale);
    if (score < opts.minScore) return;

    const top = sigs.reduce((a, b) => (b.weight * SEVERITY_MULT[b.severity] > a.weight * SEVERITY_MULT[a.severity] ? b : a));
    const entityCount = new Map<string, { ref: EntityRef; n: number }>();
    for (const s of sigs) for (const e of s.entities) {
      if (e.type !== "VENDOR" && e.type !== "EMPLOYEE") continue;
      const c = entityCount.get(keyOf(e));
      if (c) c.n++; else entityCount.set(keyOf(e), { ref: e, n: 1 });
    }
    const ranked = [...entityCount.values()].sort((a, b) => (a.ref.type === b.ref.type ? b.n - a.n : a.ref.type === "VENDOR" ? -1 : 1));

    const invoiceIds = new Set(sigs.flatMap((s) => s.invoiceIds));
    const exposure = invoiceIds.size
      ? round2(sum([...invoiceIds].map((id) => invoiceAmount.get(id) ?? 0)))
      : round2(Math.max(...sigs.map((s) => s.exposureAmount)));

    cases.push({
      id: "", title: sigs.length > 1 ? `${top.title} (+${sigs.length - 1} more signal${sigs.length > 2 ? "s" : ""})` : top.title,
      primaryEntity: ranked[0]!.ref, entities: ranked.map((r) => r.ref),
      riskScore: score, severity: bandOf(score), exposureAmount: exposure,
      priority: Math.round(score * Math.log10(exposure + 10) * 10) / 10,
      signalIds: sigs.map((s) => s.id), scoreBreakdown: lines,
    });
  });

  cases.sort((a, b) => b.priority - a.priority);
  cases.forEach((c, i) => {
    c.id = `CASE-${String(i + 1).padStart(3, "0")}`;
    const set = new Set(c.signalIds);
    signals.forEach((s) => { if (set.has(s.id)) s.caseId = c.id; });
  });
  return cases;
}
