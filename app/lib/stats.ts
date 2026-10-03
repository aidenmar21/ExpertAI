"use client";

import type { QuestionPick } from "@understudy/shared";

/** What the scoreboard needs from this browser, per job. Persists across tab switches and reloads. */
export interface SessionStats {
  questions: (QuestionPick & { t: number })[];
  /** Tutor mode: saves that were paused, by new-hire case index (server decides trap vs false alarm). */
  blocked: { caseIndex: number; action: string; t: number }[];
  /** Off-the-record windows on the session clock; end is null while still on. */
  offRecord: { start: number; end: number | null }[];
}

const EMPTY: SessionStats = { questions: [], blocked: [], offRecord: [] };
const KEY = (jobId: string) => `expertai:stats:${jobId}`;
const subs = new Set<() => void>();
const cache = new Map<string, SessionStats>();

export const sessionStats = {
  get(jobId: string): SessionStats {
    if (!cache.has(jobId)) {
      let stored = EMPTY;
      try {
        const raw = localStorage.getItem(KEY(jobId));
        if (raw) stored = { ...EMPTY, ...(JSON.parse(raw) as Partial<SessionStats>) };
      } catch {
        /* storage unavailable */
      }
      cache.set(jobId, stored);
    }
    return cache.get(jobId) ?? EMPTY;
  },
  update(jobId: string, fn: (s: SessionStats) => SessionStats) {
    const next = fn(sessionStats.get(jobId));
    cache.set(jobId, next);
    try {
      localStorage.setItem(KEY(jobId), JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
    subs.forEach((s) => s());
  },
  reset(jobId: string) {
    sessionStats.update(jobId, () => EMPTY);
  },
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
};
