import type { ScoreLine } from "@repo/shared";
import { RULE_CATALOG } from "@repo/shared";

import { SEVERITY_BAR } from "@/lib/severity";

export const ScoreBreakdown = ({ lines }: { lines: ScoreLine[] }) => {
  if (lines.length === 0) return <p className="text-sm text-muted-foreground">No scoring detail.</p>;

  const max = Math.max(...lines.map((line) => line.points), 1);

  return (
    <ul className="space-y-2">
      {lines.map((line) => (
        <li key={line.ruleKey}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate" title={RULE_CATALOG[line.ruleKey]?.label ?? line.ruleKey}>
              {RULE_CATALOG[line.ruleKey]?.label ?? line.ruleKey}
            </span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              +{line.points}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${SEVERITY_BAR[line.severity]}`}
              style={{ width: `${Math.max(4, (line.points / max) * 100)}%` }}
            />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {line.signalCount} signal{line.signalCount === 1 ? "" : "s"} · weight {line.weight}
          </p>
        </li>
      ))}
    </ul>
  );
};
