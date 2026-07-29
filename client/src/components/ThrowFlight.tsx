import { useEffect, useState } from "react";
import type { Throwable } from "@planincito/shared";
import { THROWABLE_EMOJI } from "./ThrowMenu";

export type Flight = {
  id: number;
  fromId: string;
  toId: string;
  item: Throwable;
  fromAlias: string;
};

/** Centro del asiento de un participante, en coordenadas de viewport. */
function seatCenter(participantId: string): { x: number; y: number } | null {
  const seat = document.querySelector<HTMLElement>(
    `[data-seat="${CSS.escape(participantId)}"]`,
  );
  if (!seat) return null;
  const box = seat.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/**
 * Objeto que vuela de un asiento a otro describiendo un arco.
 * Es puramente decorativo: no bloquea la interfaz ni altera el estado.
 */
export function ThrowFlight({
  flight,
  onDone,
}: {
  flight: Flight;
  onDone: (id: number) => void;
}) {
  const [impact, setImpact] = useState(false);

  useEffect(() => {
    const from = seatCenter(flight.fromId);
    const to = seatCenter(flight.toId);
    // Si alguno de los asientos no está en pantalla, no hay nada que animar.
    if (!from || !to) {
      onDone(flight.id);
      return undefined;
    }

    const element = document.getElementById(`flight-${flight.id}`);
    if (!element) {
      onDone(flight.id);
      return undefined;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 260 : 850;
    // El arco pasa por encima de la mesa para que se lea el recorrido.
    const midX = (from.x + to.x) / 2;
    const midY = Math.min(from.y, to.y) - 90;

    const animation = element.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${midX}px, ${midY}px) rotate(180deg)`, opacity: 1 },
        { transform: `translate(${to.x}px, ${to.y}px) rotate(360deg)`, opacity: 1 },
      ],
      { duration, easing: "cubic-bezier(0.4, 0, 0.5, 1)", fill: "forwards" },
    );

    let timer: ReturnType<typeof setTimeout>;
    animation.onfinish = () => {
      setImpact(true);
      timer = setTimeout(() => onDone(flight.id), 520);
    };

    return () => {
      animation.cancel();
      clearTimeout(timer);
    };
  }, [flight, onDone]);

  return (
    <span
      id={`flight-${flight.id}`}
      className={`flight${impact ? " flight--impact" : ""}`}
      aria-hidden="true"
    >
      {THROWABLE_EMOJI[flight.item]}
    </span>
  );
}
