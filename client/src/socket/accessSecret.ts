const KEY = "planincito:access";

/**
 * A diferencia de las credenciales de sala, la frase de acceso vive en
 * `localStorage`: es una clave compartida del equipo y no tiene sentido
 * volver a pedirla en cada pestaña.
 */
export function loadAccessSecret(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveAccessSecret(secret: string): void {
  try {
    localStorage.setItem(KEY, secret);
  } catch {
    // Modo privado: la frase se pedirá otra vez la próxima sesión.
  }
}

export function clearAccessSecret(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignorado a propósito.
  }
}
