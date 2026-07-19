import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `base` debe coincidir con el nombre del repositorio en GitHub Pages (§17).
const base = process.env.VITE_BASE_PATH ?? "/PlanincitoBasico/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@planincito/shared": fileURLToPath(
        new URL("../shared/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
