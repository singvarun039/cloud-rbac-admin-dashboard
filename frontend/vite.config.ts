import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function isPollingEnabled() {
  // Vite uses chokidar internally; enabling polling is often required for
  // Windows bind mounts. We only enable polling when explicitly requested.
  return process.env.CHOKIDAR_USEPOLLING === 'true' || process.env.WATCHPACK_POLLING === 'true';
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './test/setup.ts',
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
  server: {
    host: true,
    watch: isPollingEnabled()
      ? {
          usePolling: true,
          interval: 1000,
        }
      : undefined,
    proxy: {
      // Backend mounts routes under /api (see backend/src/app.ts)
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
