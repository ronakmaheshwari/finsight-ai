const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000/api/v1";

/**
 * Typed API failure. The server always answers with
 * `{ success: false, error: { code, message, details } }` (the upload route
 * also returns `message` and `errors`, which are mapped here).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: PageMeta;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** The access token lives in memory only (§11.5). */
let accessToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => accessToken;

/**
 * One single-flight refresh: every request that fails with 401 awaits the same
 * promise, and only one `POST /auth/refresh` is sent.
 */
let refreshHandler: (() => Promise<boolean>) | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export const setRefreshHandler = (handler: (() => Promise<boolean>) | null): void => {
  refreshHandler = handler;
};

export const refreshSession = (): Promise<boolean> => {
  if (!refreshInFlight) {
    refreshInFlight = (refreshHandler ? refreshHandler() : Promise.resolve(false)).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

const buildUrl = (path: string, query?: Record<string, unknown>): string => {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
};

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  formData?: FormData;
  query?: Record<string, unknown>;
  signal?: AbortSignal;
}

const parseFailure = async (response: Response): Promise<ApiError> => {
  let code = "HTTP_ERROR";
  let message = response.statusText || `Request failed with status ${response.status}`;
  let details: unknown;

  try {
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
      message?: string;
      errors?: unknown;
    };
    code = payload.error?.code ?? code;
    message = payload.error?.message ?? payload.message ?? message;
    details = payload.error?.details ?? payload.errors ?? payload;
  } catch {
    // Non-JSON error body (proxy, gateway). Keep the status text.
  }

  return new ApiError(response.status, code, message, details);
};

const send = async <T>(path: string, options: RequestOptions, allowRetry: boolean): Promise<ApiEnvelope<T>> => {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let body: BodyInit | undefined;
  if (options.formData) {
    // Never set Content-Type for FormData: the browser adds the boundary.
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body,
    credentials: "include",
    signal: options.signal,
  });

  if (response.status === 401 && allowRetry && !path.startsWith("/auth/")) {
    const refreshed = await refreshSession();
    if (refreshed) return send<T>(path, options, false);
  }

  if (!response.ok) throw await parseFailure(response);

  if (response.status === 204) return { success: true, data: undefined as T };

  const payload = (await response.json()) as ApiEnvelope<T>;
  return payload;
};

export const api = {
  get: async <T>(path: string, query?: Record<string, unknown>, signal?: AbortSignal): Promise<T> =>
    (await send<T>(path, { query, signal }, true)).data,

  page: async <T>(
    path: string,
    query?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<{ rows: T[]; meta: PageMeta }> => {
    const envelope = await send<T[]>(path, { query, signal }, true);
    return {
      rows: envelope.data,
      meta: envelope.meta ?? { page: 1, pageSize: envelope.data.length, total: envelope.data.length, totalPages: 1 },
    };
  },

  post: async <T>(path: string, body?: unknown): Promise<T> =>
    (await send<T>(path, { method: "POST", body: body ?? {} }, true)).data,

  patch: async <T>(path: string, body?: unknown): Promise<T> =>
    (await send<T>(path, { method: "PATCH", body: body ?? {} }, true)).data,

  delete: async <T>(path: string, query?: Record<string, unknown>): Promise<T> =>
    (await send<T>(path, { method: "DELETE", query }, true)).data,

  upload: async <T>(path: string, file: File): Promise<T> => {
    const formData = new FormData();
    formData.append("file", file);
    return (await send<T>(path, { method: "POST", formData }, true)).data;
  },

  /** Raw fetch for blobs (PDF, templates); the bearer header is required. */
  blob: async (path: string): Promise<Blob> => {
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const response = await fetch(buildUrl(path), { headers, credentials: "include" });
    if (response.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) return api.blob(path);
    }
    if (!response.ok) throw await parseFailure(response);
    return response.blob();
  },
};

export const errorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Something went wrong";
