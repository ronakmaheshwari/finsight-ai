import type { Prisma } from "@prisma/client";
import db from "@repo/db";

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface DatasetValidationResult {
  status: "VALIDATED" | "FAILED";
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  stats: {
    invoices: number;
    vendors: number;
    employees: number;
    dateRange: { from: string | null; to: string | null };
    invoiceTotal: number;
    paymentTotal: number;
  };
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
const day = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Cross-file checks (D5). Runs synchronously: a dataset is small enough that a
 * background job would add latency without benefit.
 */
export const validateDataset = async (datasetId: string): Promise<DatasetValidationResult> => {
  const dataset = await db.dataset.findUnique({
    where: { id: datasetId },
    include: { engagement: { select: { periodStart: true, periodEnd: true } } },
  });

  if (!dataset) throw new Error(`Dataset ${datasetId} not found`);

  await db.dataset.update({ where: { id: datasetId }, data: { status: "VALIDATING" } });

  const where = { datasetId };
  const [invoiceCount, vendorCount, employeeCount, bankAccountCount, poCount, transactionCount] =
    await Promise.all([
      db.invoice.count({ where }),
      db.vendor.count({ where }),
      db.employee.count({ where }),
      db.bankAccount.count({ where }),
      db.purchaseOrder.count({ where }),
      db.transaction.count({ where }),
    ]);

  const invoices = await db.invoice.findMany({
    where,
    select: { id: true, amount: true, invoiceDate: true, vendorId: true },
  });

  const invoiceAgg = await db.invoice.aggregate({ where, _sum: { amount: true } });
  const paymentAgg = await db.transaction.aggregate({ where, _sum: { amount: true } });

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  if (vendorCount === 0 || invoiceCount === 0) {
    errors.push({
      code: "NO_VENDORS_OR_INVOICES",
      message: "Both the vendors file and the invoices file must be uploaded before analysis.",
    });
  }

  if (employeeCount === 0) {
    warnings.push({
      code: "NO_EMPLOYEES",
      message: "No employees uploaded: relationship and control rules will be limited.",
    });
  }

  if (bankAccountCount === 0) {
    warnings.push({
      code: "NO_BANK_ACCOUNTS",
      message: "No bank accounts uploaded: SHARED_BANK_ACCOUNT cannot fire.",
    });
  }

  if (poCount === 0) {
    warnings.push({
      code: "NO_PURCHASE_ORDERS",
      message: "No purchase orders uploaded: every invoice would be flagged as having no PO. Consider disabling INVOICE_PO_MISMATCH.",
    });
  }

  if (transactionCount === 0) {
    warnings.push({
      code: "NO_TRANSACTIONS",
      message: "No transactions uploaded: WEEKEND_OFFHOURS cannot fire and payments cannot be checked.",
    });
  }

  if (invoiceCount > 0 && invoiceCount < 30) {
    warnings.push({
      code: "SMALL_POPULATION",
      message: `Only ${invoiceCount} invoices: statistical rules are unreliable on small populations.`,
    });
  }

  const invoiceTotal = Number(invoiceAgg._sum.amount ?? 0);
  const paymentTotal = Number(paymentAgg._sum.amount ?? 0);

  if (invoiceCount > 0 && transactionCount > 0 && invoiceTotal > 0) {
    const diff = Math.abs(paymentTotal - invoiceTotal) / invoiceTotal;
    if (diff > 0.01) {
      warnings.push({
        code: "PAYMENT_TOTAL_MISMATCH",
        message: `Payments (${round2(paymentTotal)}) differ from invoices (${round2(invoiceTotal)}) by ${(diff * 100).toFixed(1)}%.`,
      });
    }
  }

  const { periodStart, periodEnd } = dataset.engagement;
  const outside = invoices.filter(
    (invoice) => invoice.invoiceDate < periodStart || invoice.invoiceDate > periodEnd,
  );

  if (outside.length > 0) {
    warnings.push({
      code: "OUTSIDE_PERIOD",
      message: `${outside.length} of ${invoices.length} invoices (${((outside.length / invoices.length) * 100).toFixed(1)}%) are dated outside the engagement period.`,
    });
  }

  if (invoiceCount > 0 && vendorCount > 0) {
    const vendors = await db.vendor.findMany({
      where,
      select: { id: true, createdAt: true },
    });
    const vendorCreatedAt = new Map(vendors.map((vendor) => [vendor.id, vendor.createdAt]));
    const beforeVendor = invoices.filter((invoice) => {
      const createdAt = vendorCreatedAt.get(invoice.vendorId);
      return createdAt !== undefined && invoice.invoiceDate < createdAt;
    });

    if (beforeVendor.length > 0) {
      info.push({
        code: "INVOICE_BEFORE_VENDOR",
        message: `${beforeVendor.length} invoice(s) are dated before their vendor's created date.`,
      });
    }
  }

  const dates = invoices.map((invoice) => invoice.invoiceDate.getTime());
  const status = errors.length > 0 ? "FAILED" : "VALIDATED";

  const stats = {
    invoices: invoiceCount,
    vendors: vendorCount,
    employees: employeeCount,
    dateRange: {
      from: dates.length > 0 ? day(new Date(Math.min(...dates))) : null,
      to: dates.length > 0 ? day(new Date(Math.max(...dates))) : null,
    },
    invoiceTotal: round2(invoiceTotal),
    paymentTotal: round2(paymentTotal),
  };

  const checks = { errors, warnings, info, stats };

  const existing =
    dataset.validationErrors !== null && typeof dataset.validationErrors === "object" && !Array.isArray(dataset.validationErrors)
      ? (dataset.validationErrors as Record<string, unknown>)
      : {};

  await db.dataset.update({
    where: { id: datasetId },
    data: {
      status,
      validationErrors: { ...existing, checks } as unknown as Prisma.InputJsonObject,
    },
  });

  return { status, errors, warnings, info, stats };
};
