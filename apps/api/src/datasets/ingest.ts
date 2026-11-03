import type { Prisma } from "@prisma/client";
import db from "@repo/db";
import { ApiError } from "@repo/utils";

import { assertEngagementAccess, getDatasetForUser, type AuthUser } from "../lib/access";
import { readSheet, type SheetRow } from "./fileReader";
import { buildRow, type ReferenceMaps } from "./rows";
import { ID_COLUMN, requiredColumns, type Entity } from "./spec";

export type { AuthUser };

export interface RowFailure {
    row: number;
    errors: string[];
}

export type UploadOutcome =
    | { ok: true; entity: Entity; inserted: number; rowCounts: Record<string, number> }
    | { ok: false; entity: Entity; total: number; errors: RowFailure[] };

const MAX_ROWS = 50_000;
const MAX_REPORTED_ERRORS = 50;
const MAX_STORED_ERRORS = 200;
const INSERT_BATCH_SIZE = 1_000;
const TRANSACTION_TIMEOUT_MS = 60_000;

const loadReferenceMaps = async (datasetId: string): Promise<ReferenceMaps> => {
    const where = { datasetId };
    const select = { id: true, externalId: true };

    const [bankAccounts, employees, vendors, purchaseOrders, invoices] = await Promise.all([
        db.bankAccount.findMany({ where, select }),
        db.employee.findMany({ where, select }),
        db.vendor.findMany({ where, select }),
        db.purchaseOrder.findMany({ where, select }),
        db.invoice.findMany({ where, select }),
    ]);

    const toMap = (rows: { id: string; externalId: string }[]): Map<string, string> =>
        new Map(rows.map((row) => [row.externalId, row.id]));

    return {
        bankAccounts: toMap(bankAccounts),
        employees: toMap(employees),
        vendors: toMap(vendors),
        purchaseOrders: toMap(purchaseOrders),
        invoices: toMap(invoices),
    };
};

const countExistingRows = async (entity: Entity, datasetId: string): Promise<number> => {
    const where = { datasetId };

    switch (entity) {
        case "bank-accounts":
            return db.bankAccount.count({ where });
        case "employees":
            return db.employee.count({ where });
        case "vendors":
            return db.vendor.count({ where });
        case "purchase-orders":
            return db.purchaseOrder.count({ where });
        case "invoices":
            return db.invoice.count({ where });
        case "transactions":
            return db.transaction.count({ where });
    }
};

const insertBatch = async (
    tx: Prisma.TransactionClient,
    entity: Entity,
    records: Record<string, unknown>[],
): Promise<void> => {
    switch (entity) {
        case "bank-accounts":
            await tx.bankAccount.createMany({ data: records as unknown as Prisma.BankAccountCreateManyInput[] });
            return;
        case "employees":
            await tx.employee.createMany({ data: records as unknown as Prisma.EmployeeCreateManyInput[] });
            return;
        case "vendors":
            await tx.vendor.createMany({ data: records as unknown as Prisma.VendorCreateManyInput[] });
            return;
        case "purchase-orders":
            await tx.purchaseOrder.createMany({ data: records as unknown as Prisma.PurchaseOrderCreateManyInput[] });
            return;
        case "invoices":
            await tx.invoice.createMany({ data: records as unknown as Prisma.InvoiceCreateManyInput[] });
            return;
        case "transactions":
            await tx.transaction.createMany({ data: records as unknown as Prisma.TransactionCreateManyInput[] });
            return;
    }
};

const chunk = <T>(items: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
        items.slice(index * size, index * size + size),
    );

const asJsonObject = (value: Prisma.JsonValue | null): Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

const asRowCounts = (value: Prisma.JsonValue | null): Record<string, number> => {
    const counts: Record<string, number> = {};

    for (const [entity, count] of Object.entries(asJsonObject(value))) {
        if (typeof count === "number") counts[entity] = count;
    }

    return counts;
};

const assertUsableSheet = (entity: Entity, header: string[], rows: SheetRow[]): void => {
    if (rows.length === 0) {
        throw ApiError.badRequest("The file has no data rows");
    }

    if (rows.length > MAX_ROWS) {
        throw ApiError.badRequest(`The file has more than ${MAX_ROWS} rows`);
    }

    const missing = requiredColumns(entity).filter((column) => !header.includes(column));
    if (missing.length > 0) {
        throw ApiError.badRequest(`Missing required column(s): ${missing.join(", ")}`);
    }
};

const validateRows = (
    entity: Entity,
    datasetId: string,
    rows: SheetRow[],
    references: ReferenceMaps,
): { records: Record<string, unknown>[]; failures: RowFailure[] } => {
    const idColumn = ID_COLUMN[entity];
    const seenIds = new Set<string>();
    const records: Record<string, unknown>[] = [];
    const failures: RowFailure[] = [];

    for (const { rowNumber, values } of rows) {
        const errors: string[] = [];
        const externalId = values[idColumn] ?? "";

        if (externalId !== "") {
            if (seenIds.has(externalId)) {
                errors.push(`${idColumn} "${externalId}" appears more than once in this file`);
            }
            seenIds.add(externalId);
        }

        const built = buildRow(entity, values, datasetId, references);
        errors.push(...built.errors);

        if (errors.length > 0) {
            failures.push({ row: rowNumber, errors });
            continue;
        }

        if (built.record) records.push(built.record);
    }

    return { records, failures };
};

/**
 * Validates and inserts already-parsed rows. Shared by the upload route and the
 * seeder, so demo data always goes through the same rules as a real upload.
 * All-or-nothing: any invalid row means nothing from this file is saved.
 */
export const ingestParsedRows = async (
    datasetId: string,
    entity: Entity,
    header: string[],
    rows: SheetRow[],
): Promise<UploadOutcome> => {
    const dataset = await db.dataset.findUnique({ where: { id: datasetId } });
    if (!dataset) throw ApiError.notFound("Dataset not found");

    const alreadyUploaded = await countExistingRows(entity, datasetId);
    if (alreadyUploaded > 0) {
        throw ApiError.conflict(
            `${entity} was already uploaded for this dataset. Create a new dataset to start over.`,
        );
    }

    assertUsableSheet(entity, header, rows);

    const references = await loadReferenceMaps(datasetId);
    const { records, failures } = validateRows(entity, datasetId, rows, references);

    if (failures.length > 0) {
        const stored = asJsonObject(dataset.validationErrors);
        const uploads = asJsonObject((stored.uploads ?? null) as Prisma.JsonValue | null);
        uploads[entity] = failures.slice(0, MAX_STORED_ERRORS);

        await db.dataset.update({
            where: { id: dataset.id },
            data: { validationErrors: { ...stored, uploads } as unknown as Prisma.InputJsonObject },
        });

        return {
            ok: false,
            entity,
            total: failures.length,
            errors: failures.slice(0, MAX_REPORTED_ERRORS),
        };
    }

    const rowCounts: Record<string, number> = {
        ...asRowCounts(dataset.rowCounts),
        [entity]: records.length,
    };

    const stored = asJsonObject(dataset.validationErrors);
    const uploads = asJsonObject((stored.uploads ?? null) as Prisma.JsonValue | null);
    delete uploads[entity];

    await db.$transaction(
        async (tx) => {
            for (const batch of chunk(records, INSERT_BATCH_SIZE)) {
                await insertBatch(tx, entity, batch);
            }

            await tx.dataset.update({
                where: { id: dataset.id },
                data: {
                    rowCounts: rowCounts as unknown as Prisma.InputJsonObject,
                    validationErrors: { ...stored, uploads } as unknown as Prisma.InputJsonObject,
                },
            });
        },
        { timeout: TRANSACTION_TIMEOUT_MS },
    );

    return { ok: true, entity, inserted: records.length, rowCounts };
};

/** Parses a .csv/.xlsx upload into a header list and data rows (400 on failure). */
export const parseUpload = async (
    file: Express.Multer.File,
    entity: Entity,
): Promise<{ header: string[]; rows: SheetRow[] }> => {
    try {
        const sheet = await readSheet(file, entity);
        return { header: sheet.headers, rows: sheet.rows };
    } catch (error) {
        throw ApiError.badRequest(`Could not read file: ${(error as Error).message}`);
    }
};

export const ingestFile = async (
    user: AuthUser,
    datasetId: string,
    entity: Entity,
    file: Express.Multer.File,
): Promise<UploadOutcome> => {
    if (user.role === "VIEWER") {
        throw ApiError.forbidden("Viewers cannot upload datasets");
    }

    await getDatasetForUser(user, datasetId);

    const alreadyUploaded = await countExistingRows(entity, datasetId);
    if (alreadyUploaded > 0) {
        throw ApiError.conflict(
            `${entity} was already uploaded for this dataset. Create a new dataset to start over.`,
        );
    }

    const { header, rows } = await parseUpload(file, entity);
    return ingestParsedRows(datasetId, entity, header, rows);
};

export { assertEngagementAccess };
