import { useEffect, useRef } from "react";

/**
 * A one-shot confetti burst for a win.
 *
 * Hand-rolled on a canvas rather than pulled from a library: the whole payload
 * is a few hundred bytes, there is no CDN to be blocked by a host's CSP, and it
 * can be tuned to the theme. Particles are drawn as thin rotating rectangles so
 * they read as foil strips rather than dots.
 *
 * Silent for anyone who asked for reduced motion, and it removes itself once
 * the last piece falls, so nothing keeps animating behind the reveal card.
 */

const COLOURS = ["#e50914", "#ff5a63", "#ffffff", "#e8b923", "#46d369"];

type Piece = {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  tilt: number;
  spin: number;
  colour: string;
};

export default function Confetti({ reduceMotion = false }: { reduceMotion?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reduceMotion) return;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Two side cannons plus a light shower, so the burst reads across the whole
    // card instead of pluming from a single point.
    const pieces: Piece[] = [];
    const push = (x: number, y: number, vx: number, vy: number) =>
      pieces.push({
        x, y, vx, vy,
        size: 5 + Math.random() * 6,
        tilt: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        colour: COLOURS[(Math.random() * COLOURS.length) | 0],
      });

    for (let i = 0; i < 55; i++) {
      push(0, h * 0.35, 3 + Math.random() * 6, -7 + Math.random() * 5);
      push(w, h * 0.35, -(3 + Math.random() * 6), -7 + Math.random() * 5);
    }
    for (let i = 0; i < 40; i++) {
      push(Math.random() * w, -20 - Math.random() * 60, (Math.random() - 0.5) * 2, 1 + Math.random() * 2);
    }

    let raf = 0;
    let alive = true;
    const GRAVITY = 0.16;
    const DRAG = 0.992;

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      let onScreen = 0;

      for (const p of pieces) {
        p.vy += GRAVITY;
        p.vx *= DRAG;
        p.x += p.vx;
        p.y += p.vy;
        p.tilt += p.spin;

        if (p.y < h + 40) onScreen++;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.tilt);
        ctx.fillStyle = p.colour;
        // Squashing the height by the tilt fakes the foil catching the light.
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.45 * Math.abs(Math.cos(p.tilt)) + 1);
        ctx.restore();
      }

      if (onScreen === 0) {
        alive = false;
        ctx.clearRect(0, 0, w, h);
        return;
      }
      if (alive) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reduceMotion]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      // A canvas is a replaced element: inset-0 alone leaves it at its
      // intrinsic 300x150, so the size has to be stated.
      className="pointer-events-none fixed inset-0 z-[60] size-full"
    />
  );
}
