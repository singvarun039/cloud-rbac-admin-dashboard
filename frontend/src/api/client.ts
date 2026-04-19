import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, logout, refreshAccessToken } from '../auth/tokenStore';

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
  // Useful for local dev: if you don't set VITE_API_BASE_URL, axios will use same-origin.
  // This keeps the app running but makes misconfig easy to spot.
  console.warn('[api] VITE_API_BASE_URL is not set; using same-origin requests');
}

export const api = axios.create({
  baseURL: baseURL || undefined,
});

export type ApiErrorEnvelope = {
  ok?: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  requestId?: string;
  message?: string;
  [key: string]: unknown;
};

// Narrows unknown values into plain object records.
function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

// Extracts the most helpful error message from an API failure.
export function getApiErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as unknown;
    const record = asRecord(data);
    const envelopeError = record?.error;

    const envelopeErrorRecord =
      envelopeError && typeof envelopeError === 'object' && envelopeError !== null
        ? (envelopeError as Record<string, unknown>)
        : null;

    const messageFromEnvelope = envelopeErrorRecord?.message;

    // Prefer field-level validation errors if available.
    const codeFromEnvelope = envelopeErrorRecord?.code;
    const detailsFromEnvelope = envelopeErrorRecord?.details;
    const issues =
      detailsFromEnvelope &&
      typeof detailsFromEnvelope === 'object' &&
      detailsFromEnvelope !== null &&
      'issues' in (detailsFromEnvelope as Record<string, unknown>)
        ? (detailsFromEnvelope as { issues?: unknown }).issues
        : undefined;

    if (codeFromEnvelope === 'VALIDATION_ERROR' && Array.isArray(issues)) {
      const first = issues[0] as { path?: unknown; message?: unknown } | undefined;
      const issueMessage =
        first && typeof first.message === 'string' && first.message.trim() ? first.message : null;
      const issuePath =
        first && typeof first.path === 'string' && first.path.trim() ? first.path : null;

      if (issueMessage && issuePath) return `${issuePath}: ${issueMessage}`;
      if (issueMessage) return issueMessage;
    }

    const message =
      (typeof messageFromEnvelope === 'string' && messageFromEnvelope.trim()
        ? messageFromEnvelope
        : undefined) ??
      (typeof record?.message === 'string' && record.message.trim() ? record.message : undefined);

    if (message) return message;

    // Avoid showing Axios generic "Request failed with status code XYZ" when server gave no message.
    if (err.response) return fallback;

    return typeof err.message === 'string' && err.message.trim() ? err.message : fallback;
  }

  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let isRefreshing = false;
const pendingRequests: Array<{
  config: RetriableRequestConfig;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

// Detects whether a headers object is an AxiosHeaders instance.
function isAxiosHeaders(value: unknown): value is AxiosHeaders {
  return (
    Boolean(value) && typeof value === 'object' && typeof (value as AxiosHeaders).set === 'function'
  );
}

// Writes a bearer token onto a request config's headers.
function setAuthorizationHeader(config: { headers?: unknown }, token: string) {
  const headerValue = `Bearer ${token}`;
  if (isAxiosHeaders(config.headers)) {
    config.headers.set('Authorization', headerValue);
    return;
  }

  const recordHeaders =
    config.headers && typeof config.headers === 'object'
      ? (config.headers as Record<string, unknown>)
      : {};

  config.headers = {
    ...recordHeaders,
    Authorization: headerValue,
  };
}

// Returns the normalized request URL from an Axios config.
function getRequestUrl(config: InternalAxiosRequestConfig | undefined): string {
  return String(config?.url ?? '');
}

// Checks whether a request is targeting the refresh endpoint.
function isRefreshRequest(url: string): boolean {
  return url.includes('/auth/refresh');
}

// Replays queued requests after a refresh attempt completes.
function flushPendingRequests(error: unknown, newToken: string | null) {
  const queued = pendingRequests.splice(0, pendingRequests.length);

  queued.forEach(({ config, resolve, reject }) => {
    if (!newToken) {
      reject(error);
      return;
    }

    setAuthorizationHeader(config, newToken);
    void api
      .request(config)
      .then((res) => resolve(res))
      .catch((err) => reject(err));
  });
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  const url = getRequestUrl(config);

  // Refresh must NOT carry the (possibly corrupted) access token.
  if (token && !isRefreshRequest(url)) {
    setAuthorizationHeader(config, token);
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const config = axiosError.config as RetriableRequestConfig | undefined;

    if (status !== 401 || !config) {
      return Promise.reject(error);
    }

    const url = getRequestUrl(config);

    // Avoid recursion: never attempt refresh when refresh itself 401s.
    if (isRefreshRequest(url)) {
      await logout();
      return Promise.reject(error);
    }

    if (config._retry) {
      await logout();
      return Promise.reject(error);
    }

    config._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingRequests.push({ config, resolve, reject });
      });
    }

    isRefreshing = true;

    try {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        await logout();
        flushPendingRequests(error, null);
        return Promise.reject(error);
      }

      flushPendingRequests(null, newToken);
      setAuthorizationHeader(config, newToken);
      return api.request(config);
    } catch (refreshErr) {
      await logout();
      flushPendingRequests(refreshErr, null);
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);
