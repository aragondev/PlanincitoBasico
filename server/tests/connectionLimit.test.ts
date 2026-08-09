import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";
import { createApp, type App } from "../src/app.js";
import { config as baseConfig, type Config } from "../src/config.js";

let app: App | null = null;
let url = "";
const clients: Socket[] = [];

async function startServer(overrides: Partial<Config>): Promise<void> {
  app = createApp({ ...baseConfig, clientOrigin: "*", ...overrides } as Config);
  await new Promise<void>((resolve) => app!.httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = app!.httpServer.address() as AddressInfo;
  url = `http://127.0.0.1:${port}`;
}

/** Abre un socket y resuelve con "connected" o con el motivo del rechazo. */
function open(): Promise<{ socket: Socket; outcome: string }> {
  return new Promise((resolve, reject) => {
    const socket = createClient(url, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    clients.push(socket);
    const timer = setTimeout(() => reject(new Error("Tiempo agotado")), 4000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve({ socket, outcome: "connected" });
    });
    socket.once("connect_error", (error: Error) => {
      clearTimeout(timer);
      resolve({ socket, outcome: error.message });
    });
  });
}

afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect();
  if (app) await app.shutdown("test");
  app = null;
});

describe("límite de conexiones por IP", () => {
  it("acepta hasta el tope y rechaza el siguiente socket", async () => {
    await startServer({ maxConnectionsPerIp: 3 });

    for (let index = 0; index < 3; index += 1) {
      expect((await open()).outcome).toBe("connected");
    }
    expect((await open()).outcome).toBe("TOO_MANY_CONNECTIONS");
  });

  it("libera el hueco cuando alguien se desconecta", async () => {
    await startServer({ maxConnectionsPerIp: 2 });

    const primero = await open();
    await open();
    expect((await open()).outcome).toBe("TOO_MANY_CONNECTIONS");

    primero.socket.disconnect();
    // El servidor procesa la baja de forma asíncrona.
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect((await open()).outcome).toBe("connected");
  });

  it("con el tope en cero no hay restricción", async () => {
    await startServer({ maxConnectionsPerIp: 0 });
    for (let index = 0; index < 5; index += 1) {
      expect((await open()).outcome).toBe("connected");
    }
  });

  it("una sala llena cabe de sobra bajo el tope por defecto", async () => {
    // 12 personas desde la misma oficina no deben chocar con el límite.
    await startServer({ maxConnectionsPerIp: baseConfig.maxConnectionsPerIp });
    for (let index = 0; index < 12; index += 1) {
      expect((await open()).outcome).toBe("connected");
    }
  });
});
