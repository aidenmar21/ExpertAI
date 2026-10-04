"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { GuideStep } from "@understudy/brain";
import { KeyLine } from "@/components/KeyCast";

interface Box { x: number; y: number; w: number; h: number; rootW: number; rootH: number; minX: number }

const CARD_W = 360;

/**
 * Show-me pointer, after Clicky: a big animated cursor flies to the field or button the new hire should use
 * next, the rest of the app dims, the target glows, and a card says what to do, the keys the expert typed,
 * and why. Rendered inside FakeApp's overlay slot; finds its target by data-guide="field:<key>" /
 * "action:<key>" in the same app frame. Only the card's Hide button takes clicks.
 */
export default function GuideCursor({
  step,
  expert = "The expert",
  stepLabel,
  onClose,
}: {
  step: GuideStep | null;
  expert?: string;
  stepLabel?: string;
  onClose?: () => void;
}) {
  const self = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(200);
  const target = step ? `${step.target.kind}:${step.target.key}` : null;
  // The guide waits on this step until the person does it. Text saves when they leave the box, so watch the
  // box itself: once it holds the right value, say so and tell them how to move on.
  const [typedOk, setTypedOk] = useState(false);
  const want = step?.target.kind === "field" && step.value != null ? String(step.value).trim().toLowerCase() : null;
  useEffect(() => {
    const root = self.current?.closest("[data-guide-root]") as HTMLElement | null;
    const control = target && want != null ? (root?.querySelector(`[data-guide="${target}"] input, [data-guide="${target}"] select`) as HTMLInputElement | null) : null;
    if (!control || want == null) {
      const id = setTimeout(() => setTypedOk(false), 0);
      return () => clearTimeout(id);
    }
    const tick = () => {
      const have = control.value.trim().toLowerCase();
      setTypedOk(have === want || (have !== "" && Number(have) === Number(want)));
    };
    const id = setInterval(tick, 200);
    tick();
    return () => clearInterval(id);
  }, [target, want]);
  const reduce = useReducedMotion();

  useEffect(() => {
    const root = self.current?.closest("[data-guide-root]") as HTMLElement | null;
    if (!root || !target) {
      setBox(null);
      return;
    }
    const measure = () => {
      const el = root.querySelector(`[data-guide="${target}"]`) as HTMLElement | null;
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect(), o = root.getBoundingClientRect();
      // Keep the card off the record queue when the target is beside it.
      const nav = root.querySelector("nav")?.getBoundingClientRect();
      const minX = nav && nav.right - o.left < r.left - o.left ? nav.right - o.left + 8 : 8;
      setBox({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height, rootW: o.width, rootH: o.height, minX });
    };
    // A target scrolled out of view inside the form is brought into view first.
    (root.querySelector(`[data-guide="${target}"]`) as HTMLElement | null)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    measure();
    const t = setTimeout(measure, 400);
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    root.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      root.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [target]);

  // The card's real height decides whether it fits below the target or goes above it.
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCardH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [box !== null, target]); // eslint-disable-line react-hooks/exhaustive-deps

  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 140, damping: 20 };
  const pad = 6;
  // Cursor tip lands on the target's right half; the card goes below the target, or above when there's no room.
  const tip = box ? { x: box.x + Math.min(box.w * 0.75, box.w - 14), y: box.y + box.h * 0.55 } : null;
  const cardW = box ? Math.min(CARD_W, box.rootW - 16) : CARD_W;
  const cardLeft = box ? Math.max(box.minX, Math.min(box.x + box.w / 2 - cardW / 2, box.rootW - cardW - 8)) : 0;
  const gap = pad + 18;
  const roomBelow = box ? box.rootH - (box.y + box.h + gap) : 0;
  const roomAbove = box ? box.y - gap : 0;
  const cardTop = !box
    ? 0
    : roomBelow >= cardH + 8
      ? box.y + box.h + gap
      : roomAbove >= cardH + 8
        ? box.y - gap - cardH
        : Math.max(8, Math.min(box.y + box.h + gap, box.rootH - cardH - 8));
  const keys = step?.keys?.filter((k) => k !== "Tab" && k !== "Shift") ?? [];
  const action = step?.target.kind === "action";

  return (
    <div ref={self} aria-live="assertive" className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-md">
      <AnimatePresence>
        {box && tip && step && (
          <>
            {/* Spotlight: dims everything but the target, which glows. */}
            <motion.div
              key="spot"
              className="absolute rounded-lg ring-4 ring-sky-400"
              style={{ boxShadow: "0 0 0 9999px rgba(15,23,42,0.45), 0 0 28px 8px rgba(56,189,248,0.85)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, left: box.x - pad, top: box.y - pad, width: box.w + pad * 2, height: box.h + pad * 2 }}
              exit={{ opacity: 0 }}
              transition={spring}
            >
              {!reduce && <span className="absolute -inset-1 animate-ping rounded-lg ring-4 ring-sky-300/70" />}
            </motion.div>

            {/* The cursor: big, bright, gently tapping the target. */}
            <motion.div
              key="cursor"
              className="absolute left-0 top-0"
              initial={{ opacity: 0, x: tip.x - 120, y: tip.y + 120 }}
              animate={{ opacity: 1, x: tip.x, y: tip.y }}
              exit={{ opacity: 0 }}
              transition={spring}
            >
              {!reduce && <span className="absolute -left-4 -top-4 size-8 animate-ping rounded-full bg-sky-400/60" />}
              <motion.svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                aria-hidden
                style={{ filter: "drop-shadow(0 0 10px rgba(56,189,248,0.95)) drop-shadow(0 4px 12px rgba(2,132,199,0.8))" }}
                animate={reduce ? undefined : { x: [0, -3, 0], y: [0, -3, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              >
                <path d="M3 2l17 8.5-7.2 1.8L9.6 20z" fill="#38bdf8" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
              </motion.svg>
            </motion.div>

            {/* The card: what to do, in big type. */}
            <motion.div
              key="card"
              ref={card}
              role="status"
              className={`pointer-events-auto absolute rounded-xl bg-gradient-to-br p-4 text-white shadow-2xl ring-1 ring-white/30 ${
                typedOk ? "from-emerald-500 to-teal-600" : "from-sky-500 to-indigo-600"
              }`}
              style={{ width: cardW }}
              initial={{ opacity: 0, scale: 0.9, left: cardLeft, top: cardTop }}
              animate={{
                opacity: 1,
                scale: 1,
                left: cardLeft,
                top: cardTop,
              }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={spring}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-sky-100">{stepLabel ?? "Next step"}</p>
              <p className="mt-1 text-xl font-bold leading-snug">{typedOk ? "✓ That's right." : step.say}</p>
              {typedOk && <p className="mt-1 text-base font-semibold">Press Tab (or click the next field) to continue.</p>}

              {!action && step.value != null && step.value !== "" && (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-sky-50">
                  {keys.length ? "Enter" : "Choose"}
                  <span className="rounded-md bg-white px-2.5 py-1 text-base font-bold text-indigo-700 shadow">{String(step.value)}</span>
                </p>
              )}
              {!action && keys.length > 0 && (
                <div className="mt-2.5">
                  <p className="mb-1.5 text-[12px] font-semibold text-sky-100">{step.source === "case" ? "Type:" : `${expert} typed:`}</p>
                  <KeyLine keys={keys} />
                </div>
              )}
              {action && (
                <p className="mt-2 text-sm font-semibold text-sky-50">Click the glowing button.</p>
              )}
              {step.why && <p className="mt-2.5 border-t border-white/25 pt-2 text-sm leading-5 text-sky-50">{step.why}</p>}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 rounded-full bg-white/20 px-3 py-1 text-[13px] font-semibold text-white transition-colors hover:bg-white/30"
                >
                  Hide guide
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
