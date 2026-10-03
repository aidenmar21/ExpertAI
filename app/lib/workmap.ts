"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { OpenGap, Rule, ScreenEvent, TranscriptLine, WorkMap } from "@understudy/shared";
import { auditHeaders } from "@/lib/audit";

const KEY = (jobId: string) => `understudy:workmap:${jobId}`;
const subs = new Set<() => void>();
const cache = new Map<string, WorkMap | null>();
const seeding = new Set<string>();

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
  set(jobId: string, map: WorkMap | null) {
    cache.set(jobId, map);
    try {
      if (map) localStorage.setItem(KEY(jobId), JSON.stringify(map));
      else localStorage.removeItem(KEY(jobId));
    } catch {
      /* storage unavailable */
    }
    subs.forEach((s) => s());
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
  const map = (await res.json()) as WorkMap;
  workMaps.set(input.jobId, map);
  return map;
}
