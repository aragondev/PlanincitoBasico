import { useEffect, useRef, useState } from "react";
import type { CardReaction } from "@planincito/shared";

/** Lo que dura la salida de un emoticón; debe casar con `reaction-out`. */
const EXIT_MS = 420;

type Slot = CardReaction & {
  key: string;
  /** Ya no está en la carta: se queda visible mientras se va. */
  leaving: boolean;
};

/**
 * Emoticones apoyados en el borde superior de la carta. Cuando alguien cambia
 * el suyo, el nuevo entra al lado del anterior y sólo entonces el viejo se
 * va: el relevo se ve, en vez de que el emoticón cambie de golpe.
 */
export function SeatReactions({ reactions }: { reactions: CardReaction[] }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const sequence = useRef(0);
  // El estado llega en un array nuevo cada vez, así que se compara por
  // contenido: si no, cualquier cambio de la sala relanzaría la animación.
  const signature = reactions
    .map((reaction) => `${reaction.fromId}:${reaction.emoji}`)
    .join("|");

  useEffect(() => {
    setSlots((current) => {
      const next: Slot[] = [];
      for (const slot of current) {
        const still = reactions.find((item) => item.fromId === slot.fromId);
        if (slot.leaving) next.push(slot);
        else if (still && still.emoji === slot.emoji) next.push(slot);
        else next.push({ ...slot, leaving: true });
      }
      for (const reaction of reactions) {
        const present = next.some(
          (slot) => !slot.leaving && slot.fromId === reaction.fromId,
        );
        if (present) continue;
        sequence.current += 1;
        next.push({ ...reaction, key: `${reaction.fromId}-${sequence.current}`, leaving: false });
      }
      return next;
    });
    // `signature` resume el contenido de `reactions`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    if (!slots.some((slot) => slot.leaving)) return undefined;
    const timer = setTimeout(
      () => setSlots((current) => current.filter((slot) => !slot.leaving)),
      EXIT_MS,
    );
    return () => clearTimeout(timer);
  }, [slots]);

  if (slots.length === 0) return null;

  return (
    <span className="seat__reactions" aria-hidden="true">
      {slots.map((slot) => (
        <span
          key={slot.key}
          className={`seat__reaction${slot.leaving ? " seat__reaction--out" : ""}`}
        >
          {slot.emoji}
        </span>
      ))}
    </span>
  );
}
