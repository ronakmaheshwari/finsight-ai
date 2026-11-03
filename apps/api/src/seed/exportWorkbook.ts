import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

import { ORDER, SHEET_NAME, DATASET_COLUMNS } from "../datasets/spec";
import { generateDemoSheets } from "./generateDemoData";

/**
 * `npm run seed:export-demo-workbook`
 *
 * Writes the uploadable demo workbook (template layout, filled with the same
 * generated data `db:seed` uses) plus a deliberately broken invoices file for
 * the validation demo.
 */

const OUT_DIR = path.resolve(process.cwd(), "demo-files");

const buildGoodWorkbook = (): ExcelJS.Workbook => {
  const sheets = generateDemoSheets();
  const workbook = new ExcelJS.Workbook();

  for (const entity of ORDER) {
    const sheet = workbook.addWorksheet(SHEET_NAME[entity]);
    sheet.addRow(DATASET_COLUMNS[entity].map((column) => column.key));

    for (const row of sheets[entity].rows) {
      sheet.addRow(DATASET_COLUMNS[entity].map((column) => row.values[column.key] ?? ""));
    }

    sheet.getRow(1).font = { bold: true };
  }

  return workbook;
};

const buildBadRowsWorkbook = (): ExcelJS.Workbook => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Invoices");
  sheet.addRow(DATASET_COLUMNS.invoices.map((column) => column.key));

  const base = {
    invoice_id: "BAD-001",
    vendor_id: "V-001",
    po_id: "",
    invoice_number: "BAD-INV-1",
    amount: "1000.00",
    invoice_date: "2026-01-10",
    approved_by: "E-002",
  };

  const badRows = [
    { ...base, invoice_id: "BAD-001", invoice_number: "" },
    { ...base, invoice_id: "BAD-002", vendor_id: "V-999" },
    { ...base, invoice_id: "BAD-003", amount: "-500" },
    { ...base, invoice_id: "BAD-004", invoice_date: "31/02/2026" },
    { ...base, invoice_id: "BAD-005", amount: "not-a-number" },
    { ...base, invoice_id: "BAD-006", vendor_id: "" },
    { ...base, invoice_id: "BAD-007", approved_by: "E-099" },
    { ...base, invoice_id: "BAD-008" },
    { ...base, invoice_id: "BAD-008" },
  ];

  for (const row of badRows) {
    sheet.addRow(DATASET_COLUMNS.invoices.map((column) => row[column.key as keyof typeof row] ?? ""));
  }

  sheet.getRow(1).font = { bold: true };
  return workbook;
};

const main = async (): Promise<void> => {
  await mkdir(OUT_DIR, { recursive: true });

  const good = buildGoodWorkbook();
  const goodBuffer = await good.xlsx.writeBuffer();
  const goodPath = path.join(OUT_DIR, "finsight-demo-upload.xlsx");
  await writeFile(goodPath, Buffer.from(goodBuffer));

  const bad = buildBadRowsWorkbook();
  const badBuffer = await bad.xlsx.writeBuffer();
  const badPath = path.join(OUT_DIR, "finsight-bad-rows.xlsx");
  await writeFile(badPath, Buffer.from(badBuffer));

  console.log(`Wrote ${goodPath}`);
  console.log(`Wrote ${badPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
