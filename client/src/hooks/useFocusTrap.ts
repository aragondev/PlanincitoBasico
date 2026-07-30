import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Retiene el foco dentro de un contenedor mientras está abierto y lo devuelve
 * al cerrarse. Sin esto, `aria-modal="true"` promete algo que no se cumple: el
 * tabulador seguía recorriendo la sala de detrás, así que con teclado o lector
 * de pantalla el panel era una trampa al revés.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return undefined;
    const container = ref.current;
    if (!container) return undefined;

    const previous = document.activeElement as HTMLElement | null;

    const focusable = () =>
      [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null,
      );

    // El primer elemento recibe el foco al abrir; si no hay ninguno, el panel.
    const first = focusable()[0];
    if (first) first.focus();
    else {
      container.tabIndex = -1;
      container.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const current = document.activeElement;

      // Ciclo cerrado: del último al primero y al revés con Mayúsculas.
      if (!event.shiftKey && current === lastItem) {
        event.preventDefault();
        firstItem.focus();
      } else if (event.shiftKey && current === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (current && !container.contains(current)) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // Devolver el foco a quien abrió el panel evita que salte al principio.
      previous?.focus?.();
    };
  }, [active]);

  return ref;
}
