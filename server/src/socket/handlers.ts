import type { Server, Socket } from "socket.io";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SessionCredentials,
} from "@planincito/shared";
import type { Config } from "../config.js";
import { RoomOperationError } from "../rooms/errors.js";
import type { Participant, Room, RoomStore } from "../rooms/roomStore.js";
import {
  ValidationError,
  assertPayloadSize,
  parseAlias,
  parseCardValue,
  parseId,
  parseRole,
  parseRoomCode,
  parseTopic,
} from "../validation/input.js";
import type { AccessGate } from "./accessGate.js";
import { RateLimiter } from "./rateLimiter.js";

/** Sólo identificadores en el socket; nunca objetos de sala (§3.6). */
export type SocketData = {
  roomCode?: string;
  participantId?: string;
};

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export function registerSocketHandlers(
  io: AppServer,
  store: RoomStore,
  config: Config,
  accessGate: AccessGate,
): void {
  const limiter = new RateLimiter(
    config.rateLimitWindowMs,
    config.rateLimitMaxEvents,
  );

  const broadcastState = (room: Room): void => {
    io.to(room.code).emit(SERVER_EVENTS.ROOM_STATE, {
      state: store.buildPublicState(room),
    });
  };

  store.on("participant-removed", ({ room, participantId }) => {
    const state = store.buildPublicState(room);
    io.to(room.code).emit(SERVER_EVENTS.PARTICIPANT_LEFT, { participantId, state });
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.participantId === participantId) {
        socket.emit(SERVER_EVENTS.ROOM_CLOSED, {
          reason: "Ya no formas parte de esta sala.",
        });
        socket.leave(room.code);
        socket.data = {};
      }
    }
  });

  store.on("facilitator-changed", ({ room, facilitatorId }) => {
    io.to(room.code).emit(SERVER_EVENTS.FACILITATOR_CHANGED, {
      facilitatorId,
      state: store.buildPublicState(room),
    });
  });

  store.on("room-closed", ({ code, reason }) => {
    io.to(code).emit(SERVER_EVENTS.ROOM_CLOSED, { reason });
    io.socketsLeave(code);
  });

  const credentialsFor = (room: Room, participant: Participant): SessionCredentials => ({
    roomCode: room.code,
    participantId: participant.id,
    reconnectionToken: participant.token,
  });

  const enterRoom = (
    socket: AppSocket,
    room: Room,
    participant: Participant,
    event: typeof SERVER_EVENTS.ROOM_CREATED | typeof SERVER_EVENTS.ROOM_STATE,
  ): void => {
    socket.data.roomCode = room.code;
    socket.data.participantId = participant.id;
    void socket.join(room.code);

    const state = store.buildPublicState(room);
    socket.emit(event, { credentials: credentialsFor(room, participant), state });
    socket.to(room.code).emit(SERVER_EVENTS.PARTICIPANT_JOINED, {
      participant:
        state.participants.find((p) => p.participantId === participant.id) ??
        {
          participantId: participant.id,
          alias: participant.alias,
          role: participant.role,
          connected: true,
          hasVoted: false,
        },
      state,
    });
  };

  /** Envuelve cada handler con límite de frecuencia, tamaño y errores. */
  const guard =
    <P extends unknown[]>(socket: AppSocket, handler: (...args: P) => void) =>
    (...args: P): void => {
      try {
        if (!limiter.allow(socket.id)) {
          socket.emit(SERVER_EVENTS.ROOM_ERROR, {
            code: "RATE_LIMITED",
            message: "Demasiadas acciones seguidas. Espera un momento.",
          });
          return;
        }
        assertPayloadSize(args[0], config.maxEventPayloadBytes);
        handler(...args);
      } catch (error) {
        if (error instanceof ValidationError || error instanceof RoomOperationError) {
          socket.emit(SERVER_EVENTS.ROOM_ERROR, {
            code: error.code,
            message: error.message,
          });
          return;
        }
        console.error("[socket] error inesperado", error);
        socket.emit(SERVER_EVENTS.ROOM_ERROR, {
          code: "INVALID_PAYLOAD",
          message: "No fue posible completar la acción.",
        });
      }
    };

  /** Contexto del participante actual, validado contra el estado del servidor. */
  const context = (socket: AppSocket): { code: string; participantId: string } => {
    const { roomCode, participantId } = socket.data;
    if (!roomCode || !participantId) {
      throw new RoomOperationError("NOT_IN_ROOM", "No estás en ninguna sala.");
    }
    return { code: roomCode, participantId };
  };

  io.on("connection", (socket: AppSocket) => {
    socket.on(
      CLIENT_EVENTS.ROOM_CREATE,
      guard(socket, (payload) => {
        accessGate.assertCanCreate(socket, payload?.secret);
        const alias = parseAlias(payload?.alias);
        const { room, participant } = store.createRoom(alias);
        enterRoom(socket, room, participant, SERVER_EVENTS.ROOM_CREATED);
      }),
    );

    socket.on(
      CLIENT_EVENTS.ROOM_JOIN,
      guard(socket, (payload) => {
        const code = parseRoomCode(payload?.code);
        const alias = parseAlias(payload?.alias);
        const { room, participant } = store.joinRoom(
          code,
          alias,
          payload?.asSpectator === true,
        );
        enterRoom(socket, room, participant, SERVER_EVENTS.ROOM_STATE);
      }),
    );

    socket.on(
      CLIENT_EVENTS.ROOM_RECONNECT,
      guard(socket, (payload) => {
        const code = parseRoomCode(payload?.roomCode);
        const participantId = parseId(payload?.participantId);
        const token = parseId(payload?.reconnectionToken);
        const { room, participant } = store.reconnect(code, participantId, token);
        enterRoom(socket, room, participant, SERVER_EVENTS.ROOM_STATE);
      }),
    );

    socket.on(
      CLIENT_EVENTS.ROOM_LEAVE,
      guard(socket, () => {
        const { code, participantId } = context(socket);
        socket.data = {};
        void socket.leave(code);
        store.leaveRoom(code, participantId);
      }),
    );

    socket.on(
      CLIENT_EVENTS.TOPIC_UPDATE,
      guard(socket, (payload) => {
        const { code, participantId } = context(socket);
        broadcastState(store.setTopic(code, participantId, parseTopic(payload?.topic)));
      }),
    );

    socket.on(
      CLIENT_EVENTS.VOTE_SUBMIT,
      guard(socket, (payload) => {
        const { code, participantId } = context(socket);
        const value = parseCardValue(payload?.value);
        const room = store.submitVote(code, participantId, value);
        const state = store.buildPublicState(room);
        const participant = state.participants.find(
          (p) => p.participantId === participantId,
        );
        if (participant) {
          io.to(room.code).emit(SERVER_EVENTS.PARTICIPANT_UPDATED, {
            participant,
            state,
          });
        }
      }),
    );

    socket.on(
      CLIENT_EVENTS.VOTES_REVEAL,
      guard(socket, () => {
        const { code, participantId } = context(socket);
        const room = store.reveal(code, participantId);
        io.to(room.code).emit(SERVER_EVENTS.VOTES_REVEALED, {
          state: store.buildPublicState(room),
        });
      }),
    );

    socket.on(
      CLIENT_EVENTS.ROUND_RESTART,
      guard(socket, (payload) => {
        const { code, participantId } = context(socket);
        const topic =
          payload?.topic === undefined ? undefined : parseTopic(payload.topic);
        const room = store.restartRound(code, participantId, topic);
        io.to(room.code).emit(SERVER_EVENTS.ROUND_RESTARTED, {
          state: store.buildPublicState(room),
        });
      }),
    );

    socket.on(
      CLIENT_EVENTS.PARTICIPANT_KICK,
      guard(socket, (payload) => {
        const { code, participantId } = context(socket);
        store.kick(code, participantId, parseId(payload?.participantId));
      }),
    );

    socket.on(
      CLIENT_EVENTS.PARTICIPANT_CHANGE_ROLE,
      guard(socket, (payload) => {
        const { code, participantId } = context(socket);
        broadcastState(
          store.changeRole(
            code,
            participantId,
            parseId(payload?.participantId),
            parseRole(payload?.role),
          ),
        );
      }),
    );

    socket.on(
      CLIENT_EVENTS.FACILITATOR_TRANSFER,
      guard(socket, (payload) => {
        const { code, participantId } = context(socket);
        store.transferFacilitator(code, participantId, parseId(payload?.participantId));
      }),
    );

    socket.on("disconnect", () => {
      limiter.forget(socket.id);
      const { roomCode, participantId } = socket.data;
      if (!roomCode || !participantId) return;
      const room = store.markDisconnected(roomCode, participantId);
      if (room) broadcastState(room);
    });
  });
}
