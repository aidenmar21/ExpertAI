"use client";

import type { ScreenEvent, Value } from "@understudy/shared";

/** One session clock shared by the fake app, capture, and the panel. */
export const sessionStart = typeof performance !== "undefined" ? performance.now() : 0;
export const sessionT = () => Math.round(performance.now() - sessionStart);

function store<T>() {
  let items: T[] = [];
  const subs = new Set<() => void>();
  return {
    push(item: T) {
      items = [...items, item];
      subs.forEach((s) => s());
    },
    all: () => items,
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

/**
 * Ground truth: what the fake app really changed. Scoring only (vision accuracy).
 * Never render it on screen and never send it to the agent.
 */
export interface TrueChange { t: number; field: string; from: Value; to: Value; record: string | null; }
export const groundTruth = store<TrueChange>();

/** Events the engine saw on screen; the apprentice panel renders these. */
export const screenEvents = store<ScreenEvent>();

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__understudy = {
    groundTruth: () => groundTruth.all(),
    screenEvents: () => screenEvents.all(),
  };
}
