import type { Severity } from "@repo/shared";

import { SEVERITY_BAR, SEVERITY_LABEL } from "@/lib/severity";

const STROKE: Record<Severity, string> = {
  CRITICAL: "#b91c1c",
  HIGH: "#c2410c",
  MEDIUM: "#b45309",
  LOW: "#0369a1",
};

/** Semi-circle gauge, 0 to 100. The number is always shown, not just the arc. */
export const ScoreGauge = ({ score, severity }: { score: number; severity: Severity }) => {
  const radius = 70;
  const length = Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const filled = (clamped / 100) * length;

  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 180 105" className="w-full max-w-[220px]" role="img" aria-label={`Risk score ${clamped} of 100, ${SEVERITY_LABEL[severity]} severity`}>
        <path
          d="M 20 95 A 70 70 0 0 1 160 95"
          fill="none"
          stroke="currentColor"
          className="text-muted"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 20 95 A 70 70 0 0 1 160 95"
          fill="none"
          stroke={STROKE[severity]}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${length}`}
        />
        <text x="90" y="82" textAnchor="middle" className="fill-foreground" fontSize="30" fontWeight="600">
          {clamped}
        </text>
        <text x="90" y="99" textAnchor="middle" className="fill-muted-foreground" fontSize="10">
          of 100
        </text>
      </svg>
      <figcaption className="mt-1 flex items-center gap-2 text-sm">
        <span className={`inline-block h-2 w-2 rounded-full ${SEVERITY_BAR[severity]}`} aria-hidden />
        <span className="font-medium">{SEVERITY_LABEL[severity]} severity</span>
      </figcaption>
    </figure>
  );
};
