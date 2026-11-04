import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@repo/ui/tooltip";
import { KpiCard } from "./KpiCard";

const HINT = "Formula: 2 minutes per flagged invoice.";

describe("KpiCard", () => {
  it("renders the label as plain text when there is nothing to explain", () => {
    render(<KpiCard label="Open cases" value="12" />);

    expect(screen.getByText("Open cases")).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  // Regression: the dashboard used to crash with "`Tooltip` must be used within
  // `TooltipProvider`" because nothing mounted a provider.
  it("renders a tooltip without an app-level provider", () => {
    render(<KpiCard label="Hours saved" value="4" tooltip={HINT} />);

    expect(screen.getByText("Hours saved")).toBeInTheDocument();
  });

  it("reveals the explanation when the label is focused from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <KpiCard label="Hours saved" value="4" tooltip={HINT} />
      </TooltipProvider>,
    );

    await user.tab();

    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent(HINT));
  });
});
