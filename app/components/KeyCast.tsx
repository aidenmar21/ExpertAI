"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { keyTrace, type TraceEntry } from "@/lib/keytrace";
import { sessionT } from "@/lib/session";

const NAMED: Record<string, string> = {
  Backspace: "⌫", Delete: "Del", Enter: "⏎", Tab: "⇥", Escape: "Esc", " ": "Space",
  ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
};
export const keyLabel = (k: string) => NAMED[k] ?? k;

/** A row of keycaps. `size="lg"` for the tutor's show-me card; `done` lights the first n green (already typed). */
export function KeyCaps({ keys, size = "sm", done }: { keys: string[]; size?: "sm" | "lg"; done?: number }) {
  const cap =
    size === "lg"
      ? "min-w-9 h-9 px-2 text-base rounded-md border-b-4"
      : "min-w-6 h-6 px-1.5 text-[12px] rounded border-b-2";
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {keys.map((k, i) => (
        <kbd
          key={i}
          className={`inline-flex items-center justify-center border font-mono font-semibold shadow-sm transition-colors ${cap} ${
            done !== undefined && i < done
              ? "border-emerald-500 border-b-emerald-700 bg-emerald-400 text-emerald-950"
              : "border-slate-300 border-b-slate-400 bg-white text-slate-900 dark:border-slate-600 dark:border-b-slate-500 dark:bg-slate-800 dark:text-slate-50"
          }`}
        >
          {keyLabel(k)}
        </kbd>
      ))}
    </span>
  );
}

const EMPTY: TraceEntry[] = [];
/** Page load on the session clock: the strip shows only what was recorded on this visit. */
const since = typeof window === "undefined" ? 0 : sessionT();
let cache: { src: TraceEntry[]; out: TraceEntry[] } = { src: EMPTY, out: EMPTY };
/** Entries recorded since this page loaded, newest last (stable reference for useSyncExternalStore). */
function recent(): TraceEntry[] {
  const all = keyTrace.all();
  if (cache.src !== all) cache = { src: all, out: all.filter((e) => e.t >= since && e.kind !== "open" && !(e.kind === "click" && !e.target?.startsWith("field:"))).slice(-10) };
  return cache.out;
}

/**
 * Expert mode: shows each keystroke and click the moment it is recorded, so the expert can see their
 * steps are being followed for the new hire.
 */
export default function KeyCast({ fieldLabel, actionLabel }: { fieldLabel: (k: string) => string; actionLabel: (k: string) => string }) {
  const items = useSyncExternalStore(keyTrace.subscribe, recent, () => EMPTY);
  const reduce = useReducedMotion();
  const last = items[items.length - 1];
  const field = last?.field ?? items.findLast((e) => e.field)?.field;

  return (
    <div
      aria-live="polite"
      className="flex min-h-12 items-center gap-3 border-t border-sky-200 bg-sky-50 px-4 py-2 dark:border-sky-900 dark:bg-sky-950/60"
    >
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-red-500" />
        Following your steps
      </span>
      {items.length === 0 ? (
        <span className="text-[13px] text-slate-600 dark:text-slate-300">Type, click, or move the mouse in the app; every key and click shows up here.</span>
      ) : (
        <>
          {field && last?.kind !== "action" && (
            <span className="shrink-0 rounded bg-sky-600 px-2 py-0.5 text-[12px] font-semibold text-white">{fieldLabel(field)}</span>
          )}
          {/* Newest on the right, always visible; the oldest fall off the left edge. */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-hidden">
          <AnimatePresence initial={false}>
            {items.map((e, i) => (
              <motion.span
                key={`${e.t}-${i}`}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 6, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="shrink-0"
              >
                {e.kind === "key" && e.key ? (
                  <KeyCaps keys={[e.key]} />
                ) : e.kind === "action" && e.action ? (
                  <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[12px] font-semibold text-white">Clicked {actionLabel(e.action)}</span>
                ) : e.kind === "click" && e.target ? (
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[12px] font-semibold text-white dark:bg-slate-600">🖱 {fieldLabel(e.target.slice(6))}</span>
                ) : e.kind === "change" && e.field ? (
                  <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[12px] font-semibold text-white">✓ {fieldLabel(e.field)}</span>
                ) : null}
              </motion.span>
            ))}
          </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
