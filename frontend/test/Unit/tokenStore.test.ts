import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadModule() {
  vi.resetModules();
  return import('../../src/auth/tokenStore');
}

describe('tokenStore', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/login');
  });

  it('persists access and refresh tokens', async () => {
    const store = await loadModule();

    store.setAccessToken('access-token');
    store.setRefreshToken('refresh-token');

    expect(store.getAccessToken()).toBe('access-token');
    expect(store.getRefreshToken()).toBe('refresh-token');

    store.clearTokens();

    expect(store.getAccessToken()).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
  });

  it('delegates to the registered refresh and logout handlers', async () => {
    const store = await loadModule();
    const refresh = vi.fn().mockResolvedValue('new-access');
    const logout = vi.fn().mockResolvedValue(undefined);

    store.registerRefreshHandler(refresh);
    store.registerLogoutHandler(logout);

    await expect(store.refreshAccessToken()).resolves.toBe('new-access');
    await store.logout();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('falls back to clearing tokens when no logout handler is registered', async () => {
    const store = await loadModule();
    store.setAccessToken('access-token');
    store.setRefreshToken('refresh-token');
    store.registerLogoutHandler(null);

    await store.logout();

    expect(store.getAccessToken()).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
  });
});
