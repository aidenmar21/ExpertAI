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
      return () => {
        subs.delete(fn);
      };
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

/**
 * UI activity for stuck detection in tutor mode (field flips, hovering an action, idle with a record open).
 * Derived counts go to engine.detectStuck; raw values never go to the agent.
 */
export const activity = (() => {
  let changes: { t: number; field: string; record: string | null }[] = [];
  let hovering: { action: string; since: number } | null = null;
  let recordOpenedAt: number | null = null;
  return {
    fieldChanged(c: { t: number; field: string; record: string | null }) {
      changes = [...changes.filter((x) => c.t - x.t < 30_000), c];
    },
    hover(action: string | null) {
      hovering = action ? { action, since: sessionT() } : null;
    },
    recordOpened(t: number) {
      recordOpenedAt = t;
    },
    /** Same field changed more than once in the last 30s on the open record. */
    backAndForthCount(now: number): number {
      const recent = changes.filter((x) => now - x.t < 30_000);
      const byField = new Map<string, number>();
      recent.forEach((x) => byField.set(`${x.record}|${x.field}`, (byField.get(`${x.record}|${x.field}`) ?? 0) + 1));
      return Math.max(0, ...[...byField.values()].map((n) => n - 1));
    },
    hovering: (now: number) => (hovering ? { action: hovering.action, ms: now - hovering.since } : undefined),
    recordOpenedAt: () => recordOpenedAt,
  };
})();
