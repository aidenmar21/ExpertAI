"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Scoreboard as Board, WorkMap } from "@understudy/shared";

interface ScoreResult { scoreboard: Board; tutor: { case: string; trap: boolean; caught: boolean | null; false_alarm: boolean }[]; }
import { useFlag } from "@/lib/flags";
import { groundTruth, screenEvents } from "@/lib/session";
import { sessionStats } from "@/lib/stats";

/** Demo numbers: what ExpertAI learned, saw, caught, and asked, scored on the server against the answer key. */
export default function Scoreboard({ jobId, map }: { jobId: string; map: WorkMap | null }) {
  const stats = useSyncExternalStore(sessionStats.subscribe, () => sessionStats.get(jobId), () => sessionStats.get(jobId));
  const [result, setResult] = useState<ScoreResult | null>(null);
  const enabled = useFlag("scoreboard");

  const guardrail = stats.questions.filter((q) => q.is_guardrail).length;

  useEffect(() => {
    if (!enabled || !map) return;
    const ctrl = new AbortController();
    fetch("/api/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        job_id: jobId,
        map,
        ground_truth: groundTruth.all(),
        events: screenEvents.all(),
        questions: stats.questions,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b && setResult(b as ScoreResult))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [enabled, jobId, map, stats, guardrail]);

  if (!enabled || !map) return null;

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const b = result?.scoreboard;
  const liveBlocks = new Set(stats.blocked.map((x) => x.caseIndex)).size;

  return (
    <section aria-label="Scoreboard" className="mt-8">
      <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">Scoreboard</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label="Rules learned" value={b ? `${b.rules_learned} / ${b.rules_total}` : "…"} hint="confirmed vs answer key" />
        <Tile label="Vision accuracy" value={b ? pct(b.vision_accuracy) : "…"} hint="events vs true changes" />
        <Tile
          label="Tutor catches"
          value={b ? `${b.tutor_catches} / ${b.tutor_traps}` : "…"}
          hint={liveBlocks > 0 ? `${liveBlocks} paused live this shift` : "wrong moves the confirmed rules stop"}
        />
        <Tile label="False alarms" value={b ? String(b.false_alarms) : "…"} hint="routine saves paused" tone={b && b.false_alarms > 0 ? "warn" : "ok"} />
        <Tile
          label="Live questions"
          value={String(stats.questions.length)}
          hint={<span className={guardrail > 0 ? "font-medium text-amber-700 dark:text-amber-300" : ""}>{guardrail} guardrail</span>}
        />
      </dl>
    </section>
  );
}

function Tile({ label, value, hint, tone = "ok" }: { label: string; value: string; hint: React.ReactNode; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-amber-700 dark:text-amber-300" : "text-slate-900 dark:text-slate-50"}`}>
        {value}
      </dd>
      <dd className="mt-0.5 text-[11px] text-slate-500">{hint}</dd>
    </div>
  );
}
