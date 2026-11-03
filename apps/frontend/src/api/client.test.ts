import { describe, expect, it, vi, afterEach } from "vitest";

import { ApiError, api, normalizeBaseUrl, refreshSession, setAccessToken, setRefreshHandler } from "./client";

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("refreshSession", () => {
  afterEach(() => {
    setRefreshHandler(null);
    setAccessToken(null);
  });

  it("runs one refresh for concurrent callers", async () => {
    let settle: (value: boolean) => void = () => {};
    const handler = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    );
    setRefreshHandler(handler);

    const first = refreshSession();
    const second = refreshSession();

    expect(handler).toHaveBeenCalledTimes(1);

    settle(true);
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
  });

  it("allows a new refresh once the previous one settles", async () => {
    const handler = vi.fn(async () => true);
    setRefreshHandler(handler);

    await refreshSession();
    await refreshSession();

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("resolves false when no handler is registered", async () => {
    await expect(refreshSession()).resolves.toBe(false);
  });
});

describe("api retry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setRefreshHandler(null);
    setAccessToken(null);
  });

  it("retries a 401 once with the refreshed access token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "UNAUTHORIZED", message: "expired" } }, 401))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ok: true } }, 200));
    vi.stubGlobal("fetch", fetchMock);

    setAccessToken("stale-token");
    setRefreshHandler(async () => {
      setAccessToken("fresh-token");
      return true;
    });

    await expect(api.get<{ ok: boolean }>("/cases")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const retryInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe("Bearer fresh-token");
  });

  it("surfaces the server error envelope as an ApiError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "FORBIDDEN", message: "Role not allowed", details: { role: "VIEWER" } } }, 403),
      );
    vi.stubGlobal("fetch", fetchMock);

    const failure = api.get("/cases");
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "Role not allowed",
      details: { role: "VIEWER" },
    });
  });
});

describe("normalizeBaseUrl", () => {
  it("keeps a versioned base as written", () => {
    expect(normalizeBaseUrl("http://localhost:3000/api/v1")).toBe("http://localhost:3000/api/v1");
  });

  it("adds the version segment to a bare host", () => {
    expect(normalizeBaseUrl("http://localhost:3000")).toBe("http://localhost:3000/api/v1");
    expect(normalizeBaseUrl("http://localhost:3000/")).toBe("http://localhost:3000/api/v1");
  });

  it("never leaves a trailing slash or a double slash", () => {
    expect(normalizeBaseUrl(" https://api.example.com/api/v1/// ")).toBe("https://api.example.com/api/v1");
  });

  it("keeps a relative base for a proxied deployment", () => {
    expect(normalizeBaseUrl("/api/v1")).toBe("/api/v1");
  });
});
