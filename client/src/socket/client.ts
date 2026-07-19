import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@planincito/shared";
import { loadAccessSecret } from "./accessSecret";

/** Motivos que el servidor devuelve en `connect_error` (ver `accessGate.ts`). */
export const UNAUTHORIZED = "UNAUTHORIZED";
export const TOO_MANY_ATTEMPTS = "TOO_MANY_ATTEMPTS";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3000";

/**
 * WebSocket primero y polling sólo como alternativa (§3.4).
 * La espera progresiva 1s → 2s → 4s → 8s → máx. 15s evita saturar el
 * backend mientras Render despierta de un arranque en frío (§9).
 */
export function createSocket(): AppSocket {
  return io(SOCKET_URL, {
    // Función, no objeto: se vuelve a leer en cada intento, así una frase
    // corregida se aplica sin recrear el socket.
    auth: (cb) => cb({ secret: loadAccessSecret() }),
    transports: ["websocket", "polling"],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000,
    randomizationFactor: 0.3,
    timeout: 20000,
  });
}
