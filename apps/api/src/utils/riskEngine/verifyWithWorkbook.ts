// riskEngine/verifyWithWorkbook.ts
// Runs the engine on finsight_test_data.xlsx and checks every planted scenario in its AnswerKey sheet.
//   npx tsx riskEngine/verifyWithWorkbook.ts ./finsight_test_data.xlsx
//
// This is a developer verification script over a raw workbook, so the row
// values are genuinely untyped: the `any` usage is confined to this file.
/* eslint-disable @typescript-eslint/no-explicit-any */

import ExcelJS from "exceljs";
import { runRiskEngine, RULES, type EngineData } from "./index";

const file = process.argv[2] ?? "./finsight_test_data.xlsx";

function rows(ws: ExcelJS.Worksheet): Record<string, any>[] {
  const head = (ws.getRow(1).values as any[]).slice(1).map((h) => String(h));
  const out: Record<string, any>[] = [];
  ws.eachRow((r, n) => {
    if (n === 1) return;
    const v = (r.values as any[]).slice(1);
    out.push(Object.fromEntries(head.map((h, i) => [h, v[i] ?? null])));
  });
  return out;
}
const s = (v: any) => (v === null || v === undefined ? null : String(v));
const num = (v: any) => (v === null || v === undefined ? null : Number(v));

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const sheet = (n: string) => rows(wb.getWorksheet(n)!);

  const data: EngineData = {
    employees: sheet("Employees").map((r) => ({ id: r.employee_id, ref: r.employee_id, name: r.name, department: r.department,
      approvalLimit: num(r.approval_limit), bankAccountId: s(r.bank_account_id), address: s(r.address), phone: s(r.phone) })),
    vendors: sheet("Vendors").map((r) => ({ id: r.vendor_id, ref: r.vendor_id, name: r.name, taxId: s(r.tax_id), address: s(r.address),
      phone: s(r.phone), createdAt: r.created_date, bankAccountId: s(r.bank_account_id), createdById: s(r.created_by) })),
    bankAccounts: sheet("BankAccounts").map((r) => ({ id: r.bank_account_id, ref: r.bank_account_id, accountNumberHash: s(r.account_number), bankName: s(r.bank_name) })),
    purchaseOrders: sheet("PurchaseOrders").map((r) => ({ id: r.po_id, ref: r.po_id, vendorId: r.vendor_id, amount: Number(r.amount), issuedDate: r.issued_date, approvedById: s(r.approved_by) })),
    invoices: sheet("Invoices").map((r) => ({ id: r.invoice_id, ref: r.invoice_id, vendorId: r.vendor_id, poId: s(r.po_id), invoiceNumber: String(r.invoice_number),
      amount: Number(r.amount), invoiceDate: r.invoice_date, approvedById: s(r.approved_by) })),
    transactions: sheet("Transactions").map((r) => ({ id: r.transaction_id, ref: r.transaction_id, invoiceId: s(r.invoice_id), vendorId: s(r.vendor_id), amount: Number(r.amount), postedAt: r.posted_at })),
  };

  const t0 = Date.now();
  const result = runRiskEngine(data);
  const ms = Date.now() - t0;

  console.log(`\nEngine ran in ${ms} ms on ${data.invoices.length} invoices`);
  console.log("summary:", JSON.stringify(result.summary, null, 1));

  console.log("\nTop cases");
  for (const c of result.cases.slice(0, 15)) {
    console.log(`${c.id} ${String(c.riskScore).padStart(5)} ${c.severity.padEnd(8)} exp=${String(Math.round(c.exposureAmount)).padStart(7)}  ${c.title.slice(0, 95)}`);
  }

  // ---- compare with the answer key ----
  const known = new Set(RULES.map((r) => r.key as string));
  const key = sheet("AnswerKey");
  const plantedEntities = new Set<string>();
  let pass = 0, fail = 0;
  console.log("\nPlanted scenarios");
  for (const row of key) {
    const expected = ((row.rule_that_should_fire as string).match(/[A-Z_]{6,}/g) ?? []).filter((x) => known.has(x));
    const ents = [row.vendors, row.employees].flatMap((x) => (x ? String(x).split(",").map((y) => y.trim()) : []));
    ents.forEach((e) => plantedEntities.add(e));
    const found = expected.map((rk) => ({
      rk, ok: result.signals.some((sg) => sg.ruleKey === rk && sg.entities.some((e) => ents.includes(e.id))),
    }));
    const theCase = result.cases.find((c) => c.entities.some((e) => ents.includes(e.id)));
    const ok = found.every((f) => f.ok);
    if (ok) pass++;
    else fail++;
    console.log(`${ok ? "PASS" : "FAIL"} ${String(row.scenario).padEnd(4)} ${found.map((f) => `${f.rk}${f.ok ? "" : " (MISSING)"}`).join(", ").padEnd(60)} -> ${theCase ? `${theCase.id} score ${theCase.riskScore} ${theCase.severity}` : "no case"}`);
  }
  console.log(`\n${pass} of ${pass + fail} scenarios detected`);

  // ---- anything flagged that was not planted ----
  const extraCases = result.cases.filter((c) => !c.entities.some((e) => plantedEntities.has(e.id)));
  console.log(`\nCases on records that were NOT planted: ${extraCases.length}`);
  for (const c of extraCases) console.log(`  ${c.id} ${c.riskScore} ${c.severity}  ${c.title.slice(0, 100)}`);
  const extraSignals = result.signals.filter((sg) => !sg.entities.some((e) => plantedEntities.has(e.id)));
  console.log(`Signals on records that were NOT planted: ${extraSignals.length}`);
  const byRule: Record<string, number> = {};
  extraSignals.forEach((sg) => (byRule[sg.ruleKey] = (byRule[sg.ruleKey] ?? 0) + 1));
  console.log("  by rule:", JSON.stringify(byRule));
}
main();
