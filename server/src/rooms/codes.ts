import { randomBytes, randomUUID } from "node:crypto";
import { LIMITS, ROOM_CODE_ALPHABET } from "@planincito/shared";

/** Código corto no predecible: bytes aleatorios sin sesgo de módulo. */
export function generateRoomCode(
  isTaken: (code: string) => boolean,
  maxAttempts = 100,
): string {
  const alphabet = ROOM_CODE_ALPHABET;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let code = "";
    while (code.length < LIMITS.ROOM_CODE_LENGTH) {
      // 256 % 32 === 0, así que no hay sesgo con este alfabeto de 32 símbolos.
      for (const byte of randomBytes(LIMITS.ROOM_CODE_LENGTH)) {
        if (code.length === LIMITS.ROOM_CODE_LENGTH) break;
        code += alphabet[byte % alphabet.length];
      }
    }
    if (!isTaken(code)) return code;
  }
  throw new Error("No fue posible generar un código de sala libre.");
}

export function generateId(): string {
  return randomUUID();
}

export function generateReconnectionToken(): string {
  return randomBytes(24).toString("base64url");
}
