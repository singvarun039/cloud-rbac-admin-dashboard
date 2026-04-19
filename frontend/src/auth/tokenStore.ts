const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

let inMemoryAccessToken: string | null = null;
let inMemoryRefreshToken: string | null = null;

type RefreshHandler = () => Promise<string | null>;
type LogoutHandler = () => void | Promise<void>;

let refreshHandler: RefreshHandler | null = null;
let logoutHandler: LogoutHandler | null = null;

// Returns the current access token from memory or storage.
export function getAccessToken(): string | null {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  try {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    inMemoryAccessToken = token;
    return token;
  } catch {
    return null;
  }
}

// Updates the current access token in memory and storage.
export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
  try {
    if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // ignore
  }
}

// Clears the current access token from memory and storage.
export function clearAccessToken(): void {
  setAccessToken(null);
}

// Returns the current refresh token from memory or storage.
export function getRefreshToken(): string | null {
  if (inMemoryRefreshToken) return inMemoryRefreshToken;
  try {
    const token = localStorage.getItem(REFRESH_TOKEN_KEY);
    inMemoryRefreshToken = token;
    return token;
  } catch {
    return null;
  }
}

// Updates the current refresh token in memory and storage.
export function setRefreshToken(token: string | null): void {
  inMemoryRefreshToken = token;
  try {
    if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

// Clears the current refresh token from memory and storage.
export function clearRefreshToken(): void {
  setRefreshToken(null);
}

// Clears both stored authentication tokens.
export function clearTokens(): void {
  clearAccessToken();
  clearRefreshToken();
}

// Registers the refresh callback used by the Axios client.
export function registerRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler;
}

// Registers the logout callback used by the Axios client.
export function registerLogoutHandler(handler: LogoutHandler | null): void {
  logoutHandler = handler;
}

// Invokes the registered refresh callback if one exists.
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshHandler) return null;
  return refreshHandler();
}

// Logs the user out through the registered logout handler or fallback flow.
export async function logout(): Promise<void> {
  if (logoutHandler) {
    await logoutHandler();
    return;
  }

  clearTokens();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}
