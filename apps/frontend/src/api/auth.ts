import type { AuthUserView } from "@repo/shared";

import { api } from "./client";

export interface SessionResult {
  accessToken: string;
  user: AuthUserView;
}

export const login = (body: { email: string; password: string }): Promise<SessionResult> =>
  api.post<SessionResult>("/auth/login", body);

export const refresh = (): Promise<SessionResult> => api.post<SessionResult>("/auth/refresh", {});

export const logout = (): Promise<{ loggedOut: boolean }> => api.post<{ loggedOut: boolean }>("/auth/logout", {});

export const me = (): Promise<AuthUserView> => api.get<AuthUserView>("/auth/me");
