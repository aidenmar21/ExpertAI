"use client";

import type { ScreenEvent, Value } from "@understudy/shared";

/**
 * One session clock shared by the fake app, capture, the panel, and the voice transcript.
 * Anchored to wall time and kept in sessionStorage so expert and new-hire tabs share it.
 */
const sessionStart = (() => {
  if (typeof window === "undefined") return Date.now();
  try {
    const raw = sessionStorage.getItem("expertai:session-start");
    if (raw) return Number(raw);
    sessionStorage.setItem("expertai:session-start", String(Date.now()));
  } catch {
    /* storage unavailable */
  }
  return Date.now();
})();
export const sessionT = () => Date.now() - sessionStart;

/** Start a fresh session: new clock, no events, no ground truth. */
export function resetSession() {
  try {
    sessionStorage.setItem("expertai:session-start", String(Date.now()));
  } catch {
    /* storage unavailable */
  }
  screenEvents.clear();
  groundTruth.clear();
}

function store<T>(key: string) {
  let items: T[] | null = null;
  const subs = new Set<() => void>();
  const load = (): T[] => {
    if (items) return items;
    try {
      const raw = localStorage.getItem(key);
      items = raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      items = [];
    }
    return items;
  };
  const save = (next: T[]) => {
    items = next;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
    subs.forEach((s) => s());
  };
  return {
    push(item: T) {
      save([...load(), item]);
    },
    clear() {
      save([]);
    },
    all: () => load(),
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
export const groundTruth = store<TrueChange>("expertai:ground-truth");

/** Events the engine saw on screen; the apprentice panel renders these. */
export const screenEvents = store<ScreenEvent>("expertai:events");

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__expertai = {
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
