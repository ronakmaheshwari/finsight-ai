import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvestigationOutput, InvestigationView } from "@repo/shared";

const mocks = vi.hoisted(() => ({
  getInvestigation: vi.fn(),
  requestInvestigation: vi.fn(),
  reviewInvestigation: vi.fn(),
}));

vi.mock("@/api/cases", () => mocks);

import { AiPanel } from "./AiPanel";

const output: InvestigationOutput = {
  summary:
    "Three invoices from the same vendor share an invoice number and amount inside a seven-day window, which is unusual.",
  riskNarrative:
    "The repeated combination of invoice number, amount and timing is consistent with duplicate billing and needs a manual check.",
  keyFindings: [
    { finding: "Two invoices share the same invoice number and amount.", evidenceSignalIds: ["sig-1"] },
  ],
  alternativeExplanations: ["A credit note re-issued as a new invoice could produce the same pattern."],
  recommendedSteps: [{ step: "Request the vendor ledger for the period.", priority: "HIGH" }],
  documentsToRequest: ["Vendor ledger"],
  confidence: "MEDIUM",
  limitations: "Only the uploaded extract was reviewed.",
};

const view = (overrides: Partial<InvestigationView> = {}): InvestigationView => ({
  status: "COMPLETED",
  error: null,
  model: "claude-test",
  promptVersion: "v1",
  reviewStatus: "PENDING",
  reviewedBy: null,
  reviewedAt: null,
  output,
  edited: false,
  original: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  ...overrides,
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const renderPanel = (canWrite: boolean, onCitation = vi.fn()) =>
  render(
    <AiPanel caseId="case-1" canWrite={canWrite} signalIndexById={new Map([["sig-1", 1]])} onCitation={onCitation} />,
    { wrapper },
  );

beforeEach(() => {
  mocks.getInvestigation.mockReset();
  mocks.requestInvestigation.mockReset();
  mocks.reviewInvestigation.mockReset();
});

describe("AiPanel", () => {
  it("always carries the review-required language", async () => {
    mocks.getInvestigation.mockResolvedValue(view({ notRequested: true }));

    renderPanel(true);

    expect(await screen.findByText("AI-assisted, review required")).toBeInTheDocument();
    expect(
      screen.getByText(/does not determine that any wrongdoing occurred and requires professional review/i),
    ).toBeInTheDocument();
  });

  it("lets a writer generate the first investigation", async () => {
    mocks.getInvestigation.mockResolvedValue(view({ notRequested: true, status: "COMPLETED", output: null }));
    mocks.requestInvestigation.mockResolvedValue(view({ status: "QUEUED" }));

    renderPanel(true);
    const button = await screen.findByRole("button", { name: /generate investigation/i });
    await userEvent.setup().click(button);

    expect(mocks.requestInvestigation).toHaveBeenCalledWith("case-1", false);
  });

  it("hides the generate action from a viewer", async () => {
    mocks.getInvestigation.mockResolvedValue(view({ notRequested: true, status: "COMPLETED", output: null }));

    renderPanel(false);

    await screen.findByText("AI-assisted, review required");
    await waitFor(() => expect(mocks.getInvestigation).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /generate investigation/i })).not.toBeInTheDocument();
  });

  it("renders the output, its confidence and clickable signal citations", async () => {
    mocks.getInvestigation.mockResolvedValue(view());
    const onCitation = vi.fn();

    renderPanel(true, onCitation);

    expect(await screen.findByText(output.summary)).toBeInTheDocument();
    expect(screen.getByText("Medium confidence")).toBeInTheDocument();
    expect(screen.getByText("Awaiting review")).toBeInTheDocument();
    expect(screen.getByText("Two invoices share the same invoice number and amount.")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Signal 1" }));
    expect(onCitation).toHaveBeenCalledWith("sig-1");
  });

  it("offers review actions to a writer and hides them from a viewer", async () => {
    mocks.getInvestigation.mockResolvedValue(view());

    const writer = renderPanel(true);
    expect(await screen.findByRole("button", { name: /accept/i })).toBeInTheDocument();
    writer.unmount();

    renderPanel(false);
    expect(await screen.findByText(output.summary)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
  });

  it("shows a failure with a retry for a writer", async () => {
    mocks.getInvestigation.mockResolvedValue(view({ status: "FAILED", output: null, error: "Provider timed out." }));
    mocks.requestInvestigation.mockResolvedValue(view({ status: "QUEUED" }));

    renderPanel(true);

    expect(await screen.findByText("Provider timed out.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(mocks.requestInvestigation).toHaveBeenCalledWith("case-1", true);
  });
});
