import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import * as authApi from '../api/auth';
import type { MeUser } from '../types/user';
import { clearTokens, getAccessToken } from './tokenStore';
import { unwrapMeResponse } from './authHelpers';

// Encapsulates all boot-time auth logic: initial user rehydration, retry on error, and focus-based re-auth.
export function useAuthBoot(opts: {
  user: MeUser | null;
  isLoading: boolean;
  accessTokenState: string | null;
  setUser: Dispatch<SetStateAction<MeUser | null>>;
  setPermissionsState: Dispatch<SetStateAction<string[]>>;
  setAccessTokenState: Dispatch<SetStateAction<string | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    user,
    isLoading,
    accessTokenState,
    setUser,
    setPermissionsState,
    setAccessTokenState,
    setIsLoading,
  } = opts;

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
    focusRetryAttemptedRef.current = false;
    bootRetryScheduledRef.current = false;
  }, [accessTokenState]);

  const rehydrateUser = useCallback(async (): Promise<void> => {
    if (!getAccessToken()) return;
    if (rehydrateInFlightRef.current) return;
    rehydrateInFlightRef.current = true;
    try {
      const meRes = await authApi.me();
      const me = unwrapMeResponse(meRes);
      setUser(me.user);
      setPermissionsState(me.permissions);
      userRef.current = me.user;
      if (me.user) focusRetryAttemptedRef.current = false;
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        clearTokens();
        setAccessTokenState(null);
        setUser(null);
        setPermissionsState([]);
        userRef.current = null;
      } else {
        setUser(null);
        setPermissionsState([]);
        userRef.current = null;
      }
    } finally {
      rehydrateInFlightRef.current = false;
    }
  }, [setAccessTokenState, setPermissionsState, setUser]);

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
          userRef.current = null;
          isLoadingRef.current = false;
        }
        return;
      }
      try {
        const meRes = await authApi.me();
        const me = unwrapMeResponse(meRes);
        if (!cancelled) {
          setUser(me.user);
          setPermissionsState(me.permissions);
          userRef.current = me.user;
        }
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          clearTokens();
          if (!cancelled) {
            setAccessTokenState(null);
            setUser(null);
            setPermissionsState([]);
            userRef.current = null;
          }
        } else {
          if (!cancelled) {
            setUser(null);
            setPermissionsState([]);
            userRef.current = null;
          }
          if (!bootRetryScheduledRef.current) {
            bootRetryScheduledRef.current = true;
            bootRetryTimeout = window.setTimeout(() => {
              if (!getAccessToken() || userRef.current || isLoadingRef.current) return;
              void rehydrateUser();
            }, 1500);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          isLoadingRef.current = false;
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
      if (bootRetryTimeout !== null) window.clearTimeout(bootRetryTimeout);
    };
  }, [rehydrateUser, setAccessTokenState, setIsLoading, setPermissionsState, setUser]);

  useEffect(() => {
    function onFocus() {
      if (
        !getAccessToken() ||
        isLoadingRef.current ||
        userRef.current ||
        focusRetryAttemptedRef.current
      )
        return;
      focusRetryAttemptedRef.current = true;
      void rehydrateUser();
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [rehydrateUser]);
}
