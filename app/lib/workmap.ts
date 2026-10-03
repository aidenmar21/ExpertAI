"use client";

import type { ScreenEvent, TranscriptLine, WorkMap } from "@understudy/shared";

const KEY = (jobId: string) => `understudy:workmap:${jobId}`;
const subs = new Set<() => void>();
const cache = new Map<string, WorkMap | null>();

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
  const res = await fetch("/api/workmap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      job_id: input.jobId,
      expert: input.expert,
      events: input.events,
      transcript: input.transcript,
      previous: workMaps.get(input.jobId) ?? undefined,
      confirm: input.confirm ?? false,
    }),
  });
  if (!res.ok) return null;
  const map = (await res.json()) as WorkMap;
  workMaps.set(input.jobId, map);
  return map;
}
