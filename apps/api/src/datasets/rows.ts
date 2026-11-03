import { z } from "zod";

import { hashAccountNumber } from "../lib/hash";
import type { Entity } from "./spec";

/** externalId -> internal id, per entity, for the dataset being uploaded into. */
export interface ReferenceMaps {
    bankAccounts: Map<string, string>;
    employees: Map<string, string>;
    vendors: Map<string, string>;
    purchaseOrders: Map<string, string>;
    invoices: Map<string, string>;
}

export interface BuiltRow {
    record?: Record<string, unknown>;
    errors: string[];
}

/* -------------------------------------------------------------------------- */
/* Cell-level rules                                                           */
/* -------------------------------------------------------------------------- */

const emptyToUndefined = (value: unknown): unknown =>
    typeof value === "string" && value.trim() === "" ? undefined : value;

const requiredText = z.string().trim().min(1, "required");

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().optional());

const amount = z.coerce.number({ error: "must be a number" }).positive("must be greater than 0");

const optionalAmount = z.preprocess(
    emptyToUndefined,
    z.coerce.number({ error: "must be a number" }).nonnegative("must be 0 or more").optional(),
);

const isoDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "use yyyy-mm-dd")
    .transform((value) => new Date(`${value}T00:00:00Z`))
    .refine((value) => !Number.isNaN(value.getTime()), "not a real date");

/* -------------------------------------------------------------------------- */
/* Row schemas (one per entity, mirroring DATASET_COLUMNS)                    */
/* -------------------------------------------------------------------------- */

const bankAccountRow = z.object({
    bank_account_id: requiredText,
    account_number: requiredText,
    bank_name: requiredText,
});

const employeeRow = z.object({
    employee_id: requiredText,
    name: requiredText,
    department: requiredText,
    approval_limit: optionalAmount,
    bank_account_id: optionalText,
    address: optionalText,
    phone: optionalText,
    email: optionalText,
});

const vendorRow = z.object({
    vendor_id: requiredText,
    name: requiredText,
    tax_id: optionalText,
    address: optionalText,
    phone: optionalText,
    created_date: isoDate,
    status: optionalText,
    bank_account_id: optionalText,
    created_by: optionalText,
});

const purchaseOrderRow = z.object({
    po_id: requiredText,
    vendor_id: requiredText,
    amount,
    issued_date: isoDate,
    approved_by: optionalText,
});

const invoiceRow = z.object({
    invoice_id: requiredText,
    vendor_id: requiredText,
    po_id: optionalText,
    invoice_number: requiredText,
    amount,
    invoice_date: isoDate,
    approved_by: optionalText,
});

const transactionRow = z.object({
    transaction_id: requiredText,
    invoice_id: requiredText,
    vendor_id: optionalText,
    amount,
    posted_at: isoDate,
    description: optionalText,
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: string[] };

const parseRow = <T>(schema: z.ZodType<T>, values: Record<string, string>): ParseResult<T> => {
    const parsed = schema.safeParse(values);
    if (parsed.success) return { ok: true, data: parsed.data };

    return {
        ok: false,
        errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
};

/** Resolves an external id to an internal one, recording a row error when it is unknown. */
const resolveReference = (
    ids: Map<string, string>,
    externalId: string | undefined,
    label: string,
    errors: string[],
): string | undefined => {
    if (!externalId) return undefined;

    const id = ids.get(externalId);
    if (!id) errors.push(`${label} "${externalId}" not found (upload the file it belongs to first)`);

    return id;
};

/* -------------------------------------------------------------------------- */
/* Row -> database record                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Validates one row and, when it is valid, builds the record to insert.
 * Reference errors are collected in `errors` instead of thrown, so the whole
 * file can be reported at once.
 */
export const buildRow = (
    entity: Entity,
    values: Record<string, string>,
    datasetId: string,
    references: ReferenceMaps,
): BuiltRow => {
    switch (entity) {
        case "bank-accounts": {
            const parsed = parseRow(bankAccountRow, values);
            if (!parsed.ok) return { errors: parsed.errors };

            const row = parsed.data;
            return {
                errors: [],
                record: {
                    datasetId,
                    externalId: row.bank_account_id,
                    accountNumberHash: hashAccountNumber(row.account_number),
                    bankName: row.bank_name,
                },
            };
        }

        case "employees": {
            const parsed = parseRow(employeeRow, values);
            if (!parsed.ok) return { errors: parsed.errors };

            const row = parsed.data;
            const errors: string[] = [];
            const record = {
                datasetId,
                externalId: row.employee_id,
                name: row.name,
                department: row.department,
                approvalLimit: row.approval_limit,
                address: row.address,
                phone: row.phone,
                email: row.email,
                bankAccountId: resolveReference(references.bankAccounts, row.bank_account_id, "bank_account_id", errors),
            };

            return { record, errors };
        }

        case "vendors": {
            const parsed = parseRow(vendorRow, values);
            if (!parsed.ok) return { errors: parsed.errors };

            const row = parsed.data;
            const errors: string[] = [];
            const record = {
                datasetId,
                externalId: row.vendor_id,
                name: row.name,
                taxId: row.tax_id,
                address: row.address,
                phone: row.phone,
                status: row.status,
                createdAt: row.created_date,
                bankAccountId: resolveReference(references.bankAccounts, row.bank_account_id, "bank_account_id", errors),
                createdById: resolveReference(references.employees, row.created_by, "created_by", errors),
            };

            return { record, errors };
        }

        case "purchase-orders": {
            const parsed = parseRow(purchaseOrderRow, values);
            if (!parsed.ok) return { errors: parsed.errors };

            const row = parsed.data;
            const errors: string[] = [];
            const record = {
                datasetId,
                externalId: row.po_id,
                amount: row.amount,
                issuedDate: row.issued_date,
                vendorId: resolveReference(references.vendors, row.vendor_id, "vendor_id", errors),
                approvedById: resolveReference(references.employees, row.approved_by, "approved_by", errors),
            };

            return { record, errors };
        }

        case "invoices": {
            const parsed = parseRow(invoiceRow, values);
            if (!parsed.ok) return { errors: parsed.errors };

            const row = parsed.data;
            const errors: string[] = [];
            const record = {
                datasetId,
                externalId: row.invoice_id,
                invoiceNumber: row.invoice_number,
                amount: row.amount,
                invoiceDate: row.invoice_date,
                vendorId: resolveReference(references.vendors, row.vendor_id, "vendor_id", errors),
                poId: resolveReference(references.purchaseOrders, row.po_id, "po_id", errors),
                approvedById: resolveReference(references.employees, row.approved_by, "approved_by", errors),
            };

            return { record, errors };
        }

        case "transactions": {
            const parsed = parseRow(transactionRow, values);
            if (!parsed.ok) return { errors: parsed.errors };

            const row = parsed.data;
            const errors: string[] = [];
            const record = {
                datasetId,
                externalId: row.transaction_id,
                amount: row.amount,
                postedAt: row.posted_at,
                description: row.description,
                invoiceId: resolveReference(references.invoices, row.invoice_id, "invoice_id", errors),
                vendorId: resolveReference(references.vendors, row.vendor_id, "vendor_id", errors),
            };

            return { record, errors };
        }
    }
};
