"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import type { GuideStep } from "@understudy/brain";
import { KeyCaps } from "@/components/KeyCast";
import { Puddle } from "@/components/MouseTrail";

type Box = { x: number; y: number; w: number; h: number };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Bubble {
  x: number;
  y: number;                 // top, when shown below the target
  above?: number;            // bottom offset, when there's no room below and it sits above the target
  keys: string[];
  n: number;                 // keys shown (demo) or keys already typed correctly (your turn)
  value?: string;
  select: boolean;
  action: boolean;
  yours: boolean;            // waiting for the person to do it
  wrong: boolean;            // what they entered doesn't match yet
}

/** What a field holds, compared loosely: case, spaces, and number formatting don't matter. */
function same(have: string, want: string): boolean {
  const a = have.trim().toLowerCase(), b = want.trim().toLowerCase();
  if (a === b) return true;
  const na = Number(a), nb = Number(b);
  return a !== "" && b !== "" && !Number.isNaN(na) && !Number.isNaN(nb) && na === nb;
}

/**
 * The guided mouse. A drawn cursor moves along the expert's own recorded mouse path to each field or button,
 * clicks with a puddle, and types the keys one by one.
 * - interactive (new hire): after showing a step it STOPS and waits until the person really types the value or
 *   presses the button, showing their progress on the keys, then moves on to the next step.
 * - otherwise (expert showcase): plays the whole case through.
 * Nothing is clicked or typed for the person.
 */
export default function Walkthrough({
  plan,
  expert = "The expert",
  interactive = false,
  onDone,
}: {
  plan: GuideStep[];
  expert?: string;
  interactive?: boolean;
  onDone: () => void;
}) {
  const self = useRef<HTMLDivElement>(null);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [ring, setRing] = useState<Box | null>(null);
  const [splash, setSplash] = useState<{ id: number; x: number; y: number; ok?: boolean } | null>(null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [finished, setFinished] = useState(false);
  const skip = useRef<(() => void) | null>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const root = self.current?.closest("[data-guide-root]") as HTMLElement | null;
    const cursor = scope.current;
    if (!root || !cursor || !plan.length) return;
    let stopped = false;
    const o = () => root.getBoundingClientRect();
    const elOf = (key: string) => root.querySelector(`[data-guide="${key}"]`) as HTMLElement | null;
    const boxOf = (el: HTMLElement): Box => {
      const r = el.getBoundingClientRect(), b = o();
      return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
    };

    /** Resolves once the person has done this step for real (or skipped it). */
    const yourTurn = (step: GuideStep, el: HTMLElement, base: Omit<Bubble, "n" | "yours" | "wrong">) =>
      new Promise<void>((resolve) => {
        let finish = () => {};
        const end = () => finish();
        skip.current = end;
        if (step.target.kind === "action") {
          // Pressing the button is the step (even if a rule then pauses it: the tutor takes over).
          const press = () => end();
          el.addEventListener("click", press, true);
          setBubble({ ...base, n: 0, yours: true, wrong: false });
          finish = () => {
            el.removeEventListener("click", press, true);
            skip.current = null;
            resolve();
          };
          return;
        }
        const control = el.querySelector("input, select, textarea") as HTMLInputElement | HTMLSelectElement | null;
        if (!control) {
          skip.current = null;
          resolve();
          return;
        }
        const start = control.value;
        const want = step.value != null ? String(step.value) : null;
        const typedKeys = (base.keys ?? []).filter((k) => k.length === 1).join("");
        const tick = () => {
          if (stopped) return finish();
          const have = control.value;
          let ok: boolean;
          if (want != null) ok = same(have, want);
          else ok = have !== start && have !== "" && (control.tagName === "SELECT" || document.activeElement !== control);
          // Progress on the keycaps: how many of the keys to type are already there, in order.
          const typed = have.startsWith(start) ? have.slice(start.length) : have;
          let n = 0;
          if (typedKeys && base.keys.length === typedKeys.length) while (n < typed.length && n < typedKeys.length && typed[n].toLowerCase() === typedKeys[n].toLowerCase()) n++;
          const wrong = !ok && want != null && have !== start && (control.tagName === "SELECT" || (n < typed.length) || have.length >= want.length);
          setBubble({ ...base, n, yours: true, wrong });
          if (ok) finish();
        };
        const id = setInterval(tick, 150);
        finish = () => {
          clearInterval(id);
          skip.current = null;
          resolve();
        };
        tick();
      });

    (async () => {
      const start = o();
      let at = { x: start.width - 60, y: start.height - 40 };
      await animate(cursor, { x: at.x, y: at.y, opacity: 1 }, { duration: 0 });
      for (let k = 0; k < plan.length && !stopped; k++) {
        const step = plan[k];
        setI(k);
        setBubble(null);
        const el = elOf(`${step.target.kind}:${step.target.key}`);
        if (!el) continue;
        // Bring a field that is scrolled out of view inside the form into view before pointing at it.
        const r0 = el.getBoundingClientRect(), b0 = o();
        if (r0.top < b0.top || r0.bottom > b0.bottom - 60) {
          el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
          await sleep(reduce ? 0 : 450);
        }
        const box = boxOf(el);
        setRing(box);
        const end = { x: box.x + Math.min(box.w * 0.6, box.w - 16), y: box.y + box.h * 0.6 };
        // The expert's path, scaled to this screen, ending on the target; else a gentle curve.
        const b = o();
        const via = step.path?.length
          ? step.path.slice(0, -1).map(([px, py]) => ({ x: px * b.width, y: py * b.height }))
          : [{ x: (at.x + end.x) / 2 + 40, y: Math.min(at.y, end.y) - 30 }];
        const pts = [at, ...via, end];
        const dist = pts.slice(1).reduce((d, p, j) => d + Math.hypot(p.x - pts[j].x, p.y - pts[j].y), 0);
        await animate(
          cursor,
          { x: pts.map((p) => p.x), y: pts.map((p) => p.y) },
          { duration: reduce ? 0 : Math.min(1.8, Math.max(0.7, dist / 500)), ease: "easeInOut" },
        );
        if (stopped) return;
        at = end;
        // Click: the cursor dips and a puddle spreads.
        setSplash({ id: performance.now(), x: end.x, y: end.y });
        await animate(cursor, { scale: [1, 0.8, 1] }, { duration: 0.25 });
        await sleep(300);

        const action = step.target.kind === "action";
        const keys = step.keys ?? [];
        const rootH = o().height;
        // Keep the bubble off the record queue.
        const nav = root.querySelector("nav")?.getBoundingClientRect();
        const minX = nav && nav.right - o().left < box.x ? nav.right - o().left + 8 : 8;
        const roomBelow = rootH - (box.y + box.h + 8) > 130;
        const base = {
          x: Math.max(minX, Math.min(box.x, o().width - 448)), y: box.y + box.h + 8, above: roomBelow ? undefined : rootH - box.y + 8, keys,
          value: step.value != null ? String(step.value) : undefined,
          select: !action && !keys.length, action,
        };
        if (!action && keys.length) {
          for (let n = 1; n <= keys.length && !stopped; n++) {
            setBubble({ ...base, n, yours: false, wrong: false });
            await sleep(reduce ? 0 : 80);
          }
          await sleep(500);
        } else {
          setBubble({ ...base, n: 0, yours: false, wrong: false });
          await sleep(action ? 700 : 900);
        }
        if (stopped) return;

        if (interactive) {
          // Step aside so the field stays readable, then wait for the real thing.
          await animate(cursor, { x: box.x + box.w - 8, y: box.y + box.h - 6 }, { duration: reduce ? 0 : 0.35 });
          at = { x: box.x + box.w - 8, y: box.y + box.h - 6 };
          await yourTurn(step, el, base);
          if (stopped) return;
          setSplash({ id: performance.now(), x: box.x + box.w / 2, y: box.y + box.h / 2, ok: true });
          await sleep(450);
        }
      }
      if (stopped) return;
      setBubble(null);
      setRing(null);
      setFinished(true);
      await sleep(1600);
      if (!stopped) done.current();
    })();
    return () => {
      stopped = true;
      skip.current?.();
    };
  }, [plan, animate, scope, reduce, interactive]);

  const step = plan[i];
  const yours = !!bubble?.yours;

  return (
    <div ref={self} className="pointer-events-none absolute inset-0 z-40 overflow-hidden rounded-md">
      {/* Dim the app so the mouse is the thing to watch; lighter on your turn so you can work. */}
      <div className={`absolute inset-0 transition-colors duration-300 ${yours ? "bg-slate-900/15" : "bg-slate-900/35"}`} />
      <AnimatePresence>
        {ring && (
          <motion.div
            key="ring"
            className={`absolute rounded-lg ring-4 ${yours ? "ring-amber-400" : "bg-white/10 ring-sky-400"}`}
            style={{ boxShadow: yours ? "0 0 28px 8px rgba(251,191,36,0.75)" : "0 0 28px 8px rgba(56,189,248,0.8)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, left: ring.x - 6, top: ring.y - 6, width: ring.w + 12, height: ring.h + 12 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 22 }}
          />
        )}
      </AnimatePresence>

      {splash && <Puddle key={splash.id} x={splash.x} y={splash.y} size={1.3} color={splash.ok ? "16,185,129" : undefined} />}

      {bubble && (
        <motion.div
          className={`absolute rounded-xl px-3 py-2 text-white shadow-2xl ring-2 ${
            !bubble.yours ? "bg-slate-900/90 ring-sky-400" : bubble.wrong ? "bg-rose-700/95 ring-rose-300" : "bg-slate-900/90 ring-amber-400"
          } ${bubble.yours ? "pointer-events-auto" : ""}`}
          style={bubble.above !== undefined ? { left: bubble.x, bottom: bubble.above, maxWidth: 440 } : { left: bubble.x, top: bubble.y, maxWidth: 440 }}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className={`mb-1.5 text-[12px] font-bold uppercase tracking-wide ${bubble.yours ? (bubble.wrong ? "text-rose-100" : "text-amber-300") : "text-sky-300"}`}>
            {!bubble.yours
              ? bubble.action
                ? "Click"
                : bubble.select
                  ? "Choose"
                  : "Typing"
              : bubble.wrong
                ? "Not quite: check it against the slip"
                : bubble.action
                  ? "Your turn: click it"
                  : bubble.select
                    ? "Your turn: choose it"
                    : "Your turn: type it"}
          </p>
          {bubble.action ? (
            <p className="text-base font-semibold">{step?.say}</p>
          ) : bubble.select ? (
            <p className="flex items-center gap-2 text-base font-semibold">
              <span className="rounded-md bg-sky-400 px-2.5 py-0.5 text-slate-950">{bubble.value ?? "a value"}</span>
            </p>
          ) : (
            <KeyCaps keys={bubble.yours ? bubble.keys : bubble.keys.slice(0, bubble.n)} size="lg" done={bubble.yours ? bubble.n : undefined} />
          )}
          {bubble.yours && (
            <button
              type="button"
              onClick={() => skip.current?.()}
              className="mt-2 rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] font-semibold text-white hover:bg-white/25"
            >
              Skip this step →
            </button>
          )}
        </motion.div>
      )}

      {/* The drawn mouse. */}
      <div ref={scope} className="absolute left-0 top-0 opacity-0" style={{ willChange: "transform" }}>
        <motion.svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          aria-hidden
          style={{ filter: "drop-shadow(0 6px 12px rgba(2,132,199,0.75))" }}
          animate={yours && !reduce ? { x: [0, -4, 0], y: [0, -4, 0] } : { x: 0, y: 0 }}
          transition={{ duration: 0.9, repeat: yours ? Infinity : 0, ease: "easeInOut" }}
        >
          <path d="M3 2l17 8.5-7.2 1.8L9.6 20z" fill={yours ? "#fbbf24" : "#38bdf8"} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
        </motion.svg>
      </div>

      {/* Caption: which step, in big type. */}
      <div aria-live="assertive" className="absolute inset-x-0 top-24 flex justify-center px-3">
        <div
          className={`rounded-2xl px-5 py-3 text-center text-white shadow-2xl ring-1 ring-white/30 ${
            yours ? "bg-gradient-to-br from-amber-500 to-orange-600" : finished ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-sky-500 to-indigo-600"
          }`}
        >
          {finished ? (
            <p className="text-xl font-bold">{interactive ? "Done! You did every step." : "That's the whole case."}</p>
          ) : (
            <>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                {yours ? "Your turn" : `Watch how ${expert} does it`} · step {i + 1} of {plan.length}
              </p>
              <p className="mt-0.5 text-xl font-bold leading-snug">{step?.say}</p>
              {yours && <p className="mt-0.5 text-[13px] font-semibold text-white/90">The guide waits until you do it.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
