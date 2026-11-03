import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RowFailureView } from "@repo/shared";

import { RowErrorTable, UploadCard, type UploadState } from "./UploadCard";

const failures = (count: number): RowFailureView[] =>
  Array.from({ length: count }, (_, index) => ({ row: index + 2, errors: [`amount is required (${index + 2})`] }));

const renderCard = (state: UploadState, onUpload = vi.fn()) =>
  render(
    <UploadCard
      entity="invoices"
      label="Invoices"
      required
      description="One invoice per row."
      state={state}
      onUpload={onUpload}
    />,
  );

describe("UploadCard", () => {
  it("offers a file picker and a template download while idle", () => {
    renderCard({ kind: "idle" });

    expect(screen.getByRole("button", { name: /choose file/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /csv template/i })).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("passes the chosen file to the upload handler", () => {
    const onUpload = vi.fn();
    renderCard({ kind: "idle" }, onUpload);

    const file = new File(["invoice_id,amount"], "invoices.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Upload Invoices"), { target: { files: [file] } });

    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it("shows progress while the file is importing", () => {
    renderCard({ kind: "uploading" });

    expect(screen.getByRole("status")).toHaveTextContent("Importing invoices…");
    expect(screen.queryByRole("button", { name: /choose file/i })).not.toBeInTheDocument();
  });

  it("confirms the imported row count and locks the card", () => {
    renderCard({ kind: "done", inserted: 42 });

    expect(screen.getByText("42 rows imported")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /choose file/i })).not.toBeInTheDocument();
  });

  it("lists the rejected rows with their row numbers", () => {
    renderCard({ kind: "error", message: "Upload rejected: 2 invalid rows", errors: failures(2) });

    expect(screen.getByText("Upload rejected: 2 invalid rows")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Rows that failed validation" })).toBeInTheDocument();
    expect(screen.getByText("amount is required (2)")).toBeInTheDocument();
    expect(screen.getByText("amount is required (3)")).toBeInTheDocument();
  });
});

describe("RowErrorTable", () => {
  it("caps the table at 50 rows and reports the remainder", () => {
    render(<RowErrorTable errors={failures(60)} />);

    expect(screen.getAllByRole("row")).toHaveLength(51); // header + 50 data rows
    expect(screen.getByText("Showing the first 50 of 60 invalid rows.")).toBeInTheDocument();
  });
});
