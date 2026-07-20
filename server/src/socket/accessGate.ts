import { createHash, timingSafeEqual } from "node:crypto";
import type { Socket } from "socket.io";
import { RoomOperationError } from "../rooms/errors.js";
import { RateLimiter } from "./rateLimiter.js";

/** Comparación de tiempo constante: los digests siempre miden 32 bytes. */
function matches(expected: string, provided: unknown): boolean {
  if (typeof provided !== "string") return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(expected), digest(provided));
}

/** Render va detrás de proxy: la IP real llega en `x-forwarded-for`. */
function clientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return raw?.split(",")[0]?.trim() || socket.handshake.address;
}

export type AccessGateOptions = {
  /** Cadena vacía o ausente desactiva la puerta (desarrollo local). */
  secret: string;
  maxAttempts: number;
  windowMs: number;
};

/**
 * Protege únicamente la creación de salas, que es lo que consume recursos
 * de la instancia. Entrar a una sala existente no pasa por aquí: para eso
 * ya hace falta conocer el código, que es impredecible.
 */
export class AccessGate {
  private readonly attempts: RateLimiter;

  constructor(private readonly options: AccessGateOptions) {
    this.attempts = new RateLimiter(options.windowMs, options.maxAttempts);
  }

  get enabled(): boolean {
    return this.options.secret !== "";
  }

  /** Lanza si la frase falta, es incorrecta o hubo demasiados intentos. */
  assertCanCreate(socket: Socket, provided: unknown): void {
    if (!this.enabled) return;

    const ip = clientIp(socket);

    if (matches(this.options.secret, provided)) {
      this.attempts.forget(ip);
      return;
    }

    // Al ser el único candado, limitamos los intentos para que una frase
    // corta no se pueda adivinar por fuerza bruta.
    if (!this.attempts.allow(ip)) {
      throw new RoomOperationError(
        "TOO_MANY_ATTEMPTS",
        "Demasiados intentos fallidos. Espera unos minutos antes de volver a probar.",
      );
    }

    throw new RoomOperationError(
      "UNAUTHORIZED",
      "Necesitas la frase de acceso para crear una sala.",
    );
  }
}
