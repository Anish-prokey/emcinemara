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
 *
 * `intensity` scales the burst with the quality of the win, so a first-guess
 * solve is visibly a bigger event than a tenth-guess scrape.
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

export default function Confetti({
  reduceMotion = false,
  intensity = 1,
}: {
  reduceMotion?: boolean;
  /** 0-1. Scales piece count and launch power. */
  intensity?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  const silent =
    reduceMotion ||
    (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (silent) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      // Sized in pixels from clientWidth/clientHeight, which exclude a
      // classic scrollbar, rather than from a CSS 100%. Belt and braces: a
      // percentage on a fixed element is measured against the initial
      // containing block, and if anything else on the page ever overflows
      // horizontally that block can grow with it, dragging the burst wider
      // than the window.
      w = document.documentElement.clientWidth;
      h = document.documentElement.clientHeight;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
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

    const k = Math.max(0.3, Math.min(1, intensity));
    const power = 0.75 + k * 0.45;

    for (let i = 0; i < Math.round(55 * k); i++) {
      push(0, h * 0.35, (3 + Math.random() * 6) * power, (-7 + Math.random() * 5) * power);
      push(w, h * 0.35, -(3 + Math.random() * 6) * power, (-7 + Math.random() * 5) * power);
    }
    for (let i = 0; i < Math.round(40 * k); i++) {
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
  }, [silent, intensity]);

  // Nothing in the DOM at all when motion is off, rather than an invisible
  // full-screen element sitting over the board.
  if (silent) return null;

  return (
    <canvas
      ref={ref}
      aria-hidden
      // Width and height come from the effect above, in pixels. A canvas is a
      // replaced element, so without an explicit size inset-0 would leave it at
      // its intrinsic 300x150.
      className="pointer-events-none fixed top-0 left-0 z-[60]"
    />
  );
}
