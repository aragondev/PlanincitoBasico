import type { SessionCredentials } from "@planincito/shared";

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
  try {
    // Se lee también el almacén antiguo para no perder sesiones en curso.
    const raw =
      localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY) ?? null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionCredentials>;
    if (!parsed.roomCode || !parsed.participantId || !parsed.reconnectionToken) {
      return null;
    }
    return parsed as SessionCredentials;
  } catch {
    return null;
  }
}

export function saveSession(credentials: SessionCredentials): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(credentials));
  } catch {
    // Modo privado o almacenamiento lleno: seguimos sin poder reconectar.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    // Ignorado a propósito.
  }
}
