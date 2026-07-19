import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";
import { CLIENT_EVENTS, SERVER_EVENTS } from "@planincito/shared";
import { createApp, type App } from "../src/app.js";
import { config as baseConfig, type Config } from "../src/config.js";

const SECRET = "equipo-planincito-2026";

let app: App | null = null;
const clients: Socket[] = [];

async function startServer(overrides: Partial<Config>): Promise<string> {
  app = createApp({ ...baseConfig, clientOrigin: "*", ...overrides } as Config);
  await new Promise<void>((resolve) => app!.httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = app!.httpServer.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

function connect(url: string, secret?: string): Socket {
  const socket = createClient(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    auth: secret === undefined ? {} : { secret },
  });
  clients.push(socket);
  return socket;
}

/** Resuelve con "connected" o con el motivo del rechazo. */
function outcome(socket: Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Tiempo agotado")), 4000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve("connected");
    });
    socket.once("connect_error", (error: Error) => {
      clearTimeout(timer);
      resolve(error.message);
    });
  });
}

afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect();
  if (app) await app.shutdown("test");
  app = null;
});

describe("puerta de acceso", () => {
  it("sin frase configurada deja pasar a cualquiera", async () => {
    const url = await startServer({ roomAccessSecret: "" });
    expect(await outcome(connect(url))).toBe("connected");
  });

  it("acepta la frase correcta", async () => {
    const url = await startServer({ roomAccessSecret: SECRET });
    expect(await outcome(connect(url, SECRET))).toBe("connected");
  });

  it("rechaza una frase incorrecta o ausente", async () => {
    const url = await startServer({ roomAccessSecret: SECRET });
    expect(await outcome(connect(url, "otra-cosa"))).toBe("UNAUTHORIZED");
    expect(await outcome(connect(url))).toBe("UNAUTHORIZED");
  });

  it("un socket rechazado no puede crear salas", async () => {
    const url = await startServer({ roomAccessSecret: SECRET });
    const socket = connect(url, "otra-cosa");
    await outcome(socket);

    socket.emit(CLIENT_EVENTS.ROOM_CREATE, { alias: "Intruso" });
    const created = await Promise.race([
      new Promise((resolve) => socket.once(SERVER_EVENTS.ROOM_CREATED, resolve)),
      new Promise((resolve) => setTimeout(() => resolve(null), 400)),
    ]);

    expect(created).toBeNull();
    expect(app!.store.size).toBe(0);
  });

  it("bloquea la IP tras demasiados intentos fallidos", async () => {
    const url = await startServer({
      roomAccessSecret: SECRET,
      accessMaxAttempts: 3,
      accessAttemptWindowMs: 60_000,
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(await outcome(connect(url, "mal"))).toBe("UNAUTHORIZED");
    }
    expect(await outcome(connect(url, "mal"))).toBe("TOO_MANY_ATTEMPTS");

    // El bloqueo por fuerza bruta no debe dejar fuera a quien sí sabe la frase.
    expect(await outcome(connect(url, SECRET))).toBe("connected");
  });

  it("una entrada correcta reinicia el contador de intentos", async () => {
    const url = await startServer({
      roomAccessSecret: SECRET,
      accessMaxAttempts: 2,
      accessAttemptWindowMs: 60_000,
    });

    expect(await outcome(connect(url, "mal"))).toBe("UNAUTHORIZED");
    expect(await outcome(connect(url, SECRET))).toBe("connected");
    expect(await outcome(connect(url, "mal"))).toBe("UNAUTHORIZED");
    expect(await outcome(connect(url, "mal"))).toBe("UNAUTHORIZED");
  });
});
