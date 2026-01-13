import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import * as authApi from "../api/auth";
import type { MeUser } from "../types/user";
import { unwrapData } from "../types/api";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  registerLogoutHandler,
  registerRefreshHandler,
  setAccessToken,
  setRefreshToken,
} from "./tokenStore";

export type AuthContextValue = {
  user: MeUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function extractAccessToken(payload: unknown): string | null {
  const unwrapped = unwrapData<Record<string, unknown>>(payload);
  const candidate = asRecord(unwrapped ?? payload);
  if (!candidate) return null;

  const data = asRecord(candidate.data);

  const direct =
    candidate.accessToken ??
    candidate.token ??
    data?.accessToken ??
    data?.token;

  return typeof direct === "string" && direct.length > 0 ? direct : null;
}

function extractRefreshToken(payload: unknown): string | null {
  const unwrapped = unwrapData<Record<string, unknown>>(payload);
  const candidate = asRecord(unwrapped ?? payload);
  if (!candidate) return null;

  const data = asRecord(candidate.data);
  const direct = candidate.refreshToken ?? data?.refreshToken;

  return typeof direct === "string" && direct.length > 0 ? direct : null;
}

function extractErrorMessage(err: unknown): string {
  const anyErr = err as {
    message?: unknown;
    response?: {
      data?: unknown;
    };
  };

  const data = asRecord(anyErr?.response?.data);
  const messageFromApi = data?.message;
  const errorFromApi = data?.error;

  return (
    (typeof messageFromApi === "string" ? messageFromApi : null) ||
    (typeof errorFromApi === "string" ? errorFromApi : null) ||
    (typeof anyErr?.message === "string" ? anyErr.message : null) ||
    "Request failed."
  );
}

function unwrapMeUser(payload: unknown): MeUser | null {
  const unwrapped = unwrapData<MeUser>(payload);
  const candidate = (unwrapped ?? payload) as unknown;

  const record = asRecord(candidate);
  if (!record) return null;

  if (typeof record.id === "string" && typeof record.email === "string") {
    return record as unknown as MeUser;
  }

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const [user, setUser] = useState<MeUser | null>(null);
  const [accessTokenState, setAccessTokenState] = useState<string | null>(() =>
    getAccessToken()
  );
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = Boolean(accessTokenState);

  const userRef = useRef<MeUser | null>(user);
  const isLoadingRef = useRef<boolean>(isLoading);

  const rehydrateInFlightRef = useRef(false);
  const bootRetryScheduledRef = useRef(false);
  const focusRetryAttemptedRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    // New token => allow a new focus retry attempt.
    focusRetryAttemptedRef.current = false;
    bootRetryScheduledRef.current = false;
  }, [accessTokenState]);

  const rehydrateUser = useCallback(async (): Promise<void> => {
    if (!getAccessToken()) return;
    if (rehydrateInFlightRef.current) return;

    rehydrateInFlightRef.current = true;
    try {
      const meRes = await authApi.me();
      const me = unwrapMeUser(meRes);
      setUser(me);

      if (!me) {
        // Keep user nullable; do not clear tokens unless server says 401.
        return;
      }

      // If we successfully rehydrated, allow future focus retries if it becomes null again.
      focusRetryAttemptedRef.current = false;
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401) {
        clearTokens();
        setAccessTokenState(null);
        setUser(null);
      } else {
        setUser(null);
      }
    } finally {
      rehydrateInFlightRef.current = false;
    }
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return null;

      const res = await authApi.refresh({ refreshToken });
      const newAccessToken = extractAccessToken(res);
      const newRefreshToken = extractRefreshToken(res);
      if (!newAccessToken || !newRefreshToken) return null;

      setAccessToken(newAccessToken);
      setRefreshToken(newRefreshToken);
      setAccessTokenState(newAccessToken);
      return newAccessToken;
    } catch {
      return null;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await authApi.logout({ refreshToken });
      }
    } catch {
      // best effort
    } finally {
      clearTokens();
      setAccessTokenState(null);
      setUser(null);
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await authApi.login({ email, password });
      const token = extractAccessToken(res);
      const refreshToken = extractRefreshToken(res);

      if (!token || !refreshToken) {
        return {
          ok: false as const,
          error: "Login succeeded but access/refresh tokens were not returned.",
        };
      }

      setAccessToken(token);
      setRefreshToken(refreshToken);
      setAccessTokenState(token);

      try {
        const meRes = await authApi.me();
        const me = unwrapMeUser(meRes);
        setUser(me);
      } catch {
        // keep user nullable for stability (e.g., transient network error)
        setUser(null);
      }

      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: extractErrorMessage(err) };
    }
  }, []);

  useEffect(() => {
    registerRefreshHandler(refresh);
    registerLogoutHandler(logout);

    return () => {
      registerRefreshHandler(null);
      registerLogoutHandler(null);
    };
  }, [logout, refresh]);

  useEffect(() => {
    let cancelled = false;
    let bootRetryTimeout: number | null = null;

    async function boot() {
      const token = getAccessToken();
      setAccessTokenState(token);

      if (!token) {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const meRes = await authApi.me();
        const me = unwrapMeUser(meRes);
        if (!cancelled) setUser(me);
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        if (status === 401) {
          clearTokens();
          if (!cancelled) {
            setAccessTokenState(null);
            setUser(null);
          }
        } else {
          if (!cancelled) setUser(null);

          // One-time delayed retry (helps with transient network errors)
          if (!bootRetryScheduledRef.current) {
            bootRetryScheduledRef.current = true;
            bootRetryTimeout = window.setTimeout(() => {
              if (!getAccessToken()) return;
              if (userRef.current) return;
              if (isLoadingRef.current) return;
              void rehydrateUser();
            }, 1500);
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    boot();

    return () => {
      cancelled = true;
      if (bootRetryTimeout !== null) {
        window.clearTimeout(bootRetryTimeout);
      }
    };
  }, [rehydrateUser]);

  useEffect(() => {
    function onFocus() {
      if (!getAccessToken()) return;
      if (isLoadingRef.current) return;
      if (userRef.current) return;
      if (focusRetryAttemptedRef.current) return;

      focusRetryAttemptedRef.current = true;
      void rehydrateUser();
    }

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [rehydrateUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken: accessTokenState,
      isAuthenticated,
      isLoading,
      login,
      logout,
      refresh,
    }),
    [accessTokenState, isAuthenticated, isLoading, login, logout, refresh, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
