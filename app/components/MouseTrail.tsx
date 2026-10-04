"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/** A click shown as a water puddle: a solid splash and rings spreading out from it. */
export function Puddle({ x, y, color = "56,189,248", size = 1 }: { x: number; y: number; color?: string; size?: number }) {
  const reduce = useReducedMotion();
  const ring = (delay: number, scale: number) => (
    <motion.span
      className="absolute rounded-full"
      style={{ left: -20 * size, top: -20 * size, width: 40 * size, height: 40 * size, border: `3px solid rgba(${color},0.9)` }}
      initial={{ scale: 0.2, opacity: 0.95 }}
      animate={{ scale: reduce ? 1 : scale, opacity: 0 }}
      transition={{ duration: reduce ? 0.2 : 0.9, delay, ease: "easeOut" }}
    />
  );
  return (
    <span className="pointer-events-none absolute" style={{ left: x, top: y }}>
      <motion.span
        className="absolute rounded-full"
        style={{ left: -14 * size, top: -14 * size, width: 28 * size, height: 28 * size, background: `rgba(${color},0.45)` }}
        initial={{ scale: 0.3, opacity: 1 }}
        animate={{ scale: 1.1, opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {ring(0, 2.2)}
      {ring(0.15, 3)}
      {ring(0.3, 3.8)}
    </span>
  );
}

type Pt = { x: number; y: number; t: number };

/**
 * Expert mode: shows that the mouse is being followed. A fading trail behind the pointer and a puddle on every
 * click, drawn over the simulated app only. Purely visual; FakeApp records the path itself.
 */
export default function MouseTrail() {
  const self = useRef<HTMLDivElement>(null);
  const [trail, setTrail] = useState<Pt[]>([]);
  const [clicks, setClicks] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    const root = self.current?.closest("[data-guide-root]") as HTMLElement | null;
    if (!root) return;
    const at = (e: PointerEvent) => {
      const o = root.getBoundingClientRect();
      return { x: e.clientX - o.left, y: e.clientY - o.top };
    };
    const move = (e: PointerEvent) => {
      const p = { ...at(e), t: performance.now() };
      setTrail((tr) => [...tr.filter((q) => p.t - q.t < 450), p].slice(-30));
    };
    const down = (e: PointerEvent) => {
      const id = performance.now();
      setClicks((c) => [...c.slice(-4), { id, ...at(e) }]);
      setTimeout(() => setClicks((c) => c.filter((k) => k.id !== id)), 1300);
    };
    const leave = () => setTrail([]);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointerleave", leave);
    // Let the trail fade out when the mouse stops.
    const fade = setInterval(() => setTrail((tr) => (tr.length ? tr.filter((q) => performance.now() - q.t < 450) : tr)), 120);
    return () => {
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointerleave", leave);
      clearInterval(fade);
    };
  }, []);

  return (
    <div ref={self} aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-md">
      <svg className="absolute inset-0 size-full">
        {trail.slice(1).map((p, i) => {
          const q = trail[i];
          const k = (i + 1) / trail.length;
          return (
            <line key={`${p.t}-${i}`} x1={q.x} y1={q.y} x2={p.x} y2={p.y} stroke="rgb(14,165,233)" strokeOpacity={k * 0.8} strokeWidth={2 + k * 5} strokeLinecap="round" />
          );
        })}
        {trail.length > 0 && <circle cx={trail[trail.length - 1].x} cy={trail[trail.length - 1].y} r={7} fill="rgba(14,165,233,0.35)" stroke="rgb(14,165,233)" strokeWidth={2} />}
      </svg>
      <AnimatePresence>
        {clicks.map((c) => (
          <Puddle key={c.id} x={c.x} y={c.y} color="239,68,68" size={0.8} />
        ))}
      </AnimatePresence>
    </div>
  );
}
