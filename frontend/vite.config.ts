import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Backend mounts routes under /api (see backend/src/app.ts)
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
