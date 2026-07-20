import { LIMITS } from "@planincito/shared";

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Variable de entorno inválida: ${name}=${raw}`);
  }
  return parsed;
}

/** Orígenes permitidos, separados por coma. `*` desactiva la comprobación. */
function origins(): string[] | "*" {
  const raw = process.env.CLIENT_ORIGIN?.trim();
  if (!raw || raw === "*") return "*";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export const config = {
  port: num("PORT", 3000),
  clientOrigin: origins(),
  /** Frase compartida para entrar. Vacía = sin restricción (desarrollo local). */
  roomAccessSecret: process.env.ROOM_ACCESS_SECRET?.trim() ?? "",
  accessMaxAttempts: num("ACCESS_MAX_ATTEMPTS", 10),
  accessAttemptWindowMs: num("ACCESS_ATTEMPT_WINDOW_MS", 600_000),
  maxActiveRooms: num("MAX_ACTIVE_ROOMS", 25),
  maxParticipantsPerRoom: num("MAX_PARTICIPANTS_PER_ROOM", 8),
  emptyRoomGraceMs: num("EMPTY_ROOM_GRACE_MS", 60_000),
  /** Rondas conservadas por sala; el historial vive sólo mientras la sala. */
  maxRoundHistory: num("MAX_ROUND_HISTORY", 50),
  disconnectedParticipantGraceMs: num(
    "DISCONNECTED_PARTICIPANT_GRACE_MS",
    60_000,
  ),
  maxEventPayloadBytes: num(
    "MAX_EVENT_PAYLOAD_BYTES",
    LIMITS.MAX_EVENT_PAYLOAD_BYTES,
  ),
  /** Barrido único de limpieza; no se crean temporizadores por participante. */
  cleanupIntervalMs: num("CLEANUP_INTERVAL_MS", 15_000),
  /** Límite de eventos por socket dentro de la ventana (§3.5). */
  rateLimitWindowMs: num("RATE_LIMIT_WINDOW_MS", 5_000),
  rateLimitMaxEvents: num("RATE_LIMIT_MAX_EVENTS", 60),
  shutdownGraceMs: num("SHUTDOWN_GRACE_MS", 5_000),
} as const;

export type Config = typeof config;
