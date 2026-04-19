import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

function createStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

Object.defineProperty(globalThis, 'localStorage', {
  value: createStorage(),
  configurable: true,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: createStorage(),
  configurable: true,
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
