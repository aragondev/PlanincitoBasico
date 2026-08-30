import { useEffect, useRef } from "react";
import type * as MatterTypes from "matter-js";
import type { Throwable } from "@planincito/shared";

/** El motor sólo se carga cuando hace falta; aquí sólo viajan sus tipos. */
type Matter = typeof MatterTypes;
type Body = MatterTypes.Body;

export type Flight = {
  id: number;
  fromId: string;
  toId: string;
  item: Throwable;
  fromAlias: string;
};

/** Cómo acaba cada objeto al tocar la carta. */
type Landing = "splat" | "stick" | "crumple" | "bounce";

/**
 * Ficha física de cada objeto. Los valores son los que hacen que una piedra
 * caiga como una piedra y un avión de papel planee: masa, rebote y rozamiento
 * con el aire son lo que separa unos de otros, no la animación.
 */
type Profile = {
  /** Radio del cuerpo, en píxeles. El dibujo mide el doble. */
  radius: number;
  shape: "circle" | "box";
  density: number;
  restitution: number;
  friction: number;
  /** Rozamiento con el aire una vez ha impactado; en vuelo es cero. */
  air: number;
  /** Giro inicial, en radianes por paso. */
  spin: number;
  /** Apunta a donde vuela, en vez de girar sobre sí mismo. */
  aimed: boolean;
  landing: Landing;
  /** Cuántos salen por lanzamiento: una andanada, no uno solo. */
  volley: number;
  /** Fragmentos que saltan en cada golpe. */
  shards: number;
  shardColors: string[];
  /** Gotas redondas o astillas alargadas. */
  shardRound: boolean;
  shake: number;
  ring: string;
};

const PROFILES: Record<Throwable, Profile> = {
  plane: {
    radius: 11,
    shape: "box",
    density: 0.0004,
    restitution: 0.12,
    friction: 0.7,
    air: 0.055,
    spin: 0,
    aimed: true,
    landing: "crumple",
    volley: 3,
    shards: 4,
    shardColors: ["#ffffff", "#e6e6ec", "#c8c8d2"],
    shardRound: false,
    shake: 3,
    ring: "rgb(255 255 255 / 50%)",
  },
  arrow: {
    radius: 12,
    shape: "box",
    density: 0.0022,
    restitution: 0.05,
    friction: 0.9,
    air: 0.004,
    spin: 0,
    aimed: true,
    landing: "stick",
    volley: 3,
    shards: 5,
    shardColors: ["#8a6a4a", "#a8845f", "#e2585f", "#c9ced6"],
    shardRound: false,
    shake: 6,
    ring: "rgb(226 88 95 / 55%)",
  },
  paper: {
    radius: 8,
    shape: "circle",
    density: 0.0007,
    restitution: 0.3,
    friction: 0.6,
    air: 0.045,
    spin: 0.16,
    aimed: false,
    landing: "bounce",
    volley: 4,
    shards: 7,
    shardColors: ["#ffffff", "#eceff4", "#cfd3dc"],
    shardRound: false,
    shake: 4,
    ring: "rgb(255 255 255 / 45%)",
  },
  tomato: {
    radius: 8.5,
    shape: "circle",
    density: 0.0018,
    restitution: 0.04,
    friction: 0.8,
    air: 0.008,
    spin: 0.12,
    aimed: false,
    landing: "splat",
    volley: 3,
    shards: 12,
    shardColors: ["#d8332c", "#ff5f52", "#a8221d", "#f5e6a8"],
    shardRound: true,
    shake: 8,
    ring: "rgb(216 51 44 / 60%)",
  },
  rock: {
    radius: 9,
    shape: "circle",
    density: 0.006,
    restitution: 0.1,
    friction: 0.9,
    air: 0.012,
    spin: 0.2,
    aimed: false,
    landing: "bounce",
    volley: 2,
    shards: 10,
    shardColors: ["#8e8e97", "#6b6b73", "#b6b6bd", "#4c4c53"],
    shardRound: false,
    shake: 12,
    ring: "rgb(140 140 150 / 65%)",
  },
};

const GLYPH: Partial<Record<Throwable, string>> = {
  paper: "🧻",
  tomato: "🍅",
  rock: "🪨",
};

/** Los mismos trazos del icono del menú, para dibujarlos en el lienzo. */
const VECTORS: Partial<Record<Throwable, [string, string][]>> = {
  // Morro a la derecha y eje horizontal: en vuelo el ángulo lo pone la
  // velocidad, y con la pose inclinada del icono el avión volaba de lado.
  plane: [
    ["M1 4.5 23 12 6 12Z", "#ffffff"],
    ["M1 19.5 23 12 6 12Z", "#c8c8d2"],
    ["M6 12 23 12 6 13.2Z", "#9a9aa6"],
  ],
  arrow: [
    ["M3 11.2h14v1.6H3z", "#8a6a4a"],
    ["M16 8.5 23 12l-7 3.5V8.5Z", "#c9ced6"],
    ["M3 8.6 7 12l-4 3.4-1.6-.9L4 12 1.4 9.5 3 8.6Z", "#e2585f"],
  ],
};

/** Bola de papel: el avión después de estamparse contra la carta. */
const CRUMPLE = [
  [1, 0.62],
  [0.72, 0.9],
  [0.34, 0.66],
  [0.55, 1],
  [0.3, 0.78],
  [0.86, 0.7],
  [0.62, 0.95],
  [0.4, 0.72],
  [0.95, 0.84],
];

function drawCrumple(context: CanvasRenderingContext2D, size: number): void {
  const radius = size / 2;
  context.fillStyle = "#f4f4f7";
  context.beginPath();
  CRUMPLE.forEach(([scale, tilt], index) => {
    const angle = (Math.PI * 2 * index) / CRUMPLE.length;
    const x = Math.cos(angle) * radius * scale!;
    const y = Math.sin(angle) * radius * tilt!;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.fill();
  // Un par de pliegues, para que no sea una mancha blanca.
  context.strokeStyle = "#c8c8d2";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(-radius * 0.6, -radius * 0.1);
  context.lineTo(radius * 0.2, radius * 0.35);
  context.moveTo(-radius * 0.1, -radius * 0.65);
  context.lineTo(radius * 0.45, -radius * 0.05);
  context.stroke();
}

const PATHS = new Map<string, Path2D>();
function pathFor(d: string): Path2D {
  let path = PATHS.get(d);
  if (!path) {
    path = new Path2D(d);
    PATHS.set(d, path);
  }
  return path;
}

const STEP = 1000 / 60;
/** Aceleración de la gravedad del motor, en píxeles por paso al cuadrado. */
const GRAVITY = 0.001 * STEP * STEP;
/** Límites del vuelo, en pasos del motor: ni un tiro instantáneo ni un globo. */
const MIN_STEPS = 18;
const MAX_STEPS = 60;
/** Cuánto por debajo de la carta arranca el tiro: la altura de la mesa. */
const LOFT = 150;
const STAGGER = 95;
/** Cuánto aguanta cada resto antes de empezar a desvanecerse. */
const PROJECTILE_TTL = 1500;
const SHARD_TTL = 700;
const FADE = 480;
/** Media carta: el suelo está a los pies del asiento, no al fondo de la sala. */
const CARD_FOOT = 50;
/**
 * Ancho del cuerpo con el que choca el objeto. La carta se ve de canto, así
 * que un muro de su ancho real paraba el objeto en la esquina, medio fuera.
 * Con un núcleo estrecho el objeto entra hasta quedar **sobre** la carta, que
 * es lo que se espera de un tiro dirigido a ella.
 */
const CARD_CORE = 10;
/** Red de seguridad: ningún lanzamiento vive más que esto. */
const MAX_LIFE = 5200;

type Sprite = {
  body: Body;
  flightId: number;
  kind: "projectile" | "shard";
  item: Throwable;
  /** Sólo los fragmentos: color y forma con la que se pintan. */
  color?: string;
  round?: boolean;
  size: number;
  bornAt: number;
  ttl: number;
  aimed: boolean;
  /** Vuela hacia la izquierda: hay que reflejarlo, no ponerlo boca abajo. */
  mirrored: boolean;
  /** El avión se arruga al chocar: encoge y deja de planear. */
  crumpled: number;
  hit: boolean;
};

/** Un proyectil pendiente de salir, con todo lo que hace falta para el tiro. */
type Shot = {
  at: number;
  flightId: number;
  item: Throwable;
  fromLeft: boolean;
  filter: { category: number; mask: number; group: number };
  cx: number;
  /** Altura a la que se apunta dentro de la carta. */
  aimY: number;
  ceiling: number;
  /** Suelo del tiro: por debajo está el mazo, y ahí no vuela nada. */
  ground: number;
  /** Cada proyectil de la andanada sale desde un poco más abajo. */
  lift: number;
};

type Ring = { x: number; y: number; color: string; bornAt: number };
type Stain = {
  flightId: number;
  x: number;
  y: number;
  radius: number;
  angle: number;
  bornAt: number;
  blobs: { dx: number; dy: number; r: number }[];
};

const between = (min: number, max: number): number =>
  min + Math.random() * (max - min);

function seatNode(participantId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-seat="${CSS.escape(participantId)}"]`,
  );
}

/** Sacudida de la carta golpeada, proporcional a lo que se ha llevado. */
function jolt(seat: HTMLElement, amount: number, direction: number): void {
  const push = Math.max(2, Math.min(amount, 16));
  seat.animate(
    [
      {
        transform: `translate(${direction * push}px, ${-push * 0.3}px) rotate(${direction * push * 0.45}deg)`,
        filter: `brightness(${1 + push * 0.022})`,
      },
      {
        transform: `translate(${-direction * push * 0.55}px, ${push * 0.18}px) rotate(${-direction * push * 0.25}deg)`,
        filter: "brightness(1)",
      },
      {
        transform: `translate(${direction * push * 0.24}px, 0px) rotate(${direction * push * 0.1}deg)`,
      },
      { transform: "translate(0px, 0px) rotate(0deg)", filter: "brightness(1)" },
    ],
    { duration: 240 + push * 10, easing: "ease-out", fill: "none" },
  );
}

/**
 * Escenario de los lanzamientos: un solo lienzo a pantalla completa con un
 * motor de cuerpos rígidos (`matter-js`) detrás. Los objetos salen con la
 * velocidad justa para llegar a la carta, chocan de verdad contra ella —que
 * es un cuerpo estático— y luego caen, ruedan y se apilan a sus pies. Es
 * decorativo: no intercepta clics ni toca el estado de la sala.
 */
export function ThrowStage({
  flights,
  onDone,
}: {
  flights: Flight[];
  onDone: (id: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const launchRef = useRef<((flight: Flight) => void) | null>(null);
  const pending = useRef<Flight[]>([]);
  const consumed = useRef(new Set<number>());
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let raf = 0;
    let cleanupMatter: (() => void) | null = null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // El motor se carga aparte: no tiene por qué pesar en el arranque de la
    // sala, que es lo que se mira mientras se espera a que entre la gente.
    void import("matter-js").then((module) => {
      if (disposed) return;
      const M = ((module as { default?: Matter }).default ?? module) as Matter;

      const engine = M.Engine.create();
      engine.gravity.y = 1;

      /**
       * Reloj único de la escena: el del fotograma. Los choques ocurren dentro
       * del paso del motor, y sellarlos con `performance.now()` los dejaba en
       * el futuro respecto al dibujo, con edades negativas por medio.
       */
      let clock = performance.now();
      /** Proyectiles que aún no han salido: la andanada va escalonada. */
      const queue: Shot[] = [];
      const sprites: Sprite[] = [];
      const rings: Ring[] = [];
      const stains: Stain[] = [];
      /** Cuerpos estáticos de cada lanzamiento: la carta y su suelo. */
      const scenery = new Map<number, Body[]>();
      const live = new Map<number, number>();
      const deadline = new Map<number, number>();
      let categorySeq = 0;

      const finish = (flightId: number) => {
        if (!live.has(flightId)) return;
        live.delete(flightId);
        for (let index = queue.length - 1; index >= 0; index -= 1) {
          if (queue[index]!.flightId === flightId) queue.splice(index, 1);
        }
        deadline.delete(flightId);
        for (const body of scenery.get(flightId) ?? []) {
          M.Composite.remove(engine.world, body);
        }
        scenery.delete(flightId);
        doneRef.current(flightId);
      };

      const drop = (index: number) => {
        const sprite = sprites[index]!;
        M.Composite.remove(engine.world, sprite.body);
        sprites.splice(index, 1);
        const rest = (live.get(sprite.flightId) ?? 1) - 1;
        if (rest <= 0) finish(sprite.flightId);
        else live.set(sprite.flightId, rest);
      };

      const shatter = (sprite: Sprite, x: number, y: number, away: number) => {
        const profile = PROFILES[sprite.item];
        const count = reduced ? 0 : profile.shards;
        for (let index = 0; index < count; index += 1) {
          const size = between(2, profile.shardRound ? 5 : 4.5);
          const body = profile.shardRound
            ? M.Bodies.circle(x, y, size / 2, {})
            : M.Bodies.rectangle(x, y, size, size * 0.6, {});
          M.Body.set(body, {
            density: 0.0009,
            restitution: 0.4,
            friction: 0.4,
            frictionAir: 0.014,
            collisionFilter: sprite.body.collisionFilter,
          });
          // Salen hacia arriba y hacia el lado por el que vino el golpe: de
          // ahí es de donde viene la fuerza.
          const angle = -Math.PI / 2 + away * between(0.1, 1.5);
          const speed = between(2.5, 8);
          M.Body.setVelocity(body, {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed,
          });
          M.Body.setAngularVelocity(body, between(-0.5, 0.5));
          M.Composite.add(engine.world, body);
          sprites.push({
            body,
            flightId: sprite.flightId,
            kind: "shard",
            item: sprite.item,
            color:
              profile.shardColors[index % profile.shardColors.length]!,
            round: profile.shardRound,
            size,
            bornAt: clock,
            ttl: SHARD_TTL,
            aimed: false,
            mirrored: false,
            crumpled: 0,
            hit: true,
          });
          live.set(sprite.flightId, (live.get(sprite.flightId) ?? 0) + 1);
        }
      };

      /** Choques del paso en curso, a resolver cuando el motor haya acabado. */
      const impacts: { sprite: Sprite; x: number; y: number; speed: number; seat: string }[] = [];

      /**
       * El proyectil llega de lado, así que toca el canto de la carta y el
       * golpe se dibujaba fuera de ella. Se lleva el punto de impacto dentro
       * de su silueta: es lo que hace que se lea como un golpe en la carta.
       */
      const onCard = (card: Body, x: number, y: number) => {
        const rect = card.plugin.rect as {
          left: number;
          right: number;
          top: number;
          bottom: number;
        };
        return {
          x: Math.min(Math.max(x, rect.left + 6), rect.right - 6),
          y: Math.min(Math.max(y, rect.top + 6), rect.bottom - 6),
        };
      };

      const onCollision = (
        event: MatterTypes.IEventCollision<MatterTypes.Engine>,
      ) => {
        for (const pair of event.pairs) {
          for (const [body, other] of [
            [pair.bodyA, pair.bodyB],
            [pair.bodyB, pair.bodyA],
          ] as const) {
            const sprite = sprites.find((item) => item.body === body);
            if (!sprite || sprite.kind !== "projectile" || sprite.hit) continue;
            // Sólo cuenta el choque contra la carta; el suelo no es un golpe.
            if (!other.isStatic || other.label !== "card") continue;

            sprite.hit = true;
            const at = onCard(other, body.position.x, body.position.y);
            impacts.push({
              sprite,
              x: at.x,
              y: at.y,
              speed: Math.hypot(body.velocity.x, body.velocity.y),
              seat: other.plugin.seat as string,
            });
          }
        }
      };

      /** Resuelve los choques apuntados: restos, mancha, sacudida y desenlace. */
      const resolveImpacts = () => {
        for (const impact of impacts.splice(0)) {
          const { sprite, x, y, speed } = impact;
          const profile = PROFILES[sprite.item];
          const away = sprite.body.velocity.x >= 0 ? -1 : 1;

          const seat = seatNode(impact.seat);
          if (seat && !reduced) {
            jolt(seat, profile.shake * Math.min(1.4, speed / 12), -away);
          }
          if (!reduced) rings.push({ x, y, color: profile.ring, bornAt: clock });
          shatter(sprite, x, y, away);

          if (profile.landing === "splat") {
            // Revienta: no queda tomate, queda la mancha.
            if (!reduced) {
              live.set(sprite.flightId, (live.get(sprite.flightId) ?? 0) + 1);
              stains.push({
                flightId: sprite.flightId,
                x,
                y,
                radius: between(8, 11),
                angle: between(0, Math.PI),
                bornAt: clock,
                blobs: Array.from({ length: 5 }, () => ({
                  dx: between(-7, 7),
                  dy: between(-5, 5),
                  r: between(2, 5),
                })),
              });
            }
            const index = sprites.indexOf(sprite);
            if (index >= 0) drop(index);
            continue;
          }

          if (profile.landing === "stick") {
            // Se clava: deja de ser un proyectil y se queda en la carta.
            M.Body.setStatic(sprite.body, true);
            sprite.ttl = 1200;
            sprite.bornAt = clock;
            continue;
          }

          if (profile.landing === "crumple") sprite.crumpled = 1;
          // A partir de aquí el aire cuenta: en vuelo estorbaba a la puntería.
          M.Body.set(sprite.body, "frictionAir", profile.air);
          // Y se le quita casi toda la carrera: una carta de pie no devuelve
          // la piedra media mesa, la para. Antes el rebote la mandaba a
          // aterrizar sobre el asiento de al lado.
          M.Body.setVelocity(sprite.body, {
            x: sprite.body.velocity.x * 0.16,
            y: Math.abs(sprite.body.velocity.y) * 0.25 + 1.2,
          });
        }
      };

      M.Events.on(engine, "collisionStart", onCollision);

      launchRef.current = (flight: Flight) => {
        const seat = seatNode(flight.toId);
        if (!seat) {
          doneRef.current(flight.id);
          return;
        }
        const profile = PROFILES[flight.item];
        const box = seat.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        // Techo de la trayectoria: la mesa. Por encima está el encabezado, y
        // ver la andanada cruzar por ahí arriba no se entendía.
        const stage = document.querySelector(".room__stage");
        const ceiling = (stage?.getBoundingClientRect().top ?? 0) + 10;
        const dock = document.querySelector(".dock");
        const ground =
          (dock?.getBoundingClientRect().top ?? window.innerHeight) - 24;

        const category = 1 << (categorySeq++ % 30);
        const filter = { category, mask: category, group: 0 };

        const card = M.Bodies.rectangle(cx, cy, CARD_CORE, box.height, {
          isStatic: true,
          label: "card",
          restitution: 0.35,
          friction: 0.6,
          collisionFilter: filter,
        });
        card.plugin = {
          seat: flight.toId,
          rect: {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
          },
        };
        const floor = M.Bodies.rectangle(
          cx,
          box.bottom + CARD_FOOT,
          Math.max(240, box.width * 5),
          14,
          {
            isStatic: true,
            label: "floor",
            restitution: 0.15,
            friction: 0.9,
            collisionFilter: filter,
          },
        );
        M.Composite.add(engine.world, [card, floor]);
        scenery.set(flight.id, [card, floor]);
        live.set(flight.id, 0);
        deadline.set(flight.id, clock + MAX_LIFE);

        const count = reduced ? 1 : profile.volley;
        for (let index = 0; index < count; index += 1) {
          // Cada proyectil se crea cuando le toca salir. Congelarlos en la
          // línea de tiro no valía: inmovilizar un cuerpo le borra la
          // velocidad, y los rezagados caían a plomo fuera de la pantalla.
          queue.push({
            at: clock + index * (reduced ? 0 : STAGGER),
            flightId: flight.id,
            item: flight.item,
            fromLeft: index % 2 === 0,
            filter,
            cx,
            // Se apunta al tercio alto de la carta: el objeto entra cayendo
            // sobre ella en vez de rozarle el canto por el medio.
            aimY: box.top + box.height * 0.32,
            ceiling,
            ground,
            lift: index * 16,
          });
          live.set(flight.id, (live.get(flight.id) ?? 0) + 1);
        }
      };

      /** Pone en el aire un proyectil que ya tocaba: aquí se calcula el tiro. */
      const fire = (shot: Shot) => {
        const profile = PROFILES[shot.item];
        const startX = shot.fromLeft ? -40 : window.innerWidth + 40;
        // Sale a la altura de la mesa y se lanza en globo, con la cima justo
        // bajo el encabezado: así llega a la carta cayendo sobre ella. Antes
        // salía por encima y entraba casi horizontal, de refilón por el canto.
        // Nunca por debajo del mazo: un tomate cruzando por encima de las
        // cartas de la mano propia no se entiende.
        const startY = Math.min(shot.aimY + LOFT + shot.lift, shot.ground);
        const apexY = shot.ceiling + 20;
        const dx = shot.cx - startX;
        const dy = shot.aimY - startY;
        // Subida hasta la cima y bajada hasta la carta: el tiempo de vuelo
        // sale de las dos mitades del arco.
        const climb = Math.sqrt((2 * Math.max(0, startY - apexY)) / GRAVITY);
        const fall = Math.sqrt((2 * Math.max(0, shot.aimY - apexY)) / GRAVITY);
        const steps = Math.round(
          Math.max(MIN_STEPS, Math.min(MAX_STEPS, climb + fall)),
        );

        const body =
          profile.shape === "circle"
            ? M.Bodies.circle(startX, startY, profile.radius, {})
            : M.Bodies.rectangle(
                startX,
                startY,
                profile.radius * 2,
                profile.radius * 0.8,
                {},
              );
        M.Body.set(body, {
          density: profile.density,
          restitution: profile.restitution,
          friction: profile.friction,
          // Sin rozamiento en vuelo: la parábola es la que se ha calculado.
          frictionAir: 0,
          collisionFilter: shot.filter,
        });
        M.Body.setVelocity(body, {
          x: dx / steps,
          y: (dy - 0.5 * GRAVITY * steps * (steps + 1)) / steps,
        });
        if (profile.spin !== 0) {
          M.Body.setAngularVelocity(body, shot.fromLeft ? profile.spin : -profile.spin);
        }
        M.Composite.add(engine.world, body);

        sprites.push({
          body,
          flightId: shot.flightId,
          kind: "projectile",
          item: shot.item,
          size: profile.radius * 2,
          bornAt: clock,
          ttl: PROJECTILE_TTL,
          aimed: profile.aimed,
          mirrored: !shot.fromLeft,
          crumpled: 0,
          hit: false,
        });
      };

      for (const flight of pending.current.splice(0)) launchRef.current(flight);

      const drawVectors = (item: Throwable, size: number) => {
        const shapes = VECTORS[item];
        if (!shapes) return;
        const scale = size / 24;
        context.save();
        context.scale(scale, scale);
        context.translate(-12, -12);
        for (const [d, color] of shapes) {
          context.fillStyle = color;
          context.fill(pathFor(d));
        }
        context.restore();
      };

      let last = performance.now();
      let accumulator = 0;

      const frame = (now: number) => {
        clock = now;
        accumulator += Math.min(now - last, 120);
        last = now;
        while (accumulator >= STEP) {
          for (let index = queue.length - 1; index >= 0; index -= 1) {
            if (now < queue[index]!.at) continue;
            fire(queue.splice(index, 1)[0]!);
          }
          // Aviones y flechas apuntan a donde vuelan; el resto gira solo.
          for (const sprite of sprites) {
            if (!sprite.aimed || sprite.hit || sprite.body.isStatic) continue;
            const { x, y } = sprite.body.velocity;
            if (x !== 0 || y !== 0) M.Body.setAngle(sprite.body, Math.atan2(y, x));
          }
          M.Engine.update(engine, STEP);
          // Fuera del paso del motor: quitar o clavar cuerpos mientras
          // resuelve sus contactos deja la simulación en un estado raro.
          resolveImpacts();
          accumulator -= STEP;
        }

        const width = window.innerWidth;
        const height = window.innerHeight;
        context.clearRect(0, 0, width, height);

        // Manchas primero: quedan debajo de todo lo demás.
        for (let index = stains.length - 1; index >= 0; index -= 1) {
          const stain = stains[index]!;
          const age = now - stain.bornAt;
          const alpha = age < 1500 ? 0.92 : Math.max(0, 0.92 - (age - 1500) / 900);
          if (alpha <= 0) {
            stains.splice(index, 1);
            const rest = (live.get(stain.flightId) ?? 1) - 1;
            if (rest <= 0) finish(stain.flightId);
            else live.set(stain.flightId, rest);
            continue;
          }
          context.save();
          context.globalAlpha = alpha;
          context.translate(stain.x, stain.y);
          context.rotate(stain.angle);
          const grow = Math.max(0, Math.min(1, age / 140));
          context.fillStyle = "#c1332b";
          context.beginPath();
          context.ellipse(0, 0, stain.radius * grow, stain.radius * 0.72 * grow, 0, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#e5473c";
          for (const blob of stain.blobs) {
            context.beginPath();
            context.arc(blob.dx * grow, blob.dy * grow, blob.r * grow, 0, Math.PI * 2);
            context.fill();
          }
          context.restore();
        }

        for (let index = rings.length - 1; index >= 0; index -= 1) {
          const ring = rings[index]!;
          const progress = (now - ring.bornAt) / 420;
          if (progress >= 1) {
            rings.splice(index, 1);
            continue;
          }
          context.save();
          context.globalAlpha = (1 - progress) * 0.8;
          context.strokeStyle = ring.color;
          context.lineWidth = 2.5 * (1 - progress) + 0.5;
          context.beginPath();
          context.arc(ring.x, ring.y, 4 + progress * 22, 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }

        for (let index = sprites.length - 1; index >= 0; index -= 1) {
          const sprite = sprites[index]!;
          const { position, angle } = sprite.body;
          if (position.y > height + 160) {
            drop(index);
            continue;
          }
          const age = now - sprite.bornAt;
          const alpha = age < sprite.ttl ? 1 : 1 - (age - sprite.ttl) / FADE;
          if (alpha <= 0) {
            drop(index);
            continue;
          }

          context.save();
          context.globalAlpha = alpha;
          context.translate(position.x, position.y);
          context.rotate(angle);

          if (sprite.kind === "shard") {
            context.fillStyle = sprite.color!;
            context.beginPath();
            if (sprite.round) {
              context.arc(0, 0, sprite.size / 2, 0, Math.PI * 2);
            } else {
              context.rect(
                -sprite.size / 2,
                -sprite.size * 0.3,
                sprite.size,
                sprite.size * 0.6,
              );
            }
            context.fill();
            context.restore();
            continue;
          }

          context.shadowColor = "rgb(0 0 0 / 35%)";
          context.shadowBlur = 4;
          context.shadowOffsetY = 2;

          // El avión que ya chocó no vuelve a ser un avión: es una bola.
          if (sprite.crumpled > 0) {
            drawCrumple(context, sprite.size * 0.75);
            context.restore();
            continue;
          }

          // Hacia la izquierda el ángulo es de 180°, y girar un avión medio
          // giro lo deja boca abajo. Lo que corresponde es reflejarlo.
          if (sprite.aimed && sprite.mirrored) context.scale(1, -1);

          const glyph = GLYPH[sprite.item];
          if (glyph) {
            const size = sprite.size * 1.15;
            context.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif`;
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(glyph, 0, 0);
          } else {
            drawVectors(sprite.item, sprite.size * 1.2);
          }
          context.restore();
        }

        // Red de seguridad: un cuerpo atascado no puede dejar el lanzamiento
        // colgado para siempre.
        for (const [flightId, limit] of [...deadline]) {
          if (now < limit) continue;
          for (let index = sprites.length - 1; index >= 0; index -= 1) {
            if (sprites[index]!.flightId === flightId) drop(index);
          }
          for (let index = stains.length - 1; index >= 0; index -= 1) {
            if (stains[index]!.flightId === flightId) stains.splice(index, 1);
          }
          finish(flightId);
        }

        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      cleanupMatter = () => {
        M.Events.off(engine, "collisionStart", onCollision);
        M.Composite.clear(engine.world, false);
        M.Engine.clear(engine);
      };
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      launchRef.current = null;
      cleanupMatter?.();
    };
  }, []);

  useEffect(() => {
    for (const flight of flights) {
      if (consumed.current.has(flight.id)) continue;
      consumed.current.add(flight.id);
      if (launchRef.current) launchRef.current(flight);
      else pending.current.push(flight);
    }
    // El registro de consumidos no puede crecer sin fin en una sesión larga.
    if (consumed.current.size > 200) {
      consumed.current = new Set(flights.map((flight) => flight.id));
    }
  }, [flights]);

  return <canvas ref={canvasRef} className="throwstage" aria-hidden="true" />;
}
