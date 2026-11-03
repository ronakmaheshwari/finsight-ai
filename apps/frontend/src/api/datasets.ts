import type {
  DatasetDetail,
  DatasetValidationView,
  RowFailureView,
  UploadResultView,
} from "@repo/shared";

import { api, ApiError } from "./client";

export const DATASET_ENTITIES = [
  "bank-accounts",
  "employees",
  "vendors",
  "purchase-orders",
  "invoices",
  "transactions",
] as const;

export type DatasetEntity = (typeof DATASET_ENTITIES)[number];

export const getDataset = (id: string): Promise<DatasetDetail> => api.get<DatasetDetail>(`/datasets/${id}`);

export const deleteDataset = (id: string): Promise<{ deleted: boolean }> =>
  api.delete<{ deleted: boolean }>(`/datasets/${id}`, { confirm: "true" });

export const validateDataset = (id: string): Promise<DatasetValidationView> =>
  api.post<DatasetValidationView>(`/datasets/${id}/validate`, {});

export const browseRows = (id: string, entity: DatasetEntity, query: Record<string, unknown>) =>
  api.page<Record<string, unknown>>(`/datasets/${id}/data/${entity}`, query);

export const uploadRows = async (
  id: string,
  entity: DatasetEntity,
  file: File,
): Promise<UploadResultView> => {
  try {
    return await api.upload<UploadResultView>(`/datasets/${id}/upload/${entity}`, file);
  } catch (error) {
    // 422 = row-level validation failure; the payload carries the row errors.
    if (error instanceof ApiError && error.status === 422 && Array.isArray(error.details)) {
      throw new RowUploadError(error.message, error.details as RowFailureView[]);
    }
    throw error;
  }
};

export class RowUploadError extends Error {
  readonly errors: RowFailureView[];

  constructor(message: string, errors: RowFailureView[]) {
    super(message);
    this.name = "RowUploadError";
    this.errors = errors;
  }
}
