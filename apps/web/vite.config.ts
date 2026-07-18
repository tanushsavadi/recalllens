import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The web app talks to the local public-data-api over HTTP/JSON; it does not
// run the Midnight WASM stack in the browser (see docs/DECISIONS.md D8), so no
// special WASM/top-level-await bundler config is required here.
export default defineConfig({
  plugins: [react()],
  // react-globe.gl pulls its own React through esm interop; dedupe so there is
  // a single React instance (otherwise "Invalid hook call").
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react-globe.gl", "react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
