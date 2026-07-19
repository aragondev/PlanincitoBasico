import type { SessionCredentials } from "@planincito/shared";

const KEY = "planincito:session";

/**
 * `sessionStorage` sólo permite recuperar el lugar tras recargar la pestaña.
 * No es una cuenta ni una sesión permanente (§9).
 */
export function loadSession(): SessionCredentials | null {
  try {
    const raw = sessionStorage.getItem(KEY);
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
    sessionStorage.setItem(KEY, JSON.stringify(credentials));
  } catch {
    // Modo privado o almacenamiento lleno: seguimos sin poder reconectar.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Ignorado a propósito.
  }
}
