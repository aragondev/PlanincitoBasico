import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type PublicRoomState,
  type RoomError,
  type SessionCredentials,
} from "@planincito/shared";
import { createApp, type App } from "../src/app.js";
import { config as baseConfig, type Config } from "../src/config.js";

const SECRET = "frase-de-equipo";

let app: App | null = null;
let url = "";
const clients: Socket[] = [];

async function startServer(overrides: Partial<Config>): Promise<void> {
  app = createApp({ ...baseConfig, clientOrigin: "*", ...overrides } as Config);
  await new Promise<void>((resolve) => app!.httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = app!.httpServer.address() as AddressInfo;
  url = `http://127.0.0.1:${port}`;
}

function connect(): Socket {
  const socket = createClient(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  clients.push(socket);
  return socket;
}

/** Resuelve con el código de error o con "created" si la sala se creó. */
function tryCreate(socket: Socket, secret?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Tiempo agotado")), 5000);
    socket.once(SERVER_EVENTS.ROOM_CREATED, () => {
      clearTimeout(timer);
      resolve("created");
    });
    socket.once(SERVER_EVENTS.ROOM_ERROR, (error: RoomError) => {
      clearTimeout(timer);
      resolve(error.code);
    });
    socket.emit(CLIENT_EVENTS.ROOM_CREATE, { alias: "Ana", secret });
  });
}

afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect();
  if (app) await app.shutdown("test");
  app = null;
});

describe("frase de acceso al crear una sala", () => {
  it("sin frase configurada cualquiera puede crear", async () => {
    await startServer({ roomAccessSecret: "" });
    expect(await tryCreate(connect())).toBe("created");
  });

  it("acepta la frase correcta", async () => {
    await startServer({ roomAccessSecret: SECRET });
    expect(await tryCreate(connect(), SECRET)).toBe("created");
  });

  it("rechaza crear sin frase o con una incorrecta", async () => {
    await startServer({ roomAccessSecret: SECRET });
    expect(await tryCreate(connect())).toBe("UNAUTHORIZED");
    expect(await tryCreate(connect(), "otra-cosa")).toBe("UNAUTHORIZED");
    expect(app!.store.size).toBe(0);
  });

  it("distingue mayúsculas y minúsculas", async () => {
    await startServer({ roomAccessSecret: "DISMAC" });
    expect(await tryCreate(connect(), "dismac")).toBe("UNAUTHORIZED");
    expect(await tryCreate(connect(), "DISMAC")).toBe("created");
  });

  it("bloquea tras demasiados intentos fallidos", async () => {
    await startServer({
      roomAccessSecret: SECRET,
      accessMaxAttempts: 3,
      accessAttemptWindowMs: 60_000,
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(await tryCreate(connect(), "mal")).toBe("UNAUTHORIZED");
    }
    expect(await tryCreate(connect(), "mal")).toBe("TOO_MANY_ATTEMPTS");
    // El bloqueo no debe dejar fuera a quien sí sabe la frase.
    expect(await tryCreate(connect(), SECRET)).toBe("created");
  });
});

describe("entrar a una sala no exige frase", () => {
  it("un invitado entra con sólo el código, sin conocer la frase", async () => {
    await startServer({ roomAccessSecret: SECRET });

    // El anfitrión sí necesita la frase para crear.
    const host = connect();
    const created = new Promise<SessionCredentials>((resolve) =>
      host.once(
        SERVER_EVENTS.ROOM_CREATED,
        (p: { credentials: SessionCredentials }) => resolve(p.credentials),
      ),
    );
    host.emit(CLIENT_EVENTS.ROOM_CREATE, { alias: "Ana", secret: SECRET });
    const credentials = await created;

    // El invitado no envía frase alguna.
    const guest = connect();
    const entered = new Promise<PublicRoomState>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no entró")), 5000);
      guest.once(SERVER_EVENTS.ROOM_STATE, (p: { state: PublicRoomState }) => {
        clearTimeout(timer);
        resolve(p.state);
      });
      guest.once(SERVER_EVENTS.ROOM_ERROR, (e: RoomError) => {
        clearTimeout(timer);
        reject(new Error(e.code));
      });
    });
    guest.emit(CLIENT_EVENTS.ROOM_JOIN, {
      code: credentials.roomCode,
      alias: "Bea",
    });

    const state = await entered;
    expect(state.participants).toHaveLength(2);
  });

  it("un código inexistente sigue fallando por sala, no por frase", async () => {
    await startServer({ roomAccessSecret: SECRET });
    const socket = connect();
    const error = new Promise<RoomError>((resolve) =>
      socket.once(SERVER_EVENTS.ROOM_ERROR, resolve),
    );
    socket.emit(CLIENT_EVENTS.ROOM_JOIN, { code: "ABCDEF", alias: "Bea" });
    expect((await error).code).toBe("ROOM_NOT_FOUND");
  });
});
