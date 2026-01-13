import axios, {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { getAccessToken, logout, refreshAccessToken } from "../auth/tokenStore";

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
  // Useful for local dev: if you don't set VITE_API_BASE_URL, axios will use same-origin.
  // This keeps the app running but makes misconfig easy to spot.
  console.warn(
    "[api] VITE_API_BASE_URL is not set; using same-origin requests"
  );
}

export const api = axios.create({
  baseURL: baseURL || undefined,
});

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

function isAxiosHeaders(value: unknown): value is AxiosHeaders {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as AxiosHeaders).set === "function"
  );
}

function setAuthorizationHeader(config: { headers?: unknown }, token: string) {
  const headerValue = `Bearer ${token}`;
  if (isAxiosHeaders(config.headers)) {
    config.headers.set("Authorization", headerValue);
    return;
  }

  const recordHeaders =
    config.headers && typeof config.headers === "object"
      ? (config.headers as Record<string, unknown>)
      : {};

  config.headers = {
    ...recordHeaders,
    Authorization: headerValue,
  };
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
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

    const url = String(config.url ?? "");

    // Avoid recursion: never attempt refresh when refresh itself 401s.
    if (url.includes("/auth/refresh")) {
      await logout();
      return Promise.reject(error);
    }

    if (config._retry) {
      await logout();
      return Promise.reject(error);
    }

    config._retry = true;

    const newToken = await refreshAccessToken();
    if (!newToken) {
      await logout();
      return Promise.reject(error);
    }

    setAuthorizationHeader(config, newToken);

    return api.request(config);
  }
);
