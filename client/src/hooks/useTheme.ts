import { useCallback, useEffect, useState } from "react";
import { read, write } from "../socket/storage";

export type Theme = "light" | "dark";

const KEY = "planincito:theme";

function preferred(): Theme {
  const saved = read(KEY);
  if (saved === "light" || saved === "dark") return saved;
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
      // Una elección manual manda sobre el sistema.
      if (read(KEY)) return;
      setTheme(event.matches ? "light" : "dark");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      write(KEY, next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
