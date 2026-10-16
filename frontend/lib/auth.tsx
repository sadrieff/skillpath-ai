"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { API_URL, AUTH_EVENT, clearToken, getMe, getToken, setToken } from "./api";
import type { User } from "./types";

/** URL that starts the Google OAuth flow on the backend. */
export function googleLoginUrl(): string {
  return `${API_URL}/api/auth/google/login`;
}

interface AuthContextValue {
  user: User | null;
  /** True until the stored token (if any) has been checked against /api/auth/me. */
  loading: boolean;
  /** Re-fetch the current user from the stored token. Returns the user or null. */
  refresh: () => Promise<User | null>;
  /** Store a JWT (e.g. from /auth/callback or dev-login), then load the user. */
  loginWithToken: (token: string) => Promise<User | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<User | null> => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const me = await getMe();
      setUser(me);
      return me;
    } catch {
      // 401 already cleared the token inside the api wrapper
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Token cleared elsewhere (401 in any request) -> sync the user state.
  useEffect(() => {
    const onChange = () => {
      void refresh();
    };
    window.addEventListener(AUTH_EVENT, onChange);
    return () => window.removeEventListener(AUTH_EVENT, onChange);
  }, [refresh]);

  const loginWithToken = useCallback(
    async (token: string): Promise<User | null> => {
      setToken(token);
      return refresh();
    },
    [refresh],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    router.push("/");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, refresh, loginWithToken, logout }),
    [user, loading, refresh, loginWithToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
