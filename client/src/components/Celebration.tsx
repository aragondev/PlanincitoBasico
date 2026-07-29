import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
};

/** Oro, rojo de naipe y verde de tapete: la gama de la mesa. */
const COLORS = ["#e8c56a", "#d4a63c", "#c8102e", "#5acd98", "#f7f4ec", "#a8801c"];
const GRAVITY = 0.045;
const DRAG = 0.988;
const DURATION_MS = 4200;

/** Cohete que sube y estalla en una esfera de chispas. */
function burst(particles: Particle[], x: number, y: number, scale: number): void {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)]!;
  const count = 46 + Math.floor(Math.random() * 22);
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
    const speed = (1.6 + Math.random() * 2.6) * scale;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      // Una de cada cinco chispas es blanca para que el estallido no sea plano.
      color: Math.random() < 0.2 ? "#ffffff" : color,
      size: 1.6 + Math.random() * 2.2,
    });
  }
}

/**
 * Festejo de fin de año cuando el equipo coincide en la estimación.
 * Se dibuja en un canvas a pantalla completa que no intercepta clics y se
 * desmonta solo al terminar.
 */
export function Celebration({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    // Respetamos a quien pidió menos movimiento: sin animación, sólo el aviso.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const timer = setTimeout(() => doneRef.current(), 2500);
      return () => clearTimeout(timer);
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = [];
    const width = () => canvas.width / dpr;
    const height = () => canvas.height / dpr;
    const scale = Math.min(width(), height()) < 500 ? 0.75 : 1;

    let raf = 0;
    let launches = 0;
    const started = performance.now();

    // Los primeros cohetes salen escalonados para que parezca una tanda.
    const launch = () => {
      burst(
        particles,
        width() * (0.15 + Math.random() * 0.7),
        height() * (0.18 + Math.random() * 0.3),
        scale,
      );
      launches += 1;
      if (launches < 7) {
        timers.push(setTimeout(launch, 260 + Math.random() * 320));
      }
    };
    const timers: ReturnType<typeof setTimeout>[] = [];
    launch();

    const frame = (now: number) => {
      const elapsed = now - started;
      context.clearRect(0, 0, width(), height());

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i]!;
        p.vx *= DRAG;
        p.vy = p.vy * DRAG + GRAVITY;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.008;

        if (p.life <= 0 || p.y > height() + 40) {
          particles.splice(i, 1);
          continue;
        }

        context.globalAlpha = Math.max(0, p.life);
        context.fillStyle = p.color;
        context.beginPath();
        context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;

      if (elapsed < DURATION_MS || particles.length > 0) {
        raf = requestAnimationFrame(frame);
      } else {
        doneRef.current();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      for (const timer of timers) clearTimeout(timer);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Sólo los cohetes: el texto lo muestra la mesa, donde no solapa nada.
  return <canvas ref={canvasRef} className="celebration" aria-hidden="true" />;
}
