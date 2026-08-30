import { useCallback, useEffect, useState } from "react";

/** Cada cuánto se comprueba si hay una versión nueva publicada. */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
/** Margen mínimo entre comprobaciones seguidas, para no pedir en cada foco. */
const CHECK_THROTTLE_MS = 20 * 1000;

/** Nombre del bundle que está ejecutándose ahora mismo. */
function currentBundle(): string | null {
  const script = document.querySelector<HTMLScriptElement>(
    'script[type="module"][src]',
  );
  return script?.getAttribute("src") ?? null;
}

/** Nombre del bundle que referencia el `index.html` publicado. */
async function publishedBundle(): Promise<string | null> {
  const response = await fetch(`${import.meta.env.BASE_URL}index.html`, {
    cache: "no-store",
  });
  if (!response.ok) return null;
  const html = await response.text();
  return /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(html)?.[1] ?? null;
}

/**
 * Detecta que se publicó una versión nueva mientras la pestaña seguía
 * abierta. GitHub Pages cachea `index.html`, así que sin esto alguien podía
 * seguir usando el bundle anterior durante horas sin enterarse.
 */
export function useAppUpdate(): { updateAvailable: boolean; reload: () => void } {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const running = currentBundle();
    // En desarrollo el módulo es `/src/main.tsx`: no hay nada que comparar.
    if (!running || running.includes("/src/")) return undefined;

    let cancelled = false;
    let lastCheck = 0;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastCheck < CHECK_THROTTLE_MS) return;
      lastCheck = now;
      try {
        const published = await publishedBundle();
        if (!cancelled && published && published !== running) {
          setUpdateAvailable(true);
        }
      } catch {
        // Sin red no hay nada que decidir; se reintenta más tarde.
      }
    };

    const timer = setInterval(check, CHECK_INTERVAL_MS);
    // También al volver a la aplicación, que es cuando más se nota el desfase.
    // `visibilitychange` cubre el cambio de pestaña; volver desde otra
    // ventana no lo dispara, y ese es el caso más habitual en escritorio.
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    void check();

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  return { updateAvailable, reload };
}
