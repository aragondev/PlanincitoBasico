import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

const testConfig: Config = {
  ...baseConfig,
  clientOrigin: "*",
  maxParticipantsPerRoom: 8,
  maxActiveRooms: 25,
  emptyRoomGraceMs: 200,
  disconnectedParticipantGraceMs: 200,
  cleanupIntervalMs: 50,
  shutdownGraceMs: 200,
};

let app: App;
let url: string;
const clients: Socket[] = [];

function connect(): Socket {
  const socket = createClient(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  clients.push(socket);
  return socket;
}

/** Espera un evento concreto y falla si llega `room:error` antes. */
function waitFor<T>(socket: Socket, event: string, timeoutMs = 4000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Tiempo agotado esperando "${event}"`));
    }, timeoutMs);

    const onEvent = (payload: T) => {
      cleanup();
      resolve(payload);
    };
    const onError = (error: RoomError) => {
      if (event === SERVER_EVENTS.ROOM_ERROR) return;
      cleanup();
      reject(new Error(`room:error ${error.code}: ${error.message}`));
    };
    function cleanup() {
      clearTimeout(timer);
      socket.off(event, onEvent as never);
      socket.off(SERVER_EVENTS.ROOM_ERROR, onError as never);
    }

    socket.on(event, onEvent as never);
    socket.on(SERVER_EVENTS.ROOM_ERROR, onError as never);
  });
}

type Entered = { credentials?: SessionCredentials; state: PublicRoomState };

async function createRoom(alias = "Ana") {
  const socket = connect();
  const entered = waitFor<Entered>(socket, SERVER_EVENTS.ROOM_CREATED);
  socket.emit(CLIENT_EVENTS.ROOM_CREATE, { alias });
  const payload = await entered;
  return { socket, credentials: payload.credentials!, state: payload.state };
}

async function joinRoom(code: string, alias: string, asSpectator = false) {
  const socket = connect();
  const entered = waitFor<Entered>(socket, SERVER_EVENTS.ROOM_STATE);
  socket.emit(CLIENT_EVENTS.ROOM_JOIN, { code, alias, asSpectator });
  const payload = await entered;
  return { socket, credentials: payload.credentials!, state: payload.state };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(async () => {
  app = createApp(testConfig);
  await new Promise<void>((resolve) => app.httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = app.httpServer.address() as AddressInfo;
  url = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect();
  await app.shutdown("test");
});

describe("ciclo de vida de la sala", () => {
  it("crea la sala y entrega credenciales al facilitador", async () => {
    const { credentials, state } = await createRoom("Ana");
    expect(credentials.roomCode).toHaveLength(6);
    expect(credentials.reconnectionToken).toBeTruthy();
    expect(state.facilitatorId).toBe(credentials.participantId);
    expect(state.participants).toHaveLength(1);
  });

  it("acepta 8 conexiones y rechaza claramente la novena", async () => {
    const { credentials } = await createRoom("Ana");
    for (let index = 1; index < 8; index += 1) {
      await joinRoom(credentials.roomCode, `Jugador ${index}`);
    }

    const ninth = connect();
    const error = waitFor<RoomError>(ninth, SERVER_EVENTS.ROOM_ERROR);
    ninth.emit(CLIENT_EVENTS.ROOM_JOIN, {
      code: credentials.roomCode,
      alias: "Noveno",
    });
    expect((await error).code).toBe("ROOM_FULL");
  });

  it("informa a los demás cuando alguien entra", async () => {
    const host = await createRoom("Ana");
    const joined = waitFor<{ state: PublicRoomState }>(
      host.socket,
      SERVER_EVENTS.PARTICIPANT_JOINED,
    );
    await joinRoom(host.credentials.roomCode, "Bea");
    expect((await joined).state.participants).toHaveLength(2);
  });

  it("rechaza un código inexistente", async () => {
    const socket = connect();
    const error = waitFor<RoomError>(socket, SERVER_EVENTS.ROOM_ERROR);
    socket.emit(CLIENT_EVENTS.ROOM_JOIN, { code: "ABCDEF", alias: "Ana" });
    expect((await error).code).toBe("ROOM_NOT_FOUND");
  });

  it("rechaza alias vacío", async () => {
    const socket = connect();
    const error = waitFor<RoomError>(socket, SERVER_EVENTS.ROOM_ERROR);
    socket.emit(CLIENT_EVENTS.ROOM_CREATE, { alias: "   " });
    expect((await error).code).toBe("INVALID_ALIAS");
  });
});

describe("votación en tiempo real", () => {
  it("oculta los valores hasta revelar y luego los muestra a todos", async () => {
    const host = await createRoom("Ana");
    const guest = await joinRoom(host.credentials.roomCode, "Bea");

    const hostSees = waitFor<{ state: PublicRoomState }>(
      host.socket,
      SERVER_EVENTS.PARTICIPANT_UPDATED,
    );
    guest.socket.emit(CLIENT_EVENTS.VOTE_SUBMIT, { value: "8" });
    const hidden = (await hostSees).state.participants.find(
      (p) => p.participantId === guest.credentials.participantId,
    )!;
    expect(hidden.hasVoted).toBe(true);
    expect(hidden.vote).toBeUndefined();

    const guestRevealed = waitFor<{ state: PublicRoomState }>(
      guest.socket,
      SERVER_EVENTS.VOTES_REVEALED,
    );
    host.socket.emit(CLIENT_EVENTS.VOTES_REVEAL);
    const revealed = await guestRevealed;
    expect(
      revealed.state.participants.find(
        (p) => p.participantId === guest.credentials.participantId,
      )?.vote,
    ).toBe("8");
    expect(revealed.state.results?.average).toBe(8);
  });

  it("solo el facilitador puede revelar", async () => {
    const host = await createRoom("Ana");
    const guest = await joinRoom(host.credentials.roomCode, "Bea");

    const error = waitFor<RoomError>(guest.socket, SERVER_EVENTS.ROOM_ERROR);
    guest.socket.emit(CLIENT_EVENTS.VOTES_REVEAL);
    expect((await error).code).toBe("NOT_FACILITATOR");
  });

  it("reinicia la ronda para todos", async () => {
    const host = await createRoom("Ana");
    const guest = await joinRoom(host.credentials.roomCode, "Bea");
    guest.socket.emit(CLIENT_EVENTS.VOTE_SUBMIT, { value: "5" });
    host.socket.emit(CLIENT_EVENTS.VOTES_REVEAL);
    await waitFor(guest.socket, SERVER_EVENTS.VOTES_REVEALED);

    const restarted = waitFor<{ state: PublicRoomState }>(
      guest.socket,
      SERVER_EVENTS.ROUND_RESTARTED,
    );
    host.socket.emit(CLIENT_EVENTS.ROUND_RESTART, { topic: "Historia 2" });
    const state = (await restarted).state;
    expect(state.status).toBe("voting");
    expect(state.round).toBe(2);
    expect(state.topic).toBe("Historia 2");
    expect(state.participants.every((p) => !p.hasVoted)).toBe(true);
  });

  it("propaga el cambio de tema", async () => {
    const host = await createRoom("Ana");
    const guest = await joinRoom(host.credentials.roomCode, "Bea");

    const updated = waitFor<{ state: PublicRoomState }>(
      guest.socket,
      SERVER_EVENTS.ROOM_STATE,
    );
    host.socket.emit(CLIENT_EVENTS.TOPIC_UPDATE, { topic: "Historia 7" });
    expect((await updated).state.topic).toBe("Historia 7");
  });

  it("rechaza cartas fuera del mazo", async () => {
    const host = await createRoom("Ana");
    const error = waitFor<RoomError>(host.socket, SERVER_EVENTS.ROOM_ERROR);
    host.socket.emit(CLIENT_EVENTS.VOTE_SUBMIT, { value: "99" as never });
    expect((await error).code).toBe("INVALID_CARD");
  });

  it("rechaza payloads desproporcionados", async () => {
    const host = await createRoom("Ana");
    const error = waitFor<RoomError>(host.socket, SERVER_EVENTS.ROOM_ERROR);
    host.socket.emit(CLIENT_EVENTS.TOPIC_UPDATE, { topic: "x".repeat(8_000) });
    expect((await error).code).toBe("INVALID_PAYLOAD");
  });

  it("corta la conexión ante un payload muy por encima del límite", async () => {
    const host = await createRoom("Ana");
    const closed = new Promise<void>((resolve) =>
      host.socket.once("disconnect", () => resolve()),
    );
    // Backstop de transporte: Socket.IO cierra antes de que el handler corra.
    host.socket.emit(CLIENT_EVENTS.TOPIC_UPDATE, { topic: "x".repeat(200_000) });
    await closed;
    expect(host.socket.connected).toBe(false);
  });
});

describe("reconexión y facilitador", () => {
  it("recupera participante, rol y voto tras recargar", async () => {
    const host = await createRoom("Ana");
    await joinRoom(host.credentials.roomCode, "Bea");
    host.socket.emit(CLIENT_EVENTS.VOTE_SUBMIT, { value: "13" });
    await delay(50);

    host.socket.disconnect();
    await delay(50);

    const revived = connect();
    const restored = waitFor<Entered>(revived, SERVER_EVENTS.ROOM_STATE);
    revived.emit(CLIENT_EVENTS.ROOM_RECONNECT, host.credentials);
    const state = (await restored).state;

    const me = state.participants.find(
      (p) => p.participantId === host.credentials.participantId,
    )!;
    expect(me.connected).toBe(true);
    expect(me.role).toBe("facilitator");
    expect(me.hasVoted).toBe(true);
    expect(state.facilitatorId).toBe(host.credentials.participantId);
  });

  it("transfiere el facilitador cuando no regresa y avisa a los demás", async () => {
    const host = await createRoom("Ana");
    const guest = await joinRoom(host.credentials.roomCode, "Bea");

    const changed = waitFor<{ facilitatorId: string }>(
      guest.socket,
      SERVER_EVENTS.FACILITATOR_CHANGED,
    );
    host.socket.disconnect();
    expect((await changed).facilitatorId).toBe(guest.credentials.participantId);
  });

  it("la transferencia manual funciona de inmediato", async () => {
    const host = await createRoom("Ana");
    const guest = await joinRoom(host.credentials.roomCode, "Bea");

    const changed = waitFor<{ facilitatorId: string }>(
      guest.socket,
      SERVER_EVENTS.FACILITATOR_CHANGED,
    );
    host.socket.emit(CLIENT_EVENTS.FACILITATOR_TRANSFER, {
      participantId: guest.credentials.participantId,
    });
    expect((await changed).facilitatorId).toBe(guest.credentials.participantId);
  });

  it("expulsar saca al participante de la sala", async () => {
    const host = await createRoom("Ana");
    const guest = await joinRoom(host.credentials.roomCode, "Bea");

    const closed = waitFor<{ reason: string }>(
      guest.socket,
      SERVER_EVENTS.ROOM_CLOSED,
    );
    host.socket.emit(CLIENT_EVENTS.PARTICIPANT_KICK, {
      participantId: guest.credentials.participantId,
    });
    await closed;

    const error = waitFor<RoomError>(guest.socket, SERVER_EVENTS.ROOM_ERROR);
    guest.socket.emit(CLIENT_EVENTS.VOTE_SUBMIT, { value: "1" });
    expect((await error).code).toBe("NOT_IN_ROOM");
  });

  it("elimina la sala cuando nadie vuelve dentro del margen", async () => {
    const host = await createRoom("Ana");
    host.socket.disconnect();
    await delay(testConfig.emptyRoomGraceMs + testConfig.cleanupIntervalMs * 3);

    const socket = connect();
    const error = waitFor<RoomError>(socket, SERVER_EVENTS.ROOM_ERROR);
    socket.emit(CLIENT_EVENTS.ROOM_JOIN, {
      code: host.credentials.roomCode,
      alias: "Tarde",
    });
    expect((await error).code).toBe("ROOM_NOT_FOUND");
  });

  it("avisa a los clientes antes de reiniciar y luego cierra", async () => {
    const host = await createRoom("Ana");
    const restarting = waitFor<{ message: string }>(
      host.socket,
      SERVER_EVENTS.SERVER_RESTARTING,
    );
    void app.shutdown("SIGTERM");
    expect((await restarting).message).toMatch(/reiniciando/i);
  });
});

describe("salud del proceso", () => {
  it("responde /health y /ready", async () => {
    expect((await fetch(`${url}/health`)).status).toBe(200);
    const ready = await fetch(`${url}/ready`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({ ready: true });
  });

  it("no acumula salas tras crear y cerrar muchas rondas", async () => {
    for (let cycle = 0; cycle < 10; cycle += 1) {
      const host = await createRoom(`Ana ${cycle}`);
      for (let round = 0; round < 5; round += 1) {
        host.socket.emit(CLIENT_EVENTS.VOTE_SUBMIT, { value: "3" });
        host.socket.emit(CLIENT_EVENTS.VOTES_REVEAL);
        host.socket.emit(CLIENT_EVENTS.ROUND_RESTART, {});
      }
      await delay(20);
      host.socket.disconnect();
    }
    await delay(testConfig.emptyRoomGraceMs + testConfig.cleanupIntervalMs * 4);
    expect(app.store.size).toBe(0);
  });
});
