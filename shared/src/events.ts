import type {
  CardValue,
  ParticipantRole,
  PublicParticipant,
  PublicRoomState,
  RoomError,
  SessionCredentials,
} from "./types.js";

/** Límites compartidos con el cliente para validar antes de enviar (§3.5). */
export const LIMITS = {
  MAX_ALIAS_LENGTH: 30,
  MAX_TOPIC_LENGTH: 200,
  MAX_EVENT_PAYLOAD_BYTES: 4096,
  ROOM_CODE_LENGTH: 6,
} as const;

/** Alfabeto sin caracteres ambiguos (0/O, 1/I) para códigos fáciles de dictar. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const CLIENT_EVENTS = {
  ROOM_CREATE: "room:create",
  ROOM_JOIN: "room:join",
  ROOM_RECONNECT: "room:reconnect",
  ROOM_LEAVE: "room:leave",
  TOPIC_UPDATE: "topic:update",
  VOTE_SUBMIT: "vote:submit",
  VOTES_REVEAL: "votes:reveal",
  ROUND_RESTART: "round:restart",
  PARTICIPANT_KICK: "participant:kick",
  PARTICIPANT_CHANGE_ROLE: "participant:change-role",
  FACILITATOR_TRANSFER: "facilitator:transfer",
} as const;

export const SERVER_EVENTS = {
  ROOM_CREATED: "room:created",
  ROOM_STATE: "room:state",
  ROOM_ERROR: "room:error",
  PARTICIPANT_JOINED: "participant:joined",
  PARTICIPANT_LEFT: "participant:left",
  PARTICIPANT_UPDATED: "participant:updated",
  VOTES_REVEALED: "votes:revealed",
  ROUND_RESTARTED: "round:restarted",
  FACILITATOR_CHANGED: "facilitator:changed",
  SERVER_RESTARTING: "server:restarting",
  ROOM_CLOSED: "room:closed",
} as const;

export type ClientToServerEvents = {
  /** `secret` sólo hace falta si la instancia exige frase para crear salas. */
  [CLIENT_EVENTS.ROOM_CREATE]: (payload: {
    alias: string;
    secret?: string;
  }) => void;
  [CLIENT_EVENTS.ROOM_JOIN]: (payload: {
    code: string;
    alias: string;
    asSpectator?: boolean;
  }) => void;
  [CLIENT_EVENTS.ROOM_RECONNECT]: (payload: SessionCredentials) => void;
  [CLIENT_EVENTS.ROOM_LEAVE]: () => void;
  [CLIENT_EVENTS.TOPIC_UPDATE]: (payload: { topic: string }) => void;
  [CLIENT_EVENTS.VOTE_SUBMIT]: (payload: { value: CardValue }) => void;
  [CLIENT_EVENTS.VOTES_REVEAL]: () => void;
  [CLIENT_EVENTS.ROUND_RESTART]: (payload: { topic?: string }) => void;
  [CLIENT_EVENTS.PARTICIPANT_KICK]: (payload: { participantId: string }) => void;
  [CLIENT_EVENTS.PARTICIPANT_CHANGE_ROLE]: (payload: {
    participantId: string;
    role: ParticipantRole;
  }) => void;
  [CLIENT_EVENTS.FACILITATOR_TRANSFER]: (payload: {
    participantId: string;
  }) => void;
};

export type ServerToClientEvents = {
  [SERVER_EVENTS.ROOM_CREATED]: (payload: {
    credentials: SessionCredentials;
    state: PublicRoomState;
  }) => void;
  /** `credentials` sólo viaja en el mensaje dirigido al propio participante. */
  [SERVER_EVENTS.ROOM_STATE]: (payload: {
    credentials?: SessionCredentials;
    state: PublicRoomState;
  }) => void;
  [SERVER_EVENTS.ROOM_ERROR]: (payload: RoomError) => void;
  [SERVER_EVENTS.PARTICIPANT_JOINED]: (payload: {
    participant: PublicParticipant;
    state: PublicRoomState;
  }) => void;
  [SERVER_EVENTS.PARTICIPANT_LEFT]: (payload: {
    participantId: string;
    state: PublicRoomState;
  }) => void;
  [SERVER_EVENTS.PARTICIPANT_UPDATED]: (payload: {
    participant: PublicParticipant;
    state: PublicRoomState;
  }) => void;
  [SERVER_EVENTS.VOTES_REVEALED]: (payload: { state: PublicRoomState }) => void;
  [SERVER_EVENTS.ROUND_RESTARTED]: (payload: { state: PublicRoomState }) => void;
  [SERVER_EVENTS.FACILITATOR_CHANGED]: (payload: {
    facilitatorId: string;
    state: PublicRoomState;
  }) => void;
  [SERVER_EVENTS.SERVER_RESTARTING]: (payload: { message: string }) => void;
  [SERVER_EVENTS.ROOM_CLOSED]: (payload: { reason: string }) => void;
};
