import { createApp } from "./app.js";
import { config } from "./config.js";

const { httpServer, shutdown } = createApp(config);

httpServer.listen(config.port, "0.0.0.0", () => {
  console.info(`[server] escuchando en 0.0.0.0:${config.port}`);
  console.info(
    `[server] origen permitido: ${
      config.clientOrigin === "*" ? "*" : config.clientOrigin.join(", ")
    }`,
  );
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    void shutdown(signal).then(() => process.exit(0));
  });
}
