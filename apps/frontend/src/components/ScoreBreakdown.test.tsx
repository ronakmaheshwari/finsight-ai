import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ScoreLine } from "@repo/shared";

import { ScoreBreakdown } from "./ScoreBreakdown";

const line = (overrides: Partial<ScoreLine>): ScoreLine => ({
  ruleKey: "DUPLICATE_INVOICE",
  weight: 25,
  severity: "HIGH",
  signalCount: 1,
  strength: 1,
  points: 25,
  ...overrides,
});

describe("ScoreBreakdown", () => {
  it("explains an empty breakdown", () => {
    render(<ScoreBreakdown lines={[]} />);

    expect(screen.getByText("No scoring detail.")).toBeInTheDocument();
  });

  it("shows the catalog label, points and signal count per rule", () => {
    render(
      <ScoreBreakdown
        lines={[
          line({ ruleKey: "DUPLICATE_INVOICE", points: 40, signalCount: 2, weight: 25 }),
          line({ ruleKey: "ROUND_AMOUNT", severity: "LOW", points: 8, signalCount: 1, weight: 10 }),
        ]}
      />,
    );

    expect(screen.getByText("Duplicate invoice")).toBeInTheDocument();
    expect(screen.getByText("+40")).toBeInTheDocument();
    expect(screen.getByText("2 signals · weight 25")).toBeInTheDocument();
    expect(screen.getByText("Round amounts")).toBeInTheDocument();
    expect(screen.getByText("+8")).toBeInTheDocument();
    expect(screen.getByText("1 signal · weight 10")).toBeInTheDocument();
  });

  it("scales every bar against the largest contribution", () => {
    const { container } = render(
      <ScoreBreakdown
        lines={[
          line({ ruleKey: "DUPLICATE_INVOICE", points: 50 }),
          line({ ruleKey: "ROUND_AMOUNT", points: 10 }),
        ]}
      />,
    );

    const bars = container.querySelectorAll("li div[style]");
    expect(bars).toHaveLength(2);
    expect((bars[0] as HTMLElement).style.width).toBe("100%");
    expect((bars[1] as HTMLElement).style.width).toBe("20%");
  });
});
