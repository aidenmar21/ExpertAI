"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { OpenGap, Rule, ScreenEvent, TranscriptLine, WorkMap } from "@understudy/shared";
import { auditHeaders } from "@/lib/audit";
import { persistenceEnabled } from "@/lib/db/browser";

const KEY = (jobId: string) => `understudy:workmap:${jobId}`;
const subs = new Set<() => void>();
const cache = new Map<string, WorkMap | null>();
const seeding = new Set<string>();

// ---------- Server sync (only when Supabase is configured; otherwise localStorage alone, as before) ----------
// The server copy (GET/PUT /api/workmap) is the source of truth; localStorage is a cache. Each job's server version
// is tracked so saves are compare-and-swap: a 409 means another expert saved first, and the latest copy is reloaded.
const VERSION_HEADER = "x-workmap-version";
const versions = new Map<string, number>();
const pulled = new Set<string>();
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

function store(jobId: string, map: WorkMap | null) {
  cache.set(jobId, map);
  try {
    if (map) localStorage.setItem(KEY(jobId), JSON.stringify(map));
    else localStorage.removeItem(KEY(jobId));
  } catch {
    /* storage unavailable */
  }
  subs.forEach((s) => s());
}

function noteVersion(jobId: string, res: Response) {
  const v = Number(res.headers.get(VERSION_HEADER));
  if (Number.isInteger(v) && v > 0) versions.set(jobId, v);
}

/** Load the job's server map once per page load. Returns it (null when there is none or persistence is off). */
async function pull(jobId: string): Promise<WorkMap | null> {
  if (!(await persistenceEnabled())) return null;
  try {
    const res = await fetch(`/api/workmap?job=${encodeURIComponent(jobId)}`, { cache: "no-store" });
    if (!res.ok) return null;
    noteVersion(jobId, res);
    const map = (await res.json()) as WorkMap | null;
    if (map && Array.isArray(map.rules)) {
      store(jobId, map);
      return map;
    }
  } catch {
    /* offline: keep the cache */
  }
  return null;
}

function syncOnce(jobId: string) {
  if (pulled.has(jobId)) return;
  pulled.add(jobId);
  void pull(jobId);
}

/** Debounced save of a local edit (policy rules, removed rules, new gaps, coverage answers). */
function schedulePush(jobId: string) {
  clearTimeout(pushTimers.get(jobId));
  pushTimers.set(jobId, setTimeout(() => void push(jobId), 400));
}

async function push(jobId: string) {
  if (!(await persistenceEnabled())) return;
  const map = cache.get(jobId);
  if (!map) return;
  try {
    const res = await fetch("/api/workmap", {
      method: "PUT",
      headers: { "content-type": "application/json", ...auditHeaders() },
      body: JSON.stringify({ job_id: jobId, map, version: versions.get(jobId) ?? 0 }),
    });
    if (res.ok) noteVersion(jobId, res);
    else if (res.status === 409) {
      console.warn("[workmap] another expert saved this Work Map first; loading the latest copy");
      await pull(jobId);
    }
  } catch {
    /* offline: the next edit retries */
  }
}

/** The latest Work Map per job, kept in memory and in localStorage so tutor mode and /workmap can read it. */
export const workMaps = {
  get(jobId: string): WorkMap | null {
    if (!cache.has(jobId)) {
      let stored: WorkMap | null = null;
      try {
        const raw = localStorage.getItem(KEY(jobId));
        stored = raw ? (JSON.parse(raw) as WorkMap) : null;
      } catch {
        /* storage unavailable */
      }
      cache.set(jobId, stored);
    }
    return cache.get(jobId) ?? null;
  },
  /** A local edit: cached here and, when persistence is on, saved to the server (clearing never deletes the server copy). */
  set(jobId: string, map: WorkMap | null) {
    store(jobId, map);
    if (map) schedulePush(jobId);
  },
  update(jobId: string, fn: (m: WorkMap) => WorkMap) {
    const cur = workMaps.get(jobId);
    if (cur) workMaps.set(jobId, fn(cur));
  },
  /** Add rules (policy rules the expert accepted, or edits). Replaces rules with the same id. */
  addRules(jobId: string, rules: Rule[]) {
    workMaps.update(jobId, (m) => ({ ...m, rules: [...m.rules.filter((r) => !rules.some((x) => x.id === r.id)), ...rules] }));
  },
  removeRule(jobId: string, ruleId: string) {
    workMaps.update(jobId, (m) => ({ ...m, rules: m.rules.filter((r) => r.id !== ruleId) }));
  },
  /** A case nobody covers yet (tutor said "check with your manager"): becomes an open gap for the next expert session. */
  addGap(jobId: string, gap: OpenGap) {
    workMaps.update(jobId, (m) => (m.open_gaps.some((g) => g.question === gap.question) ? m : { ...m, open_gaps: [...m.open_gaps, gap] }));
  },
  subscribe(fn: () => void) {
    subs.add(fn);
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("understudy:workmap:")) {
        cache.clear();
        fn();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      subs.delete(fn);
      window.removeEventListener("storage", onStorage);
    };
  },
};

/** Seed a job that has no Work Map yet with its baseline (industry standard) rules. */
export async function seedWorkMap(jobId: string, expert: string): Promise<WorkMap | null> {
  if (workMaps.get(jobId) || seeding.has(jobId)) return workMaps.get(jobId);
  seeding.add(jobId);
  try {
    pulled.add(jobId);
    const server = await pull(jobId);
    if (server) return server;
    const res = await fetch(`/api/baseline?job=${encodeURIComponent(jobId)}&expert=${encodeURIComponent(expert)}`);
    if (!res.ok) return null;
    const map = (await res.json()) as WorkMap;
    if (!workMaps.get(jobId)) workMaps.set(jobId, map);
    return workMaps.get(jobId);
  } catch {
    return null;
  } finally {
    seeding.delete(jobId);
  }
}

const noMap = (): WorkMap | null => null;

/** The job's Work Map, seeded with baseline rules on first use. */
export function useWorkMap(jobId: string, expert = "Expert"): WorkMap | null {
  const map = useSyncExternalStore(workMaps.subscribe, () => workMaps.get(jobId), noMap);
  useEffect(() => {
    if (!map) void seedWorkMap(jobId, expert);
    else syncOnce(jobId);
  }, [map, jobId, expert]);
  return map;
}

/** Baseline rules the expert overrode: "At your company, N rules differ from the industry standard." */
export const differsFromStandard = (map: WorkMap | null) => map?.rules.filter((r) => r.source === "baseline" && r.overridden_by).length ?? 0;

/**
 * Rebuild the Work Map from the FULL history (brain wants everything, never deltas).
 * confirm: true also marks it confirmed after the expert's teach-back "yes".
 */
export async function rebuildWorkMap(input: {
  jobId: string;
  expert: string;
  events: ScreenEvent[];
  transcript: TranscriptLine[];
  confirm?: boolean;
}): Promise<WorkMap | null> {
  const previous = workMaps.get(input.jobId) ?? (await seedWorkMap(input.jobId, input.expert)) ?? undefined;
  const res = await fetch("/api/workmap", {
    method: "POST",
    headers: { "content-type": "application/json", ...auditHeaders() },
    body: JSON.stringify({
      job_id: input.jobId,
      expert: input.expert,
      events: input.events,
      transcript: input.transcript,
      previous,
      confirm: input.confirm ?? false,
    }),
  });
  if (!res.ok) return null;
  noteVersion(input.jobId, res);
  const map = (await res.json()) as WorkMap;
  store(input.jobId, map); // already saved by the server
  return map;
}
