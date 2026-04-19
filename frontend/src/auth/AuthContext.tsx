import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '../api/auth';
import type { MeUser } from '../types/user';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  registerLogoutHandler,
  registerRefreshHandler,
  setAccessToken,
  setRefreshToken,
} from './tokenStore';
import {
  extractAccessToken,
  extractErrorMessage,
  extractRefreshToken,
  unwrapMeResponse,
} from './authHelpers';
import { useAuthBoot } from './useAuthBoot';

export type AuthContextValue = {
  user: MeUser | null;
  permissions: string[];
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Provides authentication state and token lifecycle helpers to the app.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const [user, setUser] = useState<MeUser | null>(null);
  const [permissionsState, setPermissionsState] = useState<string[]>([]);
  const [accessTokenState, setAccessTokenState] = useState<string | null>(() => getAccessToken());
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = Boolean(accessTokenState);

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
      if (refreshToken) await authApi.logout({ refreshToken });
    } catch {
      // best effort
    } finally {
      clearTokens();
      setAccessTokenState(null);
      setUser(null);
      setPermissionsState([]);
      navigate('/login', { replace: true });
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
          error: 'Login succeeded but access/refresh tokens were not returned.',
        };
      }
      setAccessToken(token);
      setRefreshToken(refreshToken);
      setAccessTokenState(token);
      try {
        const meRes = await authApi.me();
        const me = unwrapMeResponse(meRes);
        setUser(me.user);
        setPermissionsState(me.permissions);
      } catch {
        setUser(null);
        setPermissionsState([]);
      }
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: extractErrorMessage(err) };
    }
  }, []);

  useAuthBoot({
    user,
    isLoading,
    accessTokenState,
    setUser,
    setPermissionsState,
    setAccessTokenState,
    setIsLoading,
  });

  useEffect(() => {
    registerRefreshHandler(refresh);
    registerLogoutHandler(logout);
    return () => {
      registerRefreshHandler(null);
      registerLogoutHandler(null);
    };
  }, [logout, refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions: permissionsState,
      accessToken: accessTokenState,
      isAuthenticated,
      isLoading,
      login,
      logout,
      refresh,
    }),
    [accessTokenState, isAuthenticated, isLoading, login, logout, permissionsState, refresh, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
