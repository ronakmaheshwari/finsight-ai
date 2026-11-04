import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUserView, RegisterInput } from "@repo/shared";

import * as authApi from "@/api/auth";
import { refreshSession, setAccessToken, setRefreshHandler } from "@/api/client";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: AuthUserView | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUserView | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const applySession = useCallback((session: authApi.SessionResult, profile?: AuthUserView) => {
    setAccessToken(session.accessToken);
    setUser(profile ?? session.user);
    setStatus("authenticated");
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await authApi.login({ email, password });
      applySession(session);
    },
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const session = await authApi.register(input);
      applySession(session);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The local session is cleared either way.
    }
    clearSession();
  }, [clearSession]);

  // The refresh handler is registered before boot so concurrent 401s wait on it.
  useEffect(() => {
    setRefreshHandler(async () => {
      try {
        const session = await authApi.refresh();
        applySession(session);
        return true;
      } catch {
        clearSession();
        return false;
      }
    });

    return () => setRefreshHandler(null);
  }, [applySession, clearSession]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        // Boot sequence (§11.5): refresh the cookie session, then read the
        // canonical profile. The splash stays until both settle.
        //
        // Refresh tokens rotate, so two concurrent refreshes make the second one
        // 401 and log the user out. Going through the single-flight helper means
        // the boot sequence and any 401 retry share one call (StrictMode mounts
        // effects twice in development).
        const refreshed = await refreshSession();
        if (!refreshed) {
          if (!cancelled) clearSession();
          return;
        }
        // `me()` is an authenticated call, so the fresh token has to be in the
        // client before it goes out — otherwise every reload 401s and the user
        // is bounced to the login page.
        const profile = await authApi.me();
        if (!cancelled) setUser(profile);
      } catch {
        if (!cancelled) clearSession();
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);
  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components -- the hook and its provider belong together.
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};
