import { useEffect, useRef } from "react";
import { THROWABLES, type Throwable } from "@planincito/shared";

export const THROWABLE_EMOJI: Record<Throwable, string> = {
  plane: "✈️",
  paper: "📄",
  tomato: "🍅",
  clap: "👏",
  coffee: "☕",
};

const THROWABLE_LABEL: Record<Throwable, string> = {
  plane: "Avioncito",
  paper: "Bola de papel",
  tomato: "Tomate",
  clap: "Aplauso",
  coffee: "Café",
};

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
    // En móvil se cierra tocando fuera; en escritorio, al salir el puntero.
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
          {THROWABLE_EMOJI[item]}
        </button>
      ))}
    </div>
  );
}
