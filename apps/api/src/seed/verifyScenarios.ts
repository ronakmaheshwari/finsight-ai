import { generateDemoSheets, DEMO_SCENARIOS } from "./generateDemoData";
import { runRiskEngine, type EngineData } from "../utils/riskEngine";

/**
 * `npm run seed:verify` (or `node dist/seed/verifyScenarios.js`)
 *
 * Runs the risk engine over the generated demo data without a database and
 * asserts that every planted scenario (Appendix C) is detected. Useful in CI
 * and before a demo.
 */

const text = (row: Record<string, string>, key: string): string => (row[key] ?? "").trim();
const number = (row: Record<string, string>, key: string): number => Number(text(row, key) || 0);
const date = (row: Record<string, string>, key: string): Date => new Date(`${text(row, key)}T00:00:00.000Z`);

export const buildEngineData = (): EngineData => {
  const sheets = generateDemoSheets();

  const bankAccounts = sheets["bank-accounts"].rows.map(({ values }) => ({
    id: text(values, "bank_account_id"),
    ref: text(values, "bank_account_id"),
    accountNumberHash: text(values, "account_number"),
    bankName: text(values, "bank_name"),
  }));

  const employees = sheets.employees.rows.map(({ values }) => ({
    id: text(values, "employee_id"),
    ref: text(values, "employee_id"),
    name: text(values, "name"),
    department: text(values, "department"),
    approvalLimit: text(values, "approval_limit") ? number(values, "approval_limit") : null,
    bankAccountId: text(values, "bank_account_id") || null,
    address: text(values, "address") || null,
    phone: text(values, "phone") || null,
  }));

  const vendors = sheets.vendors.rows.map(({ values }) => ({
    id: text(values, "vendor_id"),
    ref: text(values, "vendor_id"),
    name: text(values, "name"),
    taxId: text(values, "tax_id") || null,
    address: text(values, "address") || null,
    phone: text(values, "phone") || null,
    createdAt: date(values, "created_date"),
    bankAccountId: text(values, "bank_account_id") || null,
    createdById: text(values, "created_by") || null,
  }));

  const purchaseOrders = sheets["purchase-orders"].rows.map(({ values }) => ({
    id: text(values, "po_id"),
    ref: text(values, "po_id"),
    vendorId: text(values, "vendor_id"),
    amount: number(values, "amount"),
    issuedDate: date(values, "issued_date"),
    approvedById: text(values, "approved_by") || null,
  }));

  const invoices = sheets.invoices.rows.map(({ values }) => ({
    id: text(values, "invoice_id"),
    ref: text(values, "invoice_id"),
    vendorId: text(values, "vendor_id"),
    poId: text(values, "po_id") || null,
    invoiceNumber: text(values, "invoice_number"),
    amount: number(values, "amount"),
    invoiceDate: date(values, "invoice_date"),
    approvedById: text(values, "approved_by") || null,
  }));

  const transactions = sheets.transactions.rows.map(({ values }) => ({
    id: text(values, "transaction_id"),
    ref: text(values, "transaction_id"),
    invoiceId: text(values, "invoice_id"),
    vendorId: text(values, "vendor_id") || null,
    amount: number(values, "amount"),
    postedAt: date(values, "posted_at"),
  }));

  return { bankAccounts, employees, vendors, purchaseOrders, invoices, transactions };
};

export const main = (): void => {
  const data = buildEngineData();
  const result = runRiskEngine(data);

  console.log(
    `Engine run: ${data.invoices.length} invoices, ${result.signals.length} signals, ${result.cases.length} cases`,
  );

  let failed = 0;
  for (const scenario of DEMO_SCENARIOS) {
    const found = result.signals.some(
      (signal) => signal.ruleKey === scenario.ruleKey && signal.title.includes(scenario.match),
    );
    console.log(`  ${found ? "PASS" : "FAIL"}  ${scenario.id}  ${scenario.ruleKey}  ${scenario.match}`);
    if (!found) failed += 1;
  }

  if (failed > 0) {
    throw new Error(`${failed} of ${DEMO_SCENARIOS.length} scenarios were not detected`);
  }

  console.log(`${DEMO_SCENARIOS.length} of ${DEMO_SCENARIOS.length} scenarios detected`);
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
