const ACCESS_TOKEN_KEY = "cr_rbac_access_token";

// Day 11: simplest approach is localStorage.
// We'll improve this later (Day 12+) with a safer strategy.
export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearAccessToken(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function isAuthed(): boolean {
  return Boolean(getAccessToken());
}
