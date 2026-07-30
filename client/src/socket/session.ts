import type { SessionCredentials } from "@planincito/shared";
import { readJson, remove, write } from "./storage";

const KEY = "planincito:session";

/**
 * El plan (§9) proponía `sessionStorage`, pero el navegador lo borra al cerrar
 * la pestaña: quien volvía entraba como participante nuevo y su asiento
 * anterior quedaba de fantasma hasta expirar. Con `localStorage` la identidad
 * temporal sobrevive al cierre y se recupera el mismo sitio.
 *
 * Sigue sin ser una cuenta: son credenciales de una sala concreta que dejan de
 * servir en cuanto esa sala desaparece.
 */
export function loadSession(): SessionCredentials | null {
  const parsed = readJson<Partial<SessionCredentials>>(KEY);
  if (!parsed?.roomCode || !parsed.participantId || !parsed.reconnectionToken) {
    return null;
  }
  return parsed as SessionCredentials;
}

export function saveSession(credentials: SessionCredentials): void {
  write(KEY, JSON.stringify(credentials));
}

export function clearSession(): void {
  remove(KEY);
}
