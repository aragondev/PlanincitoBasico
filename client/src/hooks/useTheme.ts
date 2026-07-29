import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "planincito:theme";

function preferred(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Modo privado: se decide por la preferencia del sistema.
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/** Tema claro u oscuro; arranca en la preferencia del sistema y se recuerda. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(preferred);

  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);

  // Si nunca se eligió a mano, se sigue al sistema cuando éste cambia.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (event: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(KEY)) return;
      } catch {
        // Sin almacenamiento seguimos al sistema igualmente.
      }
      setTheme(event.matches ? "light" : "dark");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // La elección durará sólo esta visita.
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
