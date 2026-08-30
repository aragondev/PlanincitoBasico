import {
  CARD_VALUES,
  LIMITS,
  REACTIONS,
  ROOM_CODE_ALPHABET,
  THROWABLES,
  type CardValue,
  type ParticipantRole,
  type Reaction,
  type Throwable,
} from "@planincito/shared";

export class ValidationError extends Error {
  constructor(
    readonly code:
      | "INVALID_ALIAS"
      | "INVALID_CODE"
      | "INVALID_PAYLOAD"
      | "INVALID_CARD",
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Quita caracteres de control y espacios redundantes. */
function clean(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAlias(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError("INVALID_ALIAS", "El alias debe ser texto.");
  }
  const alias = clean(value);
  if (alias.length === 0) {
    throw new ValidationError("INVALID_ALIAS", "El alias no puede estar vacío.");
  }
  if (alias.length > LIMITS.MAX_ALIAS_LENGTH) {
    throw new ValidationError(
      "INVALID_ALIAS",
      `El alias supera ${LIMITS.MAX_ALIAS_LENGTH} caracteres.`,
    );
  }
  return alias;
}

export function parseRoomCode(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError("INVALID_CODE", "El código debe ser texto.");
  }
  const code = clean(value).toUpperCase();
  if (code.length !== LIMITS.ROOM_CODE_LENGTH) {
    throw new ValidationError(
      "INVALID_CODE",
      `El código debe tener ${LIMITS.ROOM_CODE_LENGTH} caracteres.`,
    );
  }
  for (const char of code) {
    if (!ROOM_CODE_ALPHABET.includes(char)) {
      throw new ValidationError("INVALID_CODE", "El código no es válido.");
    }
  }
  return code;
}

export function parseTopic(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new ValidationError("INVALID_PAYLOAD", "El tema debe ser texto.");
  }
  const topic = clean(value);
  if (topic.length > LIMITS.MAX_TOPIC_LENGTH) {
    throw new ValidationError(
      "INVALID_PAYLOAD",
      `El tema supera ${LIMITS.MAX_TOPIC_LENGTH} caracteres.`,
    );
  }
  return topic;
}

export function parseCardValue(value: unknown): CardValue {
  if (typeof value !== "string" || !CARD_VALUES.includes(value as CardValue)) {
    throw new ValidationError("INVALID_CARD", "La carta no pertenece al mazo.");
  }
  return value as CardValue;
}

export function parseId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{6,64}$/.test(value)) {
    throw new ValidationError("INVALID_PAYLOAD", "Identificador inválido.");
  }
  return value;
}

export function parseRole(value: unknown): Exclude<ParticipantRole, "facilitator"> {
  if (value !== "player" && value !== "spectator") {
    throw new ValidationError(
      "INVALID_PAYLOAD",
      "El rol debe ser jugador o espectador.",
    );
  }
  return value;
}

export function parseThrowable(value: unknown): Throwable {
  if (typeof value !== "string" || !THROWABLES.includes(value as Throwable)) {
    throw new ValidationError("INVALID_PAYLOAD", "Ese objeto no se puede lanzar.");
  }
  return value as Throwable;
}

export function parseReaction(value: unknown): Reaction {
  if (typeof value !== "string" || !REACTIONS.includes(value as Reaction)) {
    throw new ValidationError("INVALID_PAYLOAD", "Ese emoticón no está en la lista.");
  }
  return value as Reaction;
}

/** Rechaza payloads desproporcionados antes de procesarlos (§3.5). */
export function assertPayloadSize(payload: unknown, maxBytes: number): void {
  if (payload === undefined) return;
  let size: number;
  try {
    size = Buffer.byteLength(JSON.stringify(payload) ?? "", "utf8");
  } catch {
    throw new ValidationError("INVALID_PAYLOAD", "Payload no serializable.");
  }
  if (size > maxBytes) {
    throw new ValidationError(
      "INVALID_PAYLOAD",
      `Payload de ${size} bytes supera el máximo de ${maxBytes}.`,
    );
  }
}
