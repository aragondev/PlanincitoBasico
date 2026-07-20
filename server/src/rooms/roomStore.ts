import { EventEmitter } from "node:events";
import type {
  CardValue,
  ParticipantRole,
  PublicParticipant,
  PublicRoomState,
  RoundHistoryEntry,
} from "@planincito/shared";
import { generateId, generateReconnectionToken, generateRoomCode } from "./codes.js";
import { RoomOperationError } from "./errors.js";
import { computeResults } from "./results.js";

export type Participant = {
  id: string;
  alias: string;
  role: ParticipantRole;
  connected: boolean;
  joinedAt: number;
  disconnectedAt?: number;
  /** Token de reconexión; nunca se envía a terceros. */
  token: string;
};

export type Room = {
  id: string;
  code: string;
  facilitatorId: string;
  topic: string;
  status: "voting" | "revealed";
  round: number;
  participants: Map<string, Participant>;
  votes: Map<string, CardValue>;
  createdAt: number;
  lastActivityAt: number;
  emptySince?: number;
  /** Rondas reveladas de esta sesión, de la más reciente a la más antigua. */
  history: RoundHistoryEntry[];
};

export type RoomStoreOptions = {
  maxActiveRooms: number;
  maxParticipantsPerRoom: number;
  emptyRoomGraceMs: number;
  disconnectedParticipantGraceMs: number;
  /** Tope de rondas guardadas: el historial no debe crecer sin límite (§3.6). */
  maxRoundHistory?: number;
  now?: () => number;
};

export type StoreEvents = {
  "participant-removed": { room: Room; participantId: string };
  "facilitator-changed": { room: Room; facilitatorId: string };
  "room-closed": { code: string; reason: string };
};

export class RoomStore extends EventEmitter {
  private readonly rooms = new Map<string, Room>();
  private readonly roomIdByCode = new Map<string, string>();
  private acceptingNewRooms = true;
  private readonly now: () => number;

  constructor(private readonly options: RoomStoreOptions) {
    super();
    this.now = options.now ?? Date.now;
  }

  private emitStore<K extends keyof StoreEvents>(
    event: K,
    payload: StoreEvents[K],
  ): void {
    this.emit(event, payload);
  }

  get size(): number {
    return this.rooms.size;
  }

  /** Deja de aceptar salas nuevas antes de cerrar por `SIGTERM` (§3.3). */
  stopAcceptingNewRooms(): void {
    this.acceptingNewRooms = false;
  }

  getRoomByCode(code: string): Room | undefined {
    const id = this.roomIdByCode.get(code);
    return id ? this.rooms.get(id) : undefined;
  }

  private requireRoom(code: string): Room {
    const room = this.getRoomByCode(code);
    if (!room) {
      throw new RoomOperationError("ROOM_NOT_FOUND", "La sala ya no existe.");
    }
    return room;
  }

  private requireParticipant(room: Room, participantId: string): Participant {
    const participant = room.participants.get(participantId);
    if (!participant) {
      throw new RoomOperationError(
        "NOT_IN_ROOM",
        "Ya no formas parte de esta sala.",
      );
    }
    return participant;
  }

  private requireFacilitator(room: Room, participantId: string): Participant {
    const participant = this.requireParticipant(room, participantId);
    if (room.facilitatorId !== participant.id) {
      throw new RoomOperationError(
        "NOT_FACILITATOR",
        "Solo el facilitador puede hacer esto.",
      );
    }
    return participant;
  }

  private touch(room: Room): void {
    room.lastActivityAt = this.now();
  }

  /** Alias repetidos se diferencian visualmente: `Ana (2)` (§5.2). */
  private uniqueAlias(room: Room, alias: string): string {
    const taken = new Set(
      [...room.participants.values()].map((participant) => participant.alias),
    );
    if (!taken.has(alias)) return alias;
    for (let suffix = 2; suffix < 100; suffix += 1) {
      const candidate = `${alias} (${suffix})`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${alias} (${room.participants.size + 1})`;
  }

  createRoom(alias: string): { room: Room; participant: Participant } {
    if (!this.acceptingNewRooms) {
      throw new RoomOperationError(
        "SERVER_SHUTTING_DOWN",
        "El servidor se está reiniciando. Intenta de nuevo en unos segundos.",
      );
    }
    if (this.rooms.size >= this.options.maxActiveRooms) {
      throw new RoomOperationError(
        "ROOM_LIMIT_REACHED",
        "No hay salas disponibles en este momento. Intenta más tarde.",
      );
    }

    const timestamp = this.now();
    const code = generateRoomCode((candidate) => this.roomIdByCode.has(candidate));
    const facilitator: Participant = {
      id: generateId(),
      alias,
      role: "facilitator",
      connected: true,
      joinedAt: timestamp,
      token: generateReconnectionToken(),
    };

    const room: Room = {
      id: generateId(),
      code,
      facilitatorId: facilitator.id,
      topic: "",
      status: "voting",
      round: 1,
      participants: new Map([[facilitator.id, facilitator]]),
      votes: new Map(),
      createdAt: timestamp,
      lastActivityAt: timestamp,
      history: [],
    };

    this.rooms.set(room.id, room);
    this.roomIdByCode.set(code, room.id);
    return { room, participant: facilitator };
  }

  joinRoom(
    code: string,
    alias: string,
    asSpectator = false,
  ): { room: Room; participant: Participant } {
    const room = this.requireRoom(code);
    if (room.participants.size >= this.options.maxParticipantsPerRoom) {
      throw new RoomOperationError(
        "ROOM_FULL",
        `La sala está llena (máximo ${this.options.maxParticipantsPerRoom} personas).`,
      );
    }

    const participant: Participant = {
      id: generateId(),
      alias: this.uniqueAlias(room, alias),
      role: asSpectator ? "spectator" : "player",
      connected: true,
      joinedAt: this.now(),
      token: generateReconnectionToken(),
    };

    room.participants.set(participant.id, participant);
    delete room.emptySince;
    this.touch(room);
    return { room, participant };
  }

  /** Recupera lugar, rol y voto tras recargar la pestaña (§5.6). */
  reconnect(
    code: string,
    participantId: string,
    token: string,
  ): { room: Room; participant: Participant } {
    const room = this.getRoomByCode(code);
    if (!room) {
      throw new RoomOperationError("ROOM_NOT_FOUND", "La sala ya no existe.");
    }
    const participant = room.participants.get(participantId);
    if (!participant || participant.token !== token) {
      throw new RoomOperationError(
        "RECONNECTION_FAILED",
        "No fue posible recuperar tu lugar en la sala.",
      );
    }

    participant.connected = true;
    delete participant.disconnectedAt;
    delete room.emptySince;
    this.touch(room);
    return { room, participant };
  }

  /** Marca desconexión; la eliminación real la hace el barrido de limpieza. */
  markDisconnected(code: string, participantId: string): Room | undefined {
    const room = this.getRoomByCode(code);
    const participant = room?.participants.get(participantId);
    if (!room || !participant) return undefined;

    participant.connected = false;
    participant.disconnectedAt = this.now();
    this.touch(room);

    // El rol de facilitador NO se transfiere aquí: §5.6 garantiza que quien
    // se reconecta dentro del margen recupera su lugar, rol y voto. La
    // transferencia ocurre al eliminarlo definitivamente.
    if (this.connectedCount(room) === 0) {
      room.emptySince = this.now();
    }
    return room;
  }

  /** Salida explícita: elimina al participante de inmediato. */
  leaveRoom(code: string, participantId: string): Room | undefined {
    const room = this.getRoomByCode(code);
    if (!room || !room.participants.has(participantId)) return undefined;
    this.removeParticipant(room, participantId);
    return room;
  }

  private connectedCount(room: Room): number {
    let count = 0;
    for (const participant of room.participants.values()) {
      if (participant.connected) count += 1;
    }
    return count;
  }

  private removeParticipant(room: Room, participantId: string): void {
    room.participants.delete(participantId);
    room.votes.delete(participantId);
    this.touch(room);

    if (room.facilitatorId === participantId) {
      this.reassignFacilitator(room);
    }
    if (this.connectedCount(room) === 0) {
      room.emptySince ??= this.now();
    }
    this.emitStore("participant-removed", { room, participantId });
  }

  /**
   * El rol pasa al jugador conectado con mayor antigüedad; si sólo quedan
   * espectadores, al espectador conectado más antiguo (§5.6).
   */
  private reassignFacilitator(room: Room): void {
    const connected = [...room.participants.values()]
      .filter((participant) => participant.connected)
      .sort((a, b) => a.joinedAt - b.joinedAt);

    const next =
      connected.find((participant) => participant.role === "player") ??
      connected.find((participant) => participant.role === "spectator");

    if (!next) return;

    const previous = room.participants.get(room.facilitatorId);
    if (previous && previous.id !== next.id && previous.role === "facilitator") {
      previous.role = "player";
    }
    next.role = "facilitator";
    room.facilitatorId = next.id;
    this.emitStore("facilitator-changed", { room, facilitatorId: next.id });
  }

  setTopic(code: string, participantId: string, topic: string): Room {
    const room = this.requireRoom(code);
    this.requireFacilitator(room, participantId);
    room.topic = topic;
    this.touch(room);
    return room;
  }

  submitVote(code: string, participantId: string, value: CardValue): Room {
    const room = this.requireRoom(code);
    const participant = this.requireParticipant(room, participantId);
    if (participant.role === "spectator") {
      throw new RoomOperationError(
        "SPECTATOR_CANNOT_VOTE",
        "Los espectadores no votan.",
      );
    }
    if (room.status === "revealed") {
      throw new RoomOperationError(
        "ROUND_ALREADY_REVEALED",
        "La ronda ya fue revelada.",
      );
    }
    room.votes.set(participantId, value);
    this.touch(room);
    return room;
  }

  reveal(code: string, participantId: string): Room {
    const room = this.requireRoom(code);
    this.requireFacilitator(room, participantId);
    if (room.status !== "revealed") {
      room.status = "revealed";
      this.recordRound(room);
    }
    this.touch(room);
    return room;
  }

  /**
   * Guarda la ronda recién revelada. Se llama una sola vez por ronda: revelar
   * de nuevo sin reiniciar no duplica la entrada.
   */
  private recordRound(room: Room): void {
    const votes: RoundHistoryEntry["votes"] = [];
    for (const [participantId, vote] of room.votes) {
      const participant = room.participants.get(participantId);
      if (participant) votes.push({ alias: participant.alias, vote });
    }

    room.history.unshift({
      round: room.round,
      topic: room.topic,
      results: computeResults(room.votes.values()),
      votes: votes.sort((a, b) => a.alias.localeCompare(b.alias)),
      revealedAt: this.now(),
    });

    const max = this.options.maxRoundHistory ?? 50;
    if (room.history.length > max) room.history.length = max;
  }

  restartRound(code: string, participantId: string, topic?: string): Room {
    const room = this.requireRoom(code);
    this.requireFacilitator(room, participantId);
    room.votes.clear();
    room.status = "voting";
    room.round += 1;
    if (topic !== undefined) room.topic = topic;
    this.touch(room);
    return room;
  }

  kick(code: string, participantId: string, targetId: string): Room {
    const room = this.requireRoom(code);
    this.requireFacilitator(room, participantId);
    if (targetId === participantId) {
      throw new RoomOperationError(
        "INVALID_PAYLOAD",
        "El facilitador no puede expulsarse a sí mismo.",
      );
    }
    if (!room.participants.has(targetId)) {
      throw new RoomOperationError(
        "PARTICIPANT_NOT_FOUND",
        "Ese participante ya no está en la sala.",
      );
    }
    this.removeParticipant(room, targetId);
    return room;
  }

  changeRole(
    code: string,
    participantId: string,
    targetId: string,
    role: Exclude<ParticipantRole, "facilitator">,
  ): Room {
    const room = this.requireRoom(code);
    this.requireFacilitator(room, participantId);
    const target = room.participants.get(targetId);
    if (!target) {
      throw new RoomOperationError(
        "PARTICIPANT_NOT_FOUND",
        "Ese participante ya no está en la sala.",
      );
    }
    if (target.id === room.facilitatorId) {
      throw new RoomOperationError(
        "INVALID_PAYLOAD",
        "Transfiere el rol de facilitador antes de cambiar tu propio rol.",
      );
    }
    target.role = role;
    if (role === "spectator") room.votes.delete(target.id);
    this.touch(room);
    return room;
  }

  transferFacilitator(code: string, participantId: string, targetId: string): Room {
    const room = this.requireRoom(code);
    const current = this.requireFacilitator(room, participantId);
    const target = room.participants.get(targetId);
    if (!target) {
      throw new RoomOperationError(
        "PARTICIPANT_NOT_FOUND",
        "Ese participante ya no está en la sala.",
      );
    }
    current.role = "player";
    target.role = "facilitator";
    room.facilitatorId = target.id;
    this.touch(room);
    this.emitStore("facilitator-changed", { room, facilitatorId: target.id });
    return room;
  }

  /**
   * Barrido único de mantenimiento (§3.6): elimina participantes desconectados
   * pasado el margen y salas vacías pasado el suyo.
   */
  sweep(): void {
    const timestamp = this.now();

    for (const room of [...this.rooms.values()]) {
      for (const participant of [...room.participants.values()]) {
        if (
          !participant.connected &&
          participant.disconnectedAt !== undefined &&
          timestamp - participant.disconnectedAt >=
            this.options.disconnectedParticipantGraceMs
        ) {
          this.removeParticipant(room, participant.id);
        }
      }

      const empty = this.connectedCount(room) === 0;
      if (empty) {
        room.emptySince ??= timestamp;
      } else {
        delete room.emptySince;
      }

      const expired =
        room.emptySince !== undefined &&
        timestamp - room.emptySince >= this.options.emptyRoomGraceMs;

      if (expired || room.participants.size === 0) {
        this.deleteRoom(room, "La sala se cerró por inactividad.");
      }
    }
  }

  /** Libera participantes, votos, índices y referencias de la sala (§3.6). */
  deleteRoom(room: Room, reason: string): void {
    room.participants.clear();
    room.votes.clear();
    room.history.length = 0;
    this.rooms.delete(room.id);
    this.roomIdByCode.delete(room.code);
    this.emitStore("room-closed", { code: room.code, reason });
  }

  clear(): void {
    for (const room of [...this.rooms.values()]) {
      room.participants.clear();
      room.votes.clear();
      room.history.length = 0;
    }
    this.rooms.clear();
    this.roomIdByCode.clear();
  }

  /** Representación pública; los votos sólo se incluyen tras revelar (§7). */
  buildPublicState(room: Room): PublicRoomState {
    const revealed = room.status === "revealed";
    const participants: PublicParticipant[] = [...room.participants.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((participant) => {
        const vote = room.votes.get(participant.id);
        const publicParticipant: PublicParticipant = {
          participantId: participant.id,
          alias: participant.alias,
          role: participant.role,
          connected: participant.connected,
          hasVoted: vote !== undefined,
        };
        if (revealed && vote !== undefined) publicParticipant.vote = vote;
        return publicParticipant;
      });

    return {
      code: room.code,
      topic: room.topic,
      status: room.status,
      round: room.round,
      facilitatorId: room.facilitatorId,
      participants,
      results: revealed ? computeResults(room.votes.values()) : null,
      history: room.history,
      maxParticipants: this.options.maxParticipantsPerRoom,
    };
  }
}
