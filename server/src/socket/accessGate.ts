import { createHash, timingSafeEqual } from "node:crypto";
import type { AppServer, AppSocket } from "./handlers.js";
import { RateLimiter } from "./rateLimiter.js";

/** El cliente distingue este motivo para pedir la frase en vez de reintentar. */
export const UNAUTHORIZED = "UNAUTHORIZED";
export const TOO_MANY_ATTEMPTS = "TOO_MANY_ATTEMPTS";

/** Comparación de tiempo constante: los digests siempre miden 32 bytes. */
function matches(expected: string, provided: unknown): boolean {
  if (typeof provided !== "string") return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(expected), digest(provided));
}

/** Render va detrás de proxy: la IP real llega en `x-forwarded-for`. */
function clientIp(socket: AppSocket): string {
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
 * Puerta de acceso compartida. Al ser el único candado del servicio, limita
 * los intentos fallidos por IP para que una frase corta no se pueda adivinar
 * por fuerza bruta.
 */
export function registerAccessGate(io: AppServer, options: AccessGateOptions): void {
  if (!options.secret) return;

  const attempts = new RateLimiter(options.windowMs, options.maxAttempts);

  io.use((socket, next) => {
    const ip = clientIp(socket as AppSocket);

    if (matches(options.secret, socket.handshake.auth?.["secret"])) {
      attempts.forget(ip);
      next();
      return;
    }

    next(new Error(attempts.allow(ip) ? UNAUTHORIZED : TOO_MANY_ATTEMPTS));
  });
}
