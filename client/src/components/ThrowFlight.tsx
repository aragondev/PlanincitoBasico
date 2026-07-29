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

/** Cuántos proyectiles salen por lanzamiento: una andanada, no uno solo. */
const VOLLEY: Record<Throwable, number> = {
  plane: 4,
  paper: 4,
  tomato: 3,
  rock: 2,
};

/** Los que se estampan contra la carta en vez de caer al suelo. */
const SPLATS: Throwable[] = ["tomato"];

type Projectile = {
  key: number;
  /** Desde qué lado entra y a qué altura sale, para que no lleguen en fila. */
  fromLeft: boolean;
  offsetY: number;
  delay: number;
  spin: number;
};

function seatRect(participantId: string): DOMRect | null {
  const seat = document.querySelector<HTMLElement>(
    `[data-seat="${CSS.escape(participantId)}"]`,
  );
  return seat ? seat.getBoundingClientRect() : null;
}

/**
 * Andanada de objetos que entra desde los laterales, impacta en la carta del
 * destinatario y, según el objeto, se aplasta o cae. Es decorativo: no
 * bloquea la interfaz ni altera el estado de la sala.
 */
export function ThrowFlight({
  flight,
  onDone,
}: {
  flight: Flight;
  onDone: (id: number) => void;
}) {
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);

  useEffect(() => {
    const target = seatRect(flight.toId);
    if (!target) {
      onDone(flight.id);
      return undefined;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = reduced ? 1 : VOLLEY[flight.item];
    const splat = SPLATS.includes(flight.item);

    const items: Projectile[] = Array.from({ length: count }, (_, index) => ({
      key: index,
      fromLeft: index % 2 === 0,
      // Escalonados en altura para que la andanada no parezca una sola línea.
      offsetY: (index - (count - 1) / 2) * 22,
      delay: index * 90,
      spin: flight.item === "plane" ? 0 : (index % 2 === 0 ? 1 : -1) * 540,
    }));
    setProjectiles(items);

    const centerX = target.left + target.width / 2;
    const centerY = target.top + target.height / 2;
    const travel = reduced ? 220 : 620;
    const linger = splat ? 700 : 900;

    const animations: Animation[] = [];
    const raf = requestAnimationFrame(() => {
      for (const projectile of items) {
        const element = document.getElementById(
          `flight-${flight.id}-${projectile.key}`,
        );
        if (!element) continue;

        const startX = projectile.fromLeft ? -60 : window.innerWidth + 60;
        const startY = centerY + projectile.offsetY;
        // Los aviones apuntan hacia donde vuelan; el resto gira sobre sí mismo.
        const facing =
          flight.item === "plane" ? (projectile.fromLeft ? 0 : 180) : 0;

        const impactFrame = {
          transform: `translate(${centerX}px, ${centerY}px) rotate(${facing + projectile.spin}deg) scale(1)`,
          opacity: 1,
          offset: 0.75,
        };

        const endFrame = splat
          ? {
              // Se aplasta contra la carta y se desvanece ahí mismo.
              transform: `translate(${centerX}px, ${centerY}px) rotate(${facing}deg) scale(1.9, 0.55)`,
              opacity: 0,
            }
          : {
              // Cae al suelo desde el punto de impacto.
              transform: `translate(${centerX}px, ${centerY + 190}px) rotate(${facing + projectile.spin + 120}deg) scale(0.9)`,
              opacity: 0,
            };

        animations.push(
          element.animate(
            [
              {
                transform: `translate(${startX}px, ${startY}px) rotate(${facing}deg) scale(0.9)`,
                opacity: 1,
                offset: 0,
              },
              impactFrame,
              endFrame,
            ],
            {
              duration: travel + linger,
              delay: projectile.delay,
              easing: "cubic-bezier(0.25, 0.6, 0.35, 1)",
              fill: "forwards",
            },
          ),
        );
      }
    });

    const total = travel + linger + count * 90 + 120;
    const timer = setTimeout(() => onDone(flight.id), total);

    return () => {
      cancelAnimationFrame(raf);
      for (const animation of animations) animation.cancel();
      clearTimeout(timer);
    };
  }, [flight, onDone]);

  return (
    <>
      {projectiles.map((projectile) => (
        <span
          key={projectile.key}
          id={`flight-${flight.id}-${projectile.key}`}
          className="flight"
          aria-hidden="true"
        >
          {THROWABLE_EMOJI[flight.item]}
        </span>
      ))}
    </>
  );
}
