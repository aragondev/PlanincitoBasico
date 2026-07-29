import { useEffect, useRef } from "react";
import { THROWABLES, type Throwable } from "@planincito/shared";

/**
 * El avión y la flecha se dibujan en SVG: los emoji equivalentes son
 * aviones de línea y arcos, no lo que se lanza en una reunión.
 */
export const THROWABLE_GLYPH: Record<Throwable, string> = {
  plane: "",
  arrow: "",
  paper: "🧻",
  tomato: "🍅",
  rock: "🪨",
};

const THROWABLE_LABEL: Record<Throwable, string> = {
  plane: "Avioncito de papel",
  arrow: "Flecha",
  paper: "Bola de papel",
  tomato: "Tomate",
  rock: "Piedra",
};

/** Avión de papel visto desde arriba, con el pliegue central marcado. */
export function PaperPlane({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12 22 3l-5 18-4.5-6.5L2 12Z" fill="#f1f1f4" />
      <path d="M22 3 12.5 14.5 12 21l-1.5-6.5L22 3Z" fill="#c8c8d2" />
      <path d="M2 12 22 3l-11.5 11.5L2 12Z" fill="#ffffff" />
    </svg>
  );
}

/** Flecha con punta y plumas, orientada hacia la derecha. */
export function Arrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 11.2h14v1.6H3z" fill="#8a6a4a" />
      <path d="M16 8.5 23 12l-7 3.5V8.5Z" fill="#c9ced6" />
      <path d="M3 8.6 7 12l-4 3.4-1.6-.9L4 12 1.4 9.5 3 8.6Z" fill="#e2585f" />
    </svg>
  );
}

export function ThrowableIcon({
  item,
  className,
}: {
  item: Throwable;
  className?: string;
}) {
  if (item === "plane") return <PaperPlane className={className} />;
  if (item === "arrow") return <Arrow className={className} />;
  return <span className={className}>{THROWABLE_GLYPH[item]}</span>;
}

type Props = {
  alias: string;
  onPick: (item: Throwable) => void;
  onClose: () => void;
};

/** Menú de objetos para meter prisa a quien todavía no ha votado. */
export function ThrowMenu({ alias, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  return (
    <div className="throwmenu" ref={ref} role="menu" aria-label={`Lanzar algo a ${alias}`}>
      {THROWABLES.map((item) => (
        <button
          key={item}
          type="button"
          role="menuitem"
          className="throwmenu__item"
          title={`${THROWABLE_LABEL[item]} a ${alias}`}
          aria-label={`Lanzar ${THROWABLE_LABEL[item]} a ${alias}`}
          onClick={(event) => {
            event.stopPropagation();
            onPick(item);
          }}
        >
          <ThrowableIcon item={item} className="throwmenu__glyph" />
        </button>
      ))}
    </div>
  );
}
