import { read, remove, write } from "./storage";

const KEY = "planincito:access";

/**
 * Frase en curso, aún sin validar. Se mantiene en memoria para poder
 * reintentar y corregir una errata sin persistir algo que el servidor
 * todavía no aceptó.
 */
let staged: string | null = null;

/** Valor que se envía al crear una sala: el intento en curso o el guardado. */
export function getAccessSecret(): string {
  return staged ?? read(KEY) ?? "";
}

/** Prepara una frase para el siguiente intento, sin guardarla todavía. */
export function stageAccessSecret(secret: string): void {
  staged = secret;
}

/** `true` si esta visita ya tiene una frase aceptada guardada. */
export function hasStoredAccessSecret(): boolean {
  return Boolean(read(KEY));
}

/**
 * Persiste la frase sólo cuando la sala llegó a crearse: así una frase
 * incorrecta no queda recordada para la próxima visita.
 */
export function persistAccessSecret(): void {
  const secret = getAccessSecret();
  if (secret) write(KEY, secret);
}

export function clearAccessSecret(): void {
  staged = null;
  remove(KEY);
}
