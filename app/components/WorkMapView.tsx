"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { Condition, Rule, RuleType, WorkMap } from "@understudy/shared";
import { workMaps } from "@/lib/workmap";

const TYPE_STYLE: Record<RuleType, string> = {
  guardrail: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30",
  limit: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30",
  stop_and_ask: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/30",
  exception: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/30",
  judgment: "bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-400/30",
};

const OP_WORDS: Record<Condition["op"], string> = {
  eq: "is", neq: "is not", gt: ">", gte: "≥", lt: "<", lte: "≤", in: "is one of", missing: "is missing", present: "is present",
};

export default function WorkMapView({ jobId, jobName }: { jobId: string; jobName: string }) {
  const map = useSyncExternalStore(workMaps.subscribe, () => workMaps.get(jobId), noMap);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/?job=${jobId}`} className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-300">
            ← Back to {jobName}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">Work Map</h1>
          <p className="mt-1 text-sm text-slate-500">
            {jobName}
            {map?.expert ? ` · learned from ${map.expert}` : ""}
          </p>
        </div>
        {map && (
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                map.confirmed_at
                  ? "bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-400/30"
                  : "bg-slate-100 text-slate-600 ring-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
              }`}
            >
              {map.confirmed_at ? `Confirmed ${new Date(map.confirmed_at).toLocaleTimeString()}` : "Not confirmed yet"}
            </span>
            <button
              onClick={() => confirm("Clear this Work Map?") && workMaps.set(jobId, null)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {!map ? (
        <p className="mt-10 rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700">
          No Work Map yet. Start watching on the job screen, explain a few decisions, then finish with a debrief.
        </p>
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Steps" value={map.steps.length} />
            <Stat label="Rules" value={map.rules.length} />
            <Stat label="Guardrails" value={map.rules.filter((r) => r.type === "guardrail").length} />
            <Stat label="Open gaps" value={map.open_gaps.length} />
          </dl>

          <div className="mt-10 grid gap-10 lg:grid-cols-5">
            <section className="lg:col-span-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">Timeline</h2>
              {map.steps.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No steps captured.</p>
              ) : (
                <ol className="relative mt-4 space-y-6 border-l border-slate-200 pl-6 dark:border-slate-800">
                  {map.steps.map((s) => (
                    <li key={s.n} className="relative">
                      <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 ring-4 ring-slate-100 dark:ring-slate-950" />
                      <p className="text-xs tabular-nums text-slate-500">
                        {formatT(s.screen_moment.t)}
                        {s.screen_moment.record ? ` · ${s.screen_moment.record}` : ""}
                      </p>
                      <p className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{s.title}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{s.decision}</p>
                      {s.rule_ids.length > 0 && (
                        <p className="mt-1 text-xs text-teal-700 dark:text-teal-300">
                          {s.rule_ids.length} rule{s.rule_ids.length > 1 ? "s" : ""} learned here
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="lg:col-span-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">Rules, in the expert&rsquo;s words</h2>
              {map.rules.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No rules yet.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {map.rules.map((r) => (
                    <RuleCard key={r.id} rule={r} />
                  ))}
                </ul>
              )}

              {map.open_gaps.length > 0 && (
                <>
                  <h2 className="mt-10 text-xs font-medium uppercase tracking-wider text-slate-500">Still unexplained</h2>
                  <ul className="mt-4 space-y-2">
                    {map.open_gaps.map((g) => (
                      <li
                        key={g.id}
                        className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                      >
                        {g.question}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}

function RuleCard({ rule }: { rule: Rule }) {
  const then = [
    ...Object.entries(rule.then.must ?? {}).map(([k, v]) => `${k} must be ${v}`),
    ...Object.entries(rule.then.must_not ?? {}).map(([k, v]) => `${k} must not be ${v}`),
    ...(rule.then.must_not_action ?? []).map((a) => `don't ${a.replace(/_/g, " ")}`),
    ...(rule.then.escalate_to ? [`ask ${rule.then.escalate_to}`] : []),
  ];
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${TYPE_STYLE[rule.type]}`}>
          {rule.type.replace(/_/g, " ")}
        </span>
        {rule.confirmed && <span className="text-xs font-medium text-teal-700 dark:text-teal-300">✓ confirmed</span>}
        <span className="ml-auto text-xs tabular-nums text-slate-500">
          {formatT(rule.screen_moment.t)}
          {rule.screen_moment.record ? ` · ${rule.screen_moment.record}` : ""}
        </span>
      </div>
      <p className="mt-3 font-medium text-slate-900 dark:text-slate-100">{rule.text}</p>
      <blockquote className="mt-2 border-l-2 border-sky-400 pl-3 text-sm italic text-slate-600 dark:text-slate-300">
        &ldquo;{rule.reason_quote}&rdquo;
      </blockquote>
      <dl className="mt-3 grid gap-1 text-xs text-slate-500">
        {rule.when.length > 0 && (
          <div>
            <dt className="inline font-medium text-slate-600 dark:text-slate-400">When </dt>
            <dd className="inline">
              {rule.when
                .map((c) => `${c.field} ${OP_WORDS[c.op]}${c.value == null ? "" : ` ${Array.isArray(c.value) ? c.value.join(", ") : c.value}`}`)
                .join(" and ")}
            </dd>
          </div>
        )}
        {then.length > 0 && (
          <div>
            <dt className="inline font-medium text-slate-600 dark:text-slate-400">Then </dt>
            <dd className="inline">{then.join("; ")}</dd>
          </div>
        )}
      </dl>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">{value}</dd>
    </div>
  );
}

const noMap = (): WorkMap | null => null;
const formatT = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
