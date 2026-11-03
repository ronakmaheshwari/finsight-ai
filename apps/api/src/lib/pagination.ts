import type { PageMeta } from "@repo/shared";

export interface Paging {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export const MAX_PAGE_SIZE = 100;

export const getPaging = (query: { page?: number; pageSize?: number }): Paging => {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize ?? 25)));

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
};

export const pageMeta = (total: number, paging: Paging): PageMeta => ({
  page: paging.page,
  pageSize: paging.pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / paging.pageSize)),
});

/** Comma-separated query values ("HIGH,CRITICAL") -> a clean array. */
export const csvList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
