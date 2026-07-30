/**
 * Acceso a `localStorage` que nunca lanza. En modo privado o con la cuota
 * llena, cada llamada puede fallar; envolverla en cada punto de uso repetía
 * el mismo `try/catch` en todos los módulos que guardan algo.
 */
export function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento el dato dura lo que la pestaña; no hay más que hacer.
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
    // El almacén de sesión se limpia también: hubo una época en que las
    // credenciales vivían ahí y podrían quedar restos.
    sessionStorage.removeItem(key);
  } catch {
    // Ignorado a propósito.
  }
}

/** Lee y deserializa; devuelve `null` si falta o está corrupto. */
export function readJson<T>(key: string): T | null {
  const raw = read(key) ?? readSession(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
