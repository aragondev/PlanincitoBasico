import { defineConfig } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "list" : "line",
  use: {
    baseURL: `http://127.0.0.1:${PORT}/PlanincitoBasico/`,
    trace: "retain-on-failure",
  },
  // Backend y frontend reales: es el punto de estas pruebas.
  webServer: [
    {
      command: "npm start --workspace server",
      port: 3000,
      reuseExistingServer: !process.env["CI"],
      env: { ROOM_ACCESS_SECRET: "", CLIENT_ORIGIN: "*" },
    },
    {
      // `--host 127.0.0.1`: por defecto vite preview no escucha en esa
      // interfaz y Playwright no lograba conectar.
      command: `npm run preview --workspace client -- --port ${PORT} --strictPort --host 127.0.0.1`,
      port: PORT,
      reuseExistingServer: !process.env["CI"],
    },
  ],
});
