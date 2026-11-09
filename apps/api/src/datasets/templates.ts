import ExcelJS from "exceljs";
import { DATASET_COLUMNS, ORDER, SHEET_NAME, type Entity } from "./spec";

/**
 * Templates and the upload parser are both generated from `spec.ts`, so the
 * downloaded file always uploads cleanly without edits.
 */

const REQUIRED_FILL = "FF1E3A5F"; // dark blue
const OPTIONAL_FILL = "FFE2E8F0"; // grey

const headerLabel = (key: string): string =>
  key
    .split("_")
    .map((part) => (part === "id" ? "ID" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");

const styleSheet = (sheet: ExcelJS.Worksheet, entity: Entity): void => {
  sheet.columns = DATASET_COLUMNS[entity].map((column) => ({
    header: headerLabel(column.key),
    key: column.key,
    width: Math.min(48, Math.max(18, column.description.length + 4)),
  }));

  const header = sheet.getRow(1);
  header.height = 26;
  header.alignment = { vertical: "middle", horizontal: "left" };
  header.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };

  DATASET_COLUMNS[entity].forEach((column, index) => {
    const cell = header.getCell(index + 1);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: column.required ? REQUIRED_FILL : OPTIONAL_FILL },
    };
    if (!column.required) cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF1F2937" } };
    (cell as unknown as { note: string }).note =
      `${column.description}${column.required ? " (required)" : " (optional)"}\nExample: ${column.example}`;
  });

  sheet.views = [{ state: "frozen", ySplit: 1 }];
};

const addInstructions = (workbook: ExcelJS.Workbook): void => {
  const sheet = workbook.addWorksheet("Instructions");
  sheet.columns = [{ width: 120 }];

  const lines = [
    "FinSight AI — dataset upload template",
    "",
    "1. Use one sheet per entity and keep the sheet names as they are.",
    "2. Upload in this order: bank accounts, employees, vendors, purchase orders, invoices, transactions.",
    "3. Dates must be yyyy-mm-dd. Amounts must be numbers greater than 0.",
    "4. Ids must be unique inside their own file and are referenced by later files.",
    "5. Bank account numbers are stored only as a one-way hash; they are never shown again.",
    "6. Any invalid row rejects the whole file — nothing from that file is saved.",
    "",
    "Required headers are dark blue; optional headers are grey. Hover a header for its description and an example.",
    "",
    "Risk indicators produced from this data are not findings of wrongdoing and require professional review.",
  ];

  lines.forEach((line) => sheet.addRow([line]));
  sheet.getRow(1).font = { bold: true, size: 14 };
};

export const buildTemplateWorkbook = async (): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FinSight AI";
  workbook.created = new Date();

  for (const entity of ORDER) {
    const sheet = workbook.addWorksheet(SHEET_NAME[entity]);
    styleSheet(sheet, entity);
  }

  // Instructions must be the last sheet.
  addInstructions(workbook);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const buildCsvTemplate = (entity: Entity): string => {
  const header = DATASET_COLUMNS[entity].map((column) => headerLabel(column.key));
  return `${header.join(",")}\n`;
};

/** Formula-injection guard for any exported cell (never relevant to headers). */
export const safeCsvCell = (value: string): string =>
  /^[=+\-@]/.test(value) ? `'${value}` : value;
