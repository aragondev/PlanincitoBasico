import { useEffect, useState } from "react";
import type { Throwable } from "@planincito/shared";
import { ThrowableIcon } from "./SeatMenu";

export type Flight = {
  id: number;
  fromId: string;
  toId: string;
  item: Throwable;
  fromAlias: string;
};

/** Cuántos proyectiles salen por lanzamiento: una andanada, no uno solo. */
const VOLLEY: Record<Throwable, number> = {
  plane: 3,
  arrow: 3,
  paper: 4,
  tomato: 3,
  rock: 2,
};

/** Vuelo hasta la carta, cola posterior y separación entre proyectiles (ms). */
const TRAVEL = 520;
const TRAVEL_REDUCED = 240;
const AFTER = 620;
const STAGGER = 95;
const SHARD_MS = 560;
const RING_MS = 420;
/** La mancha del tomate se queda un rato más que el resto de la escena. */
const MARK_MS = 1900;
/** Media carta: el objeto cae hasta sus pies, no hasta el suelo de la sala. */
const CARD_FOOT = 34;

/** Cómo acaba cada objeto al tocar la carta. */
type Landing = "splat" | "stick" | "crumple" | "bounce";

const LANDING: Record<Throwable, Landing> = {
  tomato: "splat",
  arrow: "stick",
  plane: "crumple",
  paper: "bounce",
  rock: "bounce",
};

/**
 * Lo que salta en cada golpe. Sin esto el impacto se veía plano: el objeto
 * llegaba, se encogía y ya. Los fragmentos, la onda y el temblor de la carta
 * son los que hacen que se note el porrazo.
 */
type Impact = {
  /** Colores de los fragmentos; se reparten en orden para que haya mezcla. */
  colors: string[];
  shards: number;
  /** Rango de tamaño de los fragmentos, en píxeles. */
  size: [number, number];
  /** Cuánto se alejan del punto de impacto. */
  spread: number;
  /** Gotas redondas o astillas alargadas. */
  round: boolean;
  /** Amplitud del temblor de la carta, en píxeles. */
  shake: number;
  ring: string;
};

const IMPACT: Record<Throwable, Impact> = {
  plane: {
    colors: ["#ffffff", "#e6e6ec", "#c8c8d2"],
    shards: 5,
    size: [3, 6],
    spread: 34,
    round: false,
    shake: 3,
    ring: "rgb(255 255 255 / 50%)",
  },
  arrow: {
    colors: ["#8a6a4a", "#a8845f", "#e2585f", "#c9ced6"],
    shards: 6,
    size: [2, 5],
    spread: 40,
    round: false,
    shake: 5,
    ring: "rgb(226 88 95 / 55%)",
  },
  paper: {
    colors: ["#ffffff", "#eceff4", "#cfd3dc"],
    shards: 8,
    size: [3, 7],
    spread: 46,
    round: false,
    shake: 4,
    ring: "rgb(255 255 255 / 45%)",
  },
  tomato: {
    colors: ["#d8332c", "#ff5f52", "#a8221d", "#f5e6a8"],
    shards: 11,
    size: [3, 8],
    spread: 54,
    round: true,
    shake: 7,
    ring: "rgb(216 51 44 / 60%)",
  },
  rock: {
    colors: ["#8e8e97", "#6b6b73", "#b6b6bd", "#4c4c53"],
    shards: 10,
    size: [3, 7],
    spread: 60,
    round: false,
    shake: 10,
    ring: "rgb(140 140 150 / 65%)",
  },
};

type Projectile = {
  key: number;
  /** Desde qué lado entra y a qué altura sale, para que no lleguen en fila. */
  fromLeft: boolean;
  offsetY: number;
  delay: number;
  spin: number;
};

type Shard = {
  key: string;
  color: string;
  size: number;
  round: boolean;
  /** Grados, con el eje Y hacia abajo: negativos salen hacia arriba. */
  angle: number;
  distance: number;
  spin: number;
  delay: number;
};

type Ring = { key: number; color: string; delay: number };

type Mark = { key: number; delay: number; dx: number; dy: number; rotate: number };

/** Escena completa: se monta de una vez y luego se anima nodo a nodo. */
type Scene = {
  projectiles: Projectile[];
  shards: Shard[];
  rings: Ring[];
  marks: Mark[];
};

const EMPTY: Scene = { projectiles: [], shards: [], rings: [], marks: [] };

const between = (min: number, max: number): number =>
  min + Math.random() * (max - min);

function seatNode(participantId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-seat="${CSS.escape(participantId)}"]`,
  );
}

/**
 * Andanada de objetos que entra desde los laterales, describe un arco y se
 * estrella contra la carta del destinatario: la carta acusa el golpe, salta
 * una onda y saltan fragmentos según lo que fuera. Es decorativo: no bloquea
 * la interfaz ni altera el estado de la sala.
 */
export function ThrowFlight({
  flight,
  onDone,
}: {
  flight: Flight;
  onDone: (id: number) => void;
}) {
  const [scene, setScene] = useState<Scene>(EMPTY);

  useEffect(() => {
    const seat = seatNode(flight.toId);
    if (!seat) {
      onDone(flight.id);
      return undefined;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = reduced ? 1 : VOLLEY[flight.item];
    const landing = LANDING[flight.item];
    const impact = IMPACT[flight.item];
    const travel = reduced ? TRAVEL_REDUCED : TRAVEL;
    const stagger = reduced ? 0 : STAGGER;
    const total = travel + AFTER;
    // Momento del choque dentro de la animación del proyectil.
    const hit = travel / total;

    const projectiles: Projectile[] = Array.from({ length: count }, (_, index) => ({
      key: index,
      fromLeft: index % 2 === 0,
      // Escalonados en altura para que la andanada no parezca una sola línea.
      offsetY: (index - (count - 1) / 2) * 22,
      delay: index * stagger,
      spin:
        flight.item === "plane" || flight.item === "arrow"
          ? 0
          : (index % 2 === 0 ? 1 : -1) * 540,
    }));

    // Los restos de cada golpe salen hacia arriba y hacia el lado por el que
    // vino el objeto: es de donde viene la fuerza.
    const shards: Shard[] = reduced
      ? []
      : projectiles.flatMap((projectile) =>
          Array.from({ length: impact.shards }, (_, index): Shard => {
            const back = projectile.fromLeft ? 1 : -1;
            return {
              key: `${projectile.key}-${index}`,
              color: impact.colors[index % impact.colors.length]!,
              size: between(impact.size[0], impact.size[1]),
              round: impact.round,
              angle: -90 + back * between(5, 95),
              distance: impact.spread * between(0.5, 1.15),
              spin: between(-360, 360),
              delay: projectile.delay + travel,
            };
          }),
        );

    const rings: Ring[] = reduced
      ? []
      : projectiles.map((projectile) => ({
          key: projectile.key,
          color: impact.ring,
          delay: projectile.delay + travel,
        }));

    // Sólo el tomate deja rastro: una mancha que tarda en irse.
    const marks: Mark[] =
      landing === "splat" && !reduced
        ? projectiles.map((projectile) => ({
            key: projectile.key,
            delay: projectile.delay + travel,
            dx: between(-9, 9),
            dy: between(-7, 7),
            rotate: between(0, 180),
          }))
        : [];

    setScene({ projectiles, shards, rings, marks });

    const animations: Animation[] = [];
    const raf = requestAnimationFrame(() => {
      const box = seat.getBoundingClientRect();
      const centerX = box.left + box.width / 2;
      const centerY = box.top + box.height / 2;
      // Techo de la trayectoria: la mesa. Sin esto, los asientos de la fila
      // de arriba recibían la andanada por encima del encabezado, y lo que
      // se veía era un desfile de objetos cruzando la esquina de la pantalla.
      const stage = document.querySelector(".room__stage");
      const ceiling = (stage?.getBoundingClientRect().top ?? 0) + 6;

      const animate = (id: string, frames: Keyframe[], options: KeyframeAnimationOptions) => {
        const element = document.getElementById(id);
        if (element) animations.push(element.animate(frames, options));
      };

      for (const projectile of projectiles) {
        const startX = projectile.fromLeft ? -60 : window.innerWidth + 60;
        const startY = Math.max(centerY + projectile.offsetY - 90, ceiling);
        // Aviones y flechas apuntan hacia donde vuelan; el resto gira solo.
        const aimed = flight.item === "plane" || flight.item === "arrow";
        const facing = aimed ? (projectile.fromLeft ? 0 : 180) : 0;
        const back = projectile.fromLeft ? 1 : -1;
        // Cima del arco: a mitad de camino y por encima de la línea recta.
        const apexX = (startX + centerX) / 2;
        const apexY = Math.max((startY + centerY) / 2 - 70, ceiling);

        const frames: Keyframe[] = [
          {
            transform: `translate(${startX}px, ${startY}px) rotate(${facing}deg) scale(0.7)`,
            opacity: 1,
            offset: 0,
            easing: "cubic-bezier(0.3, 0.05, 0.6, 0.9)",
          },
          {
            transform: `translate(${apexX}px, ${apexY}px) rotate(${facing + projectile.spin * 0.45}deg) scale(0.95)`,
            opacity: 1,
            offset: hit * 0.55,
            // Acelera en el último tramo: así el golpe llega con inercia.
            easing: "cubic-bezier(0.55, 0, 0.9, 0.6)",
          },
          {
            transform: `translate(${centerX}px, ${centerY}px) rotate(${facing + projectile.spin}deg) scale(1.12)`,
            opacity: 1,
            offset: hit,
          },
        ];

        if (landing === "splat") {
          // Se revienta contra la carta: se aplasta y se desvanece ahí mismo.
          frames.push(
            {
              transform: `translate(${centerX}px, ${centerY}px) rotate(${facing}deg) scale(1.85, 0.5)`,
              opacity: 1,
              offset: hit + 0.05,
            },
            {
              transform: `translate(${centerX}px, ${centerY + 4}px) rotate(${facing}deg) scale(2.2, 0.35)`,
              opacity: 0,
              offset: hit + 0.28,
            },
            {
              transform: `translate(${centerX}px, ${centerY + 4}px) rotate(${facing}deg) scale(2.2, 0.35)`,
              opacity: 0,
              offset: 1,
            },
          );
        } else if (landing === "stick") {
          // Se clava, penetra un poco y se queda vibrando antes de esfumarse.
          const stuckX = centerX + back * 7;
          frames.push(
            {
              transform: `translate(${stuckX}px, ${centerY}px) rotate(${facing}deg) scale(1)`,
              opacity: 1,
              offset: hit + 0.04,
            },
            {
              transform: `translate(${stuckX}px, ${centerY}px) rotate(${facing - 7}deg) scale(1)`,
              opacity: 1,
              offset: hit + 0.11,
            },
            {
              transform: `translate(${stuckX}px, ${centerY}px) rotate(${facing + 4}deg) scale(1)`,
              opacity: 1,
              offset: hit + 0.18,
            },
            {
              transform: `translate(${stuckX}px, ${centerY}px) rotate(${facing}deg) scale(1)`,
              opacity: 1,
              offset: hit + 0.3,
            },
            {
              transform: `translate(${stuckX}px, ${centerY + 6}px) rotate(${facing}deg) scale(1)`,
              opacity: 0,
              offset: 1,
            },
          );
        } else if (landing === "crumple") {
          // El avión se arruga contra la carta y cae hecho una bola.
          frames.push(
            {
              transform: `translate(${centerX}px, ${centerY}px) rotate(${facing + back * 30}deg) scale(0.5, 0.85)`,
              opacity: 1,
              offset: hit + 0.06,
            },
            {
              transform: `translate(${centerX + back * 10}px, ${centerY + CARD_FOOT}px) rotate(${facing + back * 100}deg) scale(0.55)`,
              opacity: 0,
              offset: 1,
              easing: "cubic-bezier(0.4, 0, 1, 1)",
            },
          );
        } else {
          // Rebota hacia atrás y queda a los pies de la carta, no cae media
          // pantalla: el suelo de la mesa está justo debajo.
          frames.push(
            {
              transform: `translate(${centerX + back * 16}px, ${centerY - 18}px) rotate(${facing + projectile.spin + 40}deg) scale(0.95)`,
              opacity: 1,
              offset: hit + 0.14,
              easing: "cubic-bezier(0.4, 0, 1, 1)",
            },
            {
              transform: `translate(${centerX + back * 24}px, ${centerY + CARD_FOOT}px) rotate(${facing + projectile.spin + 120}deg) scale(0.8)`,
              opacity: 0,
              offset: 1,
            },
          );
        }

        animate(`flight-${flight.id}-${projectile.key}`, frames, {
          duration: total,
          delay: projectile.delay,
          // `both` es lo que evita el destello en la esquina: sin él, el nodo
          // esperaba su turno visible en el origen de la pantalla.
          fill: "both",
        });
      }

      for (const shard of shards) {
        const radians = (shard.angle * Math.PI) / 180;
        const outX = Math.cos(radians) * shard.distance;
        const outY = Math.sin(radians) * shard.distance;
        const fall = shard.distance * 0.9;
        animate(
          `shard-${flight.id}-${shard.key}`,
          [
            {
              transform: `translate(${centerX}px, ${centerY}px) scale(0.4)`,
              opacity: 1,
              offset: 0,
              easing: "cubic-bezier(0.15, 0.7, 0.4, 1)",
            },
            {
              transform: `translate(${centerX + outX * 0.72}px, ${centerY + outY * 0.72}px) rotate(${shard.spin * 0.5}deg) scale(1)`,
              opacity: 1,
              offset: 0.4,
              easing: "cubic-bezier(0.45, 0, 0.9, 1)",
            },
            {
              transform: `translate(${centerX + outX * 1.1}px, ${centerY + outY + fall}px) rotate(${shard.spin}deg) scale(0.65)`,
              opacity: 0,
              offset: 1,
            },
          ],
          { duration: SHARD_MS, delay: shard.delay, fill: "both" },
        );
      }

      for (const ring of rings) {
        animate(
          `ring-${flight.id}-${ring.key}`,
          [
            {
              transform: `translate(${centerX}px, ${centerY}px) scale(0.2)`,
              opacity: 0.75,
              offset: 0,
            },
            {
              transform: `translate(${centerX}px, ${centerY}px) scale(1.15)`,
              opacity: 0,
              offset: 1,
            },
          ],
          { duration: RING_MS, delay: ring.delay, fill: "both", easing: "ease-out" },
        );
      }

      for (const mark of marks) {
        const x = centerX + mark.dx;
        const y = centerY + mark.dy;
        animate(
          `mark-${flight.id}-${mark.key}`,
          [
            {
              transform: `translate(${x}px, ${y}px) rotate(${mark.rotate}deg) scale(0.2)`,
              opacity: 0,
              offset: 0,
            },
            {
              transform: `translate(${x}px, ${y}px) rotate(${mark.rotate}deg) scale(1.15)`,
              opacity: 0.95,
              offset: 0.05,
            },
            {
              transform: `translate(${x}px, ${y}px) rotate(${mark.rotate}deg) scale(1)`,
              opacity: 0.9,
              offset: 0.12,
            },
            {
              transform: `translate(${x}px, ${y + 3}px) rotate(${mark.rotate}deg) scale(1)`,
              opacity: 0,
              offset: 1,
            },
          ],
          { duration: MARK_MS, delay: mark.delay, fill: "both" },
        );
      }

      // El temblor de la carta: cada golpe le mete un tirón que se apaga solo.
      if (!reduced) {
        const hits = projectiles.map((projectile) => ({
          at: projectile.delay + travel,
          dir: projectile.fromLeft ? 1 : -1,
        }));
        const first = hits[0]!.at;
        const window_ = hits[hits.length - 1]!.at - first + 340;
        const frames: Keyframe[] = [];
        for (let time = 0; time <= window_; time += 24) {
          let dx = 0;
          let dy = 0;
          for (const shock of hits) {
            const since = first + time - shock.at;
            if (since < 0 || since > 300) continue;
            const decay = (1 - since / 300) ** 2;
            const wave = Math.cos((since / 300) * Math.PI * 3);
            dx += wave * impact.shake * decay * shock.dir;
            dy -= Math.abs(wave) * impact.shake * 0.35 * decay;
          }
          frames.push({
            transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${(dx * 0.4).toFixed(2)}deg)`,
            filter: `brightness(${(1 + (Math.abs(dx) / impact.shake) * 0.22).toFixed(3)})`,
            offset: time / window_,
          });
        }
        frames.push({
          transform: "translate(0px, 0px) rotate(0deg)",
          filter: "brightness(1)",
          offset: 1,
        });
        animations.push(
          seat.animate(frames, { duration: window_, delay: first, fill: "none" }),
        );
      }
    });

    const last = (count - 1) * stagger;
    const lifetime =
      last + travel + Math.max(AFTER, marks.length > 0 ? MARK_MS : 0) + 120;
    const timer = setTimeout(() => onDone(flight.id), lifetime);

    return () => {
      cancelAnimationFrame(raf);
      for (const animation of animations) animation.cancel();
      clearTimeout(timer);
    };
  }, [flight, onDone]);

  return (
    <>
      {scene.projectiles.map((projectile) => (
        <span
          key={projectile.key}
          id={`flight-${flight.id}-${projectile.key}`}
          className="flight"
          aria-hidden="true"
        >
          <ThrowableIcon item={flight.item} className="flight__glyph" />
        </span>
      ))}
      {scene.shards.map((shard) => (
        <span
          key={shard.key}
          id={`shard-${flight.id}-${shard.key}`}
          className={`shard${shard.round ? " shard--drop" : ""}`}
          style={{
            background: shard.color,
            inlineSize: `${shard.size.toFixed(1)}px`,
            blockSize: `${(shard.round ? shard.size : shard.size * 0.55).toFixed(1)}px`,
          }}
          aria-hidden="true"
        />
      ))}
      {scene.rings.map((ring) => (
        <span
          key={ring.key}
          id={`ring-${flight.id}-${ring.key}`}
          className="shockwave"
          style={{ color: ring.color }}
          aria-hidden="true"
        />
      ))}
      {scene.marks.map((mark) => (
        <span
          key={mark.key}
          id={`mark-${flight.id}-${mark.key}`}
          className="splat"
          aria-hidden="true"
        />
      ))}
    </>
  );
}
