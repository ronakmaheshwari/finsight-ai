/**
 * Column definition for each dataset file.
 *
 * The upload validation reads from here, so the required columns, types and
 * descriptions live in one place. Add a column here and the upload accepts it
 * immediately.
 */

export const ENTITIES = [
    "bank-accounts",
    "employees",
    "vendors",
    "purchase-orders",
    "invoices",
    "transactions",
] as const;

export type Entity = (typeof ENTITIES)[number];

export type ColumnType = "text" | "number" | "date";

export interface Column {
    key: string;
    required: boolean;
    type: ColumnType;
    description: string;
    example: string;
}

export const DATASET_COLUMNS: Record<Entity, Column[]> = {
    "bank-accounts": [
        { key: "bank_account_id", required: true, type: "text", description: "Your unique id for this account (referenced by employees and vendors)", example: "BA-0001" },
        { key: "account_number", required: true, type: "text", description: "Full account number. Stored only as a hash", example: "123456789012" },
        { key: "bank_name", required: true, type: "text", description: "Name of the bank", example: "HDFC Bank" },
    ],
    employees: [
        { key: "employee_id", required: true, type: "text", description: "Unique employee id", example: "E-001" },
        { key: "name", required: true, type: "text", description: "Full name", example: "Priya Sharma" },
        { key: "department", required: true, type: "text", description: "Department", example: "Finance" },
        { key: "approval_limit", required: false, type: "number", description: "Max amount this person may approve", example: "25000" },
        { key: "bank_account_id", required: false, type: "text", description: "Must exist in bank-accounts", example: "BA-0001" },
        { key: "address", required: false, type: "text", description: "Address", example: "12 MG Road, Bengaluru" },
        { key: "phone", required: false, type: "text", description: "Phone number", example: "+91-9876543210" },
        { key: "email", required: false, type: "text", description: "Email", example: "priya@company.com" },
    ],
    vendors: [
        { key: "vendor_id", required: true, type: "text", description: "Unique vendor id", example: "V-001" },
        { key: "name", required: true, type: "text", description: "Vendor name", example: "Sharma Traders Pvt Ltd" },
        { key: "tax_id", required: false, type: "text", description: "Tax / GST id", example: "27ABCDE1234F1Z5" },
        { key: "address", required: false, type: "text", description: "Address", example: "45 Park Street, Kolkata" },
        { key: "phone", required: false, type: "text", description: "Phone number", example: "+91-9123456780" },
        { key: "created_date", required: true, type: "date", description: "Date vendor was created in the system (yyyy-mm-dd)", example: "2025-03-14" },
        { key: "status", required: false, type: "text", description: "Vendor status", example: "ACTIVE" },
        { key: "bank_account_id", required: false, type: "text", description: "Must exist in bank-accounts", example: "BA-0002" },
        { key: "created_by", required: false, type: "text", description: "employee_id of who created the vendor (must exist in employees)", example: "E-002" },
    ],
    "purchase-orders": [
        { key: "po_id", required: true, type: "text", description: "Unique PO id", example: "PO-00001" },
        { key: "vendor_id", required: true, type: "text", description: "Must exist in vendors", example: "V-001" },
        { key: "amount", required: true, type: "number", description: "PO amount, greater than 0", example: "5400.00" },
        { key: "issued_date", required: true, type: "date", description: "yyyy-mm-dd", example: "2026-01-10" },
        { key: "approved_by", required: false, type: "text", description: "employee_id of the approver (must exist in employees)", example: "E-005" },
    ],
    invoices: [
        { key: "invoice_id", required: true, type: "text", description: "Unique invoice record id", example: "INV-000001" },
        { key: "vendor_id", required: true, type: "text", description: "Must exist in vendors", example: "V-001" },
        { key: "po_id", required: false, type: "text", description: "Must exist in purchase-orders. Leave blank if there is no PO", example: "PO-00001" },
        { key: "invoice_number", required: true, type: "text", description: "Number printed on the vendor's invoice", example: "INV-2026-0042" },
        { key: "amount", required: true, type: "number", description: "Invoice amount, greater than 0", example: "5400.00" },
        { key: "invoice_date", required: true, type: "date", description: "yyyy-mm-dd", example: "2026-01-20" },
        { key: "approved_by", required: false, type: "text", description: "employee_id of the approver (must exist in employees)", example: "E-005" },
    ],
    transactions: [
        { key: "transaction_id", required: true, type: "text", description: "Unique payment id", example: "TX-000001" },
        { key: "invoice_id", required: true, type: "text", description: "Must exist in invoices", example: "INV-000001" },
        { key: "vendor_id", required: false, type: "text", description: "Must exist in vendors", example: "V-001" },
        { key: "amount", required: true, type: "number", description: "Amount paid, greater than 0", example: "5400.00" },
        { key: "posted_at", required: true, type: "date", description: "Payment date, yyyy-mm-dd", example: "2026-02-05" },
        { key: "description", required: false, type: "text", description: "Free text", example: "Payment INV-2026-0042" },
    ],
};

/** The column that identifies a row inside one file (used for duplicate detection). */
export const ID_COLUMN: Record<Entity, string> = {
    "bank-accounts": "bank_account_id",
    employees: "employee_id",
    vendors: "vendor_id",
    "purchase-orders": "po_id",
    invoices: "invoice_id",
    transactions: "transaction_id",
};

export const isEntity = (value: string): value is Entity =>
    (ENTITIES as readonly string[]).includes(value);

/** Upload order matters: later files reference earlier files by human id. */
export const ORDER: Entity[] = [
    "bank-accounts",
    "employees",
    "vendors",
    "purchase-orders",
    "invoices",
    "transactions",
];

/** Sheet names used in the downloadable workbook (always in upload order). */
export const SHEET_NAME: Record<Entity, string> = {
    "bank-accounts": "Bank Accounts",
    employees: "Employees",
    vendors: "Vendors",
    "purchase-orders": "Purchase Orders",
    invoices: "Invoices",
    transactions: "Transactions",
};

export const ENTITY_LABEL: Record<Entity, string> = {
    "bank-accounts": "Bank accounts",
    employees: "Employees",
    vendors: "Vendors",
    "purchase-orders": "Purchase orders",
    invoices: "Invoices",
    transactions: "Transactions",
};

/**
 * Human headers accepted in addition to the canonical snake_case key. Files
 * made from the earlier "Engagement Management" template stay uploadable.
 */
export const HEADER_ALIASES: Record<Entity, Record<string, string>> = {
    "bank-accounts": {},
    employees: { bank_account: "bank_account_id" },
    vendors: { bank_account: "bank_account_id" },
    "purchase-orders": {
        purchase_order_id: "po_id",
        account: "amount",
        approved_by_id: "approved_by",
    },
    invoices: {
        purchase_order_id: "po_id",
        account: "amount",
        approved_by_id: "approved_by",
    },
    transactions: { account: "amount" },
};

/** Case-, space- and punctuation-insensitive header normaliser. */
export const norm = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .replace(/[\s\-.]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");

export const labelOf = (entity: Entity): string => ENTITY_LABEL[entity];

export const requiredColumns = (entity: Entity): string[] =>
    DATASET_COLUMNS[entity].filter((column) => column.required).map((column) => column.key);

