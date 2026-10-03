"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Scoreboard as Board, WorkMap } from "@understudy/shared";

interface ScoreResult { scoreboard: Board; tutor: { case: string; trap: boolean; caught: boolean | null; false_alarm: boolean }[]; }
import { useFlag } from "@/lib/flags";
import { groundTruth, screenEvents } from "@/lib/session";
import { sessionStats } from "@/lib/stats";
import { card, eyebrow } from "@/components/ui/styles";
import { auditHeaders } from "@/lib/audit";

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
      headers: { "content-type": "application/json", ...auditHeaders() },
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
  const pending = !b; // scored on the server; "…" means not loaded yet, never a fabricated number

  return (
    <section aria-label="Scoreboard" className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={eyebrow}>Scoreboard</h2>
        {pending && <span className="text-note text-ink-tertiary" aria-live="polite">Scoring against the answer key…</span>}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
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
          hint={<span className={guardrail > 0 ? "font-medium text-warning-ink" : ""}>{guardrail} guardrail</span>}
        />
      </dl>
    </section>
  );
}

function Tile({ label, value, hint, tone = "ok" }: { label: string; value: string; hint: React.ReactNode; tone?: "ok" | "warn" }) {
  const pending = value === "…";
  return (
    <div className={`${card} min-w-0 px-5 py-4`}>
      <dt className="text-meta text-ink-secondary">{label}</dt>
      {pending ? (
        <dd className="mt-1 flex h-10 items-center text-sub text-ink-tertiary" aria-label="Not scored yet">
          —
        </dd>
      ) : (
        <dd className={`mt-1 text-metric tabular-nums ${tone === "warn" ? "text-warning-ink" : "text-ink"}`}>{value}</dd>
      )}
      <dd className="mt-0.5 text-note text-ink-tertiary">{pending ? "not scored yet" : hint}</dd>
    </div>
  );
}
