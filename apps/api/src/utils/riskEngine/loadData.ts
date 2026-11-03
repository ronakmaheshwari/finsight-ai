import type { Prisma, PrismaClient } from "@prisma/client";

import type { EngineData } from "./types";

/** The engine runs inside a transaction during an analysis, or on the client directly. */
type EngineClient = PrismaClient | Prisma.TransactionClient;

const num = (x: unknown): number | null => (x === null || x === undefined ? null : Number(x)); // Prisma Decimal -> number

export async function loadEngineData(prisma: EngineClient, datasetId: string): Promise<EngineData> {
  const where = { datasetId };
  const [employees, vendors, bankAccounts, purchaseOrders, invoices, transactions] = await Promise.all([
    prisma.employee.findMany({ where }),
    prisma.vendor.findMany({ where }),
    prisma.bankAccount.findMany({ where }),
    prisma.purchaseOrder.findMany({ where }),
    prisma.invoice.findMany({ where }),
    prisma.transaction.findMany({ where }),
  ]);

  return {
    employees: employees.map((e) => ({
      id: e.id, ref: e.externalId, name: e.name, department: e.department,
      approvalLimit: num(e.approvalLimit), bankAccountId: e.bankAccountId, address: e.address, phone: e.phone,
    })),
    vendors: vendors.map((v) => ({
      id: v.id, ref: v.externalId, name: v.name, taxId: v.taxId, address: v.address, phone: v.phone,
      createdAt: v.createdAt, bankAccountId: v.bankAccountId, createdById: v.createdById ?? null,
    })),
    bankAccounts: bankAccounts.map((b) => ({
      id: b.id, ref: b.externalId ?? b.id, accountNumberHash: b.accountNumberHash, bankName: b.bankName,
    })),
    purchaseOrders: purchaseOrders.map((p) => ({
      id: p.id, ref: p.externalId, vendorId: p.vendorId, amount: Number(p.amount), issuedDate: p.issuedDate, approvedById: p.approvedById,
    })),
    invoices: invoices.map((i) => ({
      id: i.id, ref: i.externalId, vendorId: i.vendorId, poId: i.poId, invoiceNumber: i.invoiceNumber,
      amount: Number(i.amount), invoiceDate: i.invoiceDate, approvedById: i.approvedById,
    })),
    transactions: transactions.map((t) => ({
      id: t.id, ref: t.externalId, invoiceId: t.invoiceId, vendorId: t.vendorId, amount: Number(t.amount), postedAt: t.postedAt,
    })),
  };
}
