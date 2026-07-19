import { defineConfig } from "tsup";

// Empaquetamos en un único archivo para que `shared/` quede incluido
// sin depender de node_modules del workspace en producción.
export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  noExternal: ["@planincito/shared"],
});
