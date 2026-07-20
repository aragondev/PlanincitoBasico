const KEY = "planincito:access";

/**
 * Frase en curso, aún sin validar. Se mantiene en memoria para poder
 * reintentar y corregir una errata sin persistir algo que el servidor
 * todavía no aceptó.
 */
let staged: string | null = null;

/** Valor que se envía en el handshake: el intento en curso o el guardado. */
export function getAccessSecret(): string {
  if (staged !== null) return staged;
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** Prepara una frase para el siguiente intento, sin guardarla todavía. */
export function stageAccessSecret(secret: string): void {
  staged = secret;
}

/**
 * Persiste la frase sólo cuando el servidor aceptó la conexión: así una
 * frase incorrecta no queda recordada para la próxima visita.
 */
export function persistAccessSecret(): void {
  const secret = getAccessSecret();
  if (!secret) return;
  try {
    localStorage.setItem(KEY, secret);
  } catch {
    // Modo privado: se volverá a pedir en la próxima sesión.
  }
}

export function clearAccessSecret(): void {
  staged = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignorado a propósito.
  }
}
