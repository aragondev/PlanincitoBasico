import { read, write } from "./storage";

const KEY = "planincito:alias";

/**
 * Último alias usado, para no reescribirlo en cada sala. Es una comodidad
 * local: no viaja al servidor ni identifica a nadie entre salas.
 */
export function loadLastAlias(): string {
  return read(KEY) ?? "";
}

export function saveLastAlias(alias: string): void {
  const value = alias.trim();
  if (value) write(KEY, value);
}
