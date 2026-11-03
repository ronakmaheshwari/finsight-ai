import db from "@repo/db";
import { getPaging, type Paging } from "../lib/pagination";
import type { Entity } from "./spec";

export interface BrowseQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface BrowseResult {
  rows: Record<string, unknown>[];
  total: number;
  paging: Paging;
}

const SORTABLE: Record<Entity, string[]> = {
  "bank-accounts": ["externalId", "bankName"],
  employees: ["externalId", "name", "department", "approvalLimit"],
  vendors: ["externalId", "name", "createdAt", "status"],
  "purchase-orders": ["externalId", "amount", "issuedDate"],
  invoices: ["externalId", "invoiceNumber", "amount", "invoiceDate"],
  transactions: ["externalId", "amount", "postedAt"],
};

const orderBy = (
  entity: Entity,
  query: BrowseQuery,
): Record<string, "asc" | "desc"> => {
  const allowed = SORTABLE[entity];
  const field = query.sortBy && allowed.includes(query.sortBy) ? query.sortBy : allowed[0] ?? "id";
  return { [field]: query.sortDir === "desc" ? "desc" : "asc" };
};

const money = (value: unknown): number => Number(value ?? 0);

export const browseDataset = async (
  datasetId: string,
  entity: Entity,
  query: BrowseQuery,
): Promise<BrowseResult> => {
  const paging = getPaging(query);
  const where = { datasetId };
  const q = query.q?.trim();

  switch (entity) {
    case "bank-accounts": {
      const filter = q
        ? {
            OR: [
              { externalId: { contains: q, mode: "insensitive" as const } },
              { bankName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {};
      const [total, rows] = await Promise.all([
        db.bankAccount.count({ where: { ...where, ...filter } }),
        db.bankAccount.findMany({
          where: { ...where, ...filter },
          orderBy: orderBy(entity, query),
          skip: paging.skip,
          take: paging.take,
          select: {
            id: true,
            externalId: true,
            bankName: true,
            _count: { select: { employees: true, vendors: true } },
          },
        }),
      ]);

      return {
        total,
        paging,
        rows: rows.map((row) => ({
          id: row.id,
          ref: row.externalId,
          bankName: row.bankName,
          holderCount: row._count.employees + row._count.vendors,
        })),
      };
    }

    case "employees": {
      const filter = q
        ? {
            OR: [
              { externalId: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
              { department: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {};
      const [total, rows] = await Promise.all([
        db.employee.count({ where: { ...where, ...filter } }),
        db.employee.findMany({
          where: { ...where, ...filter },
          orderBy: orderBy(entity, query),
          skip: paging.skip,
          take: paging.take,
          include: { bankAccount: { select: { externalId: true } } },
        }),
      ]);

      return {
        total,
        paging,
        rows: rows.map((row) => ({
          id: row.id,
          ref: row.externalId,
          name: row.name,
          department: row.department,
          approvalLimit: row.approvalLimit === null ? null : money(row.approvalLimit),
          bankAccountRef: row.bankAccount?.externalId ?? null,
        })),
      };
    }

    case "vendors": {
      const filter = q
        ? {
            OR: [
              { externalId: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {};
      const [total, rows] = await Promise.all([
        db.vendor.count({ where: { ...where, ...filter } }),
        db.vendor.findMany({
          where: { ...where, ...filter },
          orderBy: orderBy(entity, query),
          skip: paging.skip,
          take: paging.take,
          include: {
            bankAccount: { select: { externalId: true } },
            createdBy: { select: { externalId: true, name: true } },
          },
        }),
      ]);

      return {
        total,
        paging,
        rows: rows.map((row) => ({
          id: row.id,
          ref: row.externalId,
          name: row.name,
          taxId: row.taxId,
          createdAt: row.createdAt.toISOString(),
          status: row.status,
          bankAccountRef: row.bankAccount?.externalId ?? null,
          createdByRef: row.createdBy?.externalId ?? null,
          createdByName: row.createdBy?.name ?? null,
        })),
      };
    }

    case "purchase-orders": {
      const filter = q
        ? {
            OR: [
              { externalId: { contains: q, mode: "insensitive" as const } },
              { vendor: { name: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {};
      const [total, rows] = await Promise.all([
        db.purchaseOrder.count({ where: { ...where, ...filter } }),
        db.purchaseOrder.findMany({
          where: { ...where, ...filter },
          orderBy: orderBy(entity, query),
          skip: paging.skip,
          take: paging.take,
          include: {
            vendor: { select: { externalId: true, name: true } },
            approvedBy: { select: { externalId: true, name: true } },
          },
        }),
      ]);

      return {
        total,
        paging,
        rows: rows.map((row) => ({
          id: row.id,
          ref: row.externalId,
          vendorRef: row.vendor.externalId,
          vendorName: row.vendor.name,
          amount: money(row.amount),
          issuedDate: row.issuedDate.toISOString().slice(0, 10),
          approvedByRef: row.approvedBy?.externalId ?? null,
          approvedByName: row.approvedBy?.name ?? null,
        })),
      };
    }

    case "invoices": {
      const filter = q
        ? {
            OR: [
              { externalId: { contains: q, mode: "insensitive" as const } },
              { invoiceNumber: { contains: q, mode: "insensitive" as const } },
              { vendor: { name: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {};
      const [total, rows] = await Promise.all([
        db.invoice.count({ where: { ...where, ...filter } }),
        db.invoice.findMany({
          where: { ...where, ...filter },
          orderBy: orderBy(entity, query),
          skip: paging.skip,
          take: paging.take,
          include: {
            vendor: { select: { externalId: true, name: true } },
            purchaseOrder: { select: { externalId: true } },
            approvedBy: { select: { externalId: true, name: true } },
          },
        }),
      ]);

      return {
        total,
        paging,
        rows: rows.map((row) => ({
          id: row.id,
          ref: row.externalId,
          invoiceNumber: row.invoiceNumber,
          vendorRef: row.vendor.externalId,
          vendorName: row.vendor.name,
          poRef: row.purchaseOrder?.externalId ?? null,
          amount: money(row.amount),
          invoiceDate: row.invoiceDate.toISOString().slice(0, 10),
          approvedByRef: row.approvedBy?.externalId ?? null,
          approvedByName: row.approvedBy?.name ?? null,
        })),
      };
    }

    case "transactions": {
      const filter = q
        ? {
            OR: [
              { externalId: { contains: q, mode: "insensitive" as const } },
              { description: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {};
      const [total, rows] = await Promise.all([
        db.transaction.count({ where: { ...where, ...filter } }),
        db.transaction.findMany({
          where: { ...where, ...filter },
          orderBy: orderBy(entity, query),
          skip: paging.skip,
          take: paging.take,
          include: {
            invoice: { select: { externalId: true } },
            vendor: { select: { externalId: true } },
          },
        }),
      ]);

      return {
        total,
        paging,
        rows: rows.map((row) => ({
          id: row.id,
          ref: row.externalId,
          invoiceRef: row.invoice.externalId,
          vendorRef: row.vendor?.externalId ?? null,
          amount: money(row.amount),
          postedAt: row.postedAt.toISOString().slice(0, 10),
          description: row.description,
        })),
      };
    }
  }
};
