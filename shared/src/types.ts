/** Valores del mazo Fibonacci definido en el plan (§5.3). */
export const CARD_VALUES = [
  "0",
  "1",
  "2",
  "3",
  "5",
  "8",
  "13",
  "21",
  "?",
  "coffee",
] as const;

export type CardValue = (typeof CARD_VALUES)[number];

/** Cartas que no participan en promedio ni mediana (§5.4). */
export const NON_NUMERIC_CARDS: readonly CardValue[] = ["?", "coffee"];

export type ParticipantRole = "facilitator" | "player" | "spectator";

export type RoomStatus = "voting" | "revealed";

/** Representación pública de un participante (§7). `vote` sólo viaja tras revelar. */
export type PublicParticipant = {
  participantId: string;
  alias: string;
  role: ParticipantRole;
  connected: boolean;
  hasVoted: boolean;
  vote?: CardValue;
};

export type VoteDistributionEntry = {
  value: CardValue;
  count: number;
};

export type RoundResults = {
  /** `null` cuando no hubo votos numéricos (§5.4). */
  average: number | null;
  median: number | null;
  distribution: VoteDistributionEntry[];
  totalVotes: number;
};

/** Una ronda ya revelada. Vive en memoria con la sala y muere con ella. */
export type RoundHistoryEntry = {
  round: number;
  topic: string;
  results: RoundResults;
  /** Alias y carta de cada quien, para que se lea aunque ya se hayan ido. */
  votes: { alias: string; vote: CardValue }[];
  revealedAt: number;
};

export type PublicRoomState = {
  code: string;
  topic: string;
  status: RoomStatus;
  round: number;
  facilitatorId: string;
  participants: PublicParticipant[];
  results: RoundResults | null;
  /** Rondas reveladas de esta sesión, de la más reciente a la más antigua. */
  history: RoundHistoryEntry[];
  maxParticipants: number;
};

export type RoomErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_LIMIT_REACHED"
  | "INVALID_ALIAS"
  | "INVALID_CODE"
  | "INVALID_PAYLOAD"
  | "INVALID_CARD"
  | "NOT_FACILITATOR"
  | "NOT_IN_ROOM"
  | "SPECTATOR_CANNOT_VOTE"
  | "ROUND_ALREADY_REVEALED"
  | "PARTICIPANT_NOT_FOUND"
  | "RECONNECTION_FAILED"
  | "RATE_LIMITED"
  | "SERVER_SHUTTING_DOWN"
  /** Falta la frase de acceso o es incorrecta (sólo al crear una sala). */
  | "UNAUTHORIZED"
  | "TOO_MANY_ATTEMPTS";

export type RoomError = {
  code: RoomErrorCode;
  message: string;
};

/** Credenciales temporales guardadas en `sessionStorage` (§9). */
export type SessionCredentials = {
  roomCode: string;
  participantId: string;
  reconnectionToken: string;
};
