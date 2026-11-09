import { Readable } from "node:stream";
import ExcelJS from "exceljs";

import type { Entity } from "./spec";
import { HEADER_ALIASES, norm } from "./spec";

export interface SheetRow {
    /** Row number as it appears in the spreadsheet, so errors point at the right line. */
    rowNumber: number;
    /** Canonical column key -> trimmed cell text. */
    values: Record<string, string>;
}

export interface SheetData {
    headers: string[];
    rows: SheetRow[];
}

const isCsv = (originalName: string): boolean => originalName.toLowerCase().endsWith(".csv");

/** Any cell -> trimmed text, so the row schemas only ever deal with strings. */
const cellToText = (value: ExcelJS.CellValue | undefined): string => {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10); // yyyy-mm-dd (UTC)

    if (typeof value === "object") {
        if ("result" in value) return cellToText(value.result as ExcelJS.CellValue); // formula -> its value
        if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
        if ("text" in value) return String(value.text).trim(); // hyperlink
        return ""; // error cells such as #N/A
    }

    return String(value).trim();
};

/** "Employee ID" / "employee id" / "employee_id" all become "employee_id". */
const toColumnKey = (value: ExcelJS.CellValue): string => norm(cellToText(value));

const normaliseSheetName = (name: string): string =>
    name.trim().toLowerCase().replace(/[\s_]+/g, "-");

const findSheet = async (
    file: Express.Multer.File,
    entity: Entity,
): Promise<ExcelJS.Worksheet> => {
    const workbook = new ExcelJS.Workbook();

    if (isCsv(file.originalname)) {
        let buffer = file.buffer;
        if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
            buffer = buffer.subarray(3); // strip the UTF-8 BOM
        }
        // `map: (value) => value` keeps raw strings, so "012345" keeps its leading zero
        return workbook.csv.read(Readable.from([buffer]), { map: (value: unknown) => value });
    }

    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);

    // "Bank Accounts" (existing template) matches entity "bank-accounts"
    const named = workbook.worksheets.find((sheet) => normaliseSheetName(sheet.name) === entity);
    if (named) return named;

    if (workbook.worksheets.length === 1) {
        const [only] = workbook.worksheets;
        if (only) return only;
    }

    throw new Error(`The file has no sheet named "${entity}"`);
};

/**
 * Reads a .csv or .xlsx upload into a header list and data rows.
 * Throws a plain `Error` with a user-readable message; the caller turns it into
 * a 400.
 */
export const readSheet = async (file: Express.Multer.File, entity: Entity): Promise<SheetData> => {
    const sheet = await findSheet(file, entity);
    const aliases = HEADER_ALIASES[entity];

    const headerRow = sheet.getRow(1).values as ExcelJS.CellValue[];
    const headers = headerRow.slice(1).map((value) => {
        const key = toColumnKey(value);
        return aliases[key] ?? key;
    });

    if (headers.every((header) => header === "")) {
        throw new Error("The first row must contain the column names");
    }

    const duplicate = headers.find(
        (header, index) => header !== "" && headers.indexOf(header) !== index,
    );
    if (duplicate) {
        throw new Error(`The column "${duplicate}" appears more than once`);
    }

    const rows: SheetRow[] = [];

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const cells = (row.values as ExcelJS.CellValue[]).slice(1);
        const values: Record<string, string> = {};

        headers.forEach((header, index) => {
            if (header) values[header] = cellToText(cells[index]);
        });

        if (Object.values(values).some((value) => value !== "")) {
            rows.push({ rowNumber, values });
        }
    });

    return { headers, rows };
};
