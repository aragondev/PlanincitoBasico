import { useEffect, useRef, useState } from "react";
import { REACTIONS, THROWABLES, type Reaction, type Throwable } from "@planincito/shared";
import { ReactionIcon } from "./Icon";

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
  /** Sólo hay objetos que lanzar mientras esa persona siga sin votar. */
  canThrow: boolean;
  /** El emoticón que yo puse en esta carta, si es que puse alguno. */
  mine: Reaction | null;
  onReact: (emoji: Reaction) => void;
  onPick: (item: Throwable) => void;
  onClose: () => void;
};

/**
 * Menú del asiento. De entrada sólo se ve un botón de emoticón —o el que ya
 * pusiste—, que despliega el listado; ocho caritas siempre a la vista hacían
 * del menú un tablón. Debajo, si quien ocupa la carta aún no ha votado, los
 * objetos para meterle prisa.
 */
export function SeatMenu({
  alias,
  canThrow,
  mine,
  onReact,
  onPick,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // La primera pulsación cierra el listado; la segunda, el menú entero.
      if (event.key !== "Escape") return;
      if (picking) setPicking(false);
      else onClose();
    };
    /**
     * Se cierra al pulsar fuera, pero no dentro del propio asiento: la carta
     * y el menú son la misma zona de interacción.
     */
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      const seat = ref.current?.closest(".seat__slot");
      if (seat?.contains(target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose, picking]);

  return (
    <div
      className="seatmenu"
      ref={ref}
      role="menu"
      aria-label={`Reaccionar a la carta de ${alias}`}
    >
      {picking ? (
        <div className="seatmenu__row seatmenu__row--emoji">
          {REACTIONS.map((emoji) => {
            const chosen = mine === emoji;
            return (
              <button
                key={emoji}
                type="button"
                role="menuitemradio"
                aria-checked={chosen}
                className={`seatmenu__item${chosen ? " seatmenu__item--on" : ""}`}
                title={
                  chosen
                    ? `Quitar ${emoji} de la carta de ${alias}`
                    : `Reaccionar con ${emoji} a ${alias}`
                }
                aria-label={
                  chosen
                    ? `Quitar ${emoji} de la carta de ${alias}`
                    : `Reaccionar con ${emoji} sobre la carta de ${alias}`
                }
                onClick={(event) => {
                  event.stopPropagation();
                  onReact(emoji);
                }}
              >
                <span className="seatmenu__glyph">{emoji}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="seatmenu__row seatmenu__row--open">
          <button
            type="button"
            role="menuitem"
            className={`seatmenu__item${mine ? " seatmenu__item--on" : ""}`}
            aria-expanded={false}
            aria-haspopup="true"
            title={
              mine
                ? `Cambiar o quitar tu ${mine} en la carta de ${alias}`
                : `Reaccionar a la carta de ${alias}`
            }
            aria-label={
              mine
                ? `Cambiar o quitar tu emoticón en la carta de ${alias}`
                : `Elegir un emoticón para la carta de ${alias}`
            }
            onClick={(event) => {
              event.stopPropagation();
              setPicking(true);
            }}
          >
            {mine ? (
              <span className="seatmenu__glyph">{mine}</span>
            ) : (
              <ReactionIcon className="seatmenu__glyph" />
            )}
          </button>
        </div>
      )}

      {canThrow && (
        <div className="seatmenu__row seatmenu__row--throw">
          {THROWABLES.map((item) => (
            <button
              key={item}
              type="button"
              role="menuitem"
              className="seatmenu__item"
              title={`${THROWABLE_LABEL[item]} a ${alias}`}
              aria-label={`Lanzar ${THROWABLE_LABEL[item]} a ${alias}`}
              onClick={(event) => {
                event.stopPropagation();
                onPick(item);
              }}
            >
              <ThrowableIcon item={item} className="seatmenu__glyph" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
