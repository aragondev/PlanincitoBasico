const KEY = "planincito:alias";

/**
 * Último alias usado, para no reescribirlo en cada sala. Es una comodidad
 * local: no viaja al servidor ni identifica a nadie entre salas.
 */
export function loadLastAlias(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveLastAlias(alias: string): void {
  const value = alias.trim();
  if (!value) return;
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // Modo privado: se volverá a escribir a mano la próxima vez.
  }
}
