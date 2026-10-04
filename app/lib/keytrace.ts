"use client";

import type { DemoStep, ExpertDemo } from "@understudy/brain";
import type { Value } from "@understudy/shared";

/**
 * Expert interaction trace: every keystroke, field edit, and button press inside the simulated app
 * (never outside it), plus the mouse path that led to each click. Keys typed into PII fields are stored as "•".
 * Feeds the tutor's show-me pointer and walkthrough.
 */
export interface TraceEntry {
  t: number;
  record: string;
  kind: "open" | "key" | "change" | "action" | "click";
  field?: string;
  action?: string;
  key?: string;
  x?: number;                     // click position, 0..1 of the app frame
  y?: number;
  target?: string;                // data-guide of what was clicked, e.g. "field:price"
  from?: string;                  // data-guide of the previous click: where the mouse came from
  value?: Value;                  // on change: what the field now holds ("•" for PII)
}

function store<T>(key: string, cap: number) {
  let items: T[] | null = null;
  const subs = new Set<() => void>();
  const load = (): T[] => {
    if (items) return items;
    try {
      items = JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
    } catch {
      items = [];
    }
    return items;
  };
  const save = (next: T[]) => {
    items = next.slice(-cap);
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      /* storage unavailable */
    }
    subs.forEach((s) => s());
  };
  return {
    push: (item: T) => save([...load(), item]),
    clear: () => save([]),
    all: () => load(),
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
  };
}

export const keyTrace = store<TraceEntry>("expertai:keytrace", 5000);
export const expertDemos = {
  ...store<ExpertDemo>("expertai:demos", 200),
  /** Forget one learned task (by its recorded_at stamp). */
  remove(recordedAt: string | undefined) {
    const keep = expertDemos.all().filter((d) => d.recorded_at !== recordedAt);
    expertDemos.clear();
    keep.forEach((d) => expertDemos.push(d));
  },
};

/**
 * "Record task" (expert): while on, what the expert does is saved as a task the new hire guide can teach.
 * Teach mode alone follows and narrates; only recording saves. In memory: a reload stops a recording.
 */
export const recording = (() => {
  const subs = new Set<() => void>();
  let since: number | null = null;
  let saved = 0;
  return {
    get: () => since,
    /** Tasks saved since the current (or last) recording started. */
    saved: () => saved,
    start(t: number) {
      since = t;
      saved = 0;
      subs.forEach((s) => s());
    },
    stop() {
      since = null;
      subs.forEach((s) => s());
    },
    noteSaved() {
      saved++;
      subs.forEach((s) => s());
    },
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
  };
})();

/**
 * Teach mode (expert): keys, clicks, and the mouse are followed, shown on screen, and narrated to the voice
 * agent. On by default; the expert can switch it off from the app.
 */
export const teachMode = (() => {
  const subs = new Set<() => void>();
  let on: boolean | null = null;
  const get = () => {
    if (on === null) {
      try {
        on = localStorage.getItem("expertai:teach") !== "off";
      } catch {
        on = true;
      }
    }
    return on;
  };
  return {
    get,
    set(next: boolean) {
      on = next;
      try {
        localStorage.setItem("expertai:teach", next ? "on" : "off");
      } catch {
        /* storage unavailable */
      }
      subs.forEach((s) => s());
    },
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
  };
})();

type Pt = [number, number];

/** Keep the shape of a mouse path in at most n points. */
function thin(path: Pt[], n = 24): Pt[] {
  if (path.length <= n) return path;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) out.push(path[Math.round((i * (path.length - 1)) / (n - 1))]);
  return out;
}
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Tracks the record the expert has open: its values when opened, the steps since, and the mouse paths to them. */
export function demoRecorder() {
  let open: { id: string; record: Record<string, Value>; steps: DemoStep[]; keys: Record<string, string[]> } | null = null;
  let moves: Pt[] = [];
  let paths: Record<string, Pt[]> = {};
  let lastTarget: string | undefined;
  return {
    open(id: string, record: Record<string, Value>, t: number, pii: Set<string>) {
      if (open?.id === id) return;
      const safe = Object.fromEntries(Object.entries(record).map(([k, v]) => [k, pii.has(k) && v != null ? "•" : v]));
      open = { id, record: safe, steps: [], keys: {} };
      paths = {};
      keyTrace.push({ t, record: id, kind: "open" });
    },
    /** Mouse moved (0..1 of the app frame). Kept in memory only; saved with the next click. */
    move(x: number, y: number) {
      moves.push([r3(x), r3(y)]);
      if (moves.length > 400) moves = moves.slice(-400);
    },
    click(x: number, y: number, target: string | null, t: number) {
      if (!open) return;
      const path = thin([...moves, [r3(x), r3(y)]]);
      moves = [[r3(x), r3(y)]];
      if (target) paths[target] = path;
      keyTrace.push({ t, record: open.id, kind: "click", x: r3(x), y: r3(y), target: target ?? undefined, from: lastTarget });
      lastTarget = target ?? lastTarget;
    },
    key(field: string, key: string, t: number, pii: boolean) {
      if (!open) return;
      const k = pii && key.length === 1 ? "•" : key;
      open.keys[field] = [...(open.keys[field] ?? []), k].slice(-40);
      keyTrace.push({ t, record: open.id, kind: "key", field, key: k });
    },
    change(field: string, t: number, value: Value, pii: boolean) {
      if (!open) return;
      const step: DemoStep = { kind: "field", key: field, t, keys: open.keys[field], value: pii ? null : value, path: paths[`field:${field}`] };
      const i = open.steps.findIndex((s) => s.kind === "field" && s.key === field);
      if (i >= 0) open.steps[i] = { ...step, t: open.steps[i].t, path: open.steps[i].path ?? step.path };
      else open.steps.push(step);
      open.keys[field] = [];
      keyTrace.push({ t, record: open.id, kind: "change", field, value: pii && value != null ? "•" : value });
    },
    action(action: string, t: number, title?: string) {
      if (!open) return;
      keyTrace.push({ t, record: open.id, kind: "action", action });
      if (recording.get() !== null) {
        expertDemos.push({
          record: open.record, steps: [...open.steps, { kind: "action", key: action, t, path: paths[`action:${action}`] }], action,
          title: title ?? open.id, recorded_at: new Date().toISOString(),
        });
        recording.noteSaved();
      }
      open = { ...open, steps: [], keys: {} };
      paths = {};
    },
    /** Recording started: learn from here, not from what happened before. */
    restart() {
      if (open) open = { ...open, steps: [], keys: {} };
      paths = {};
      moves = [];
    },
    /** Recording stopped mid-case: keep the steps so far as a partial task. */
    flush(title?: string) {
      if (!open || !open.steps.length) return;
      expertDemos.push({ record: open.record, steps: open.steps, action: null, title: title ?? open.id, recorded_at: new Date().toISOString() });
      recording.noteSaved();
      open = { ...open, steps: [], keys: {} };
    },
  };
}
