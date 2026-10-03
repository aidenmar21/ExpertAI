"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { OpenGap, WorkMap } from "@understudy/shared";
import type { JobSummary } from "@/lib/job";
import { differsFromStandard, workMaps } from "@/lib/workmap";

interface JobStats {
  experts: number;
  learned: number;
  differs: number;
  coverage: number; // 0..100
  gaps: OpenGap[];
}

const EMPTY: JobStats = { experts: 0, learned: 0, differs: 0, coverage: 0, gaps: [] };

/** Everything the dashboard shows that lives in the browser (the Work Map store), per job. */
function statsFor(map: WorkMap | null): JobStats {
  if (!map) return EMPTY;
  const confirmed = map.rules.filter((r) => r.confirmed).length;
  const unconfirmedBaseline = map.rules.filter((r) => r.source === "baseline" && !r.confirmed).length;
  const taught = map.steps.length > 0 || map.rules.some((r) => r.confirmed && r.source !== "baseline");
  const denom = confirmed + unconfirmedBaseline;
  return {
    experts: taught ? 1 : 0,
    learned: confirmed,
    differs: differsFromStandard(map),
    coverage: denom ? Math.round((confirmed / denom) * 100) : 0,
    gaps: map.open_gaps,
  };
}

// Snapshot memo: useSyncExternalStore needs the same object back until the stored maps actually change.
let memo: { sig: string; value: Record<string, JobStats> } = { sig: "", value: {} };
const noStats = (): Record<string, JobStats> => memo.value;

function useJobStats(ids: string[]): Record<string, JobStats> {
  const key = ids.join("|");
  const snapshot = () => {
    const next: Record<string, JobStats> = {};
    for (const id of key ? key.split("|") : []) next[id] = statsFor(workMaps.get(id));
    const sig = `${key}\n${JSON.stringify(next)}`;
    if (memo.sig !== sig) memo = { sig, value: next };
    return memo.value;
  };
  return useSyncExternalStore(workMaps.subscribe, snapshot, noStats);
}

const card = "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";
const primaryBtn =
  "inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-500";

export default function JobsDashboard({ jobs }: { jobs: JobSummary[] }) {
  const stats = useJobStats(jobs.map((j) => j.id));
  const needs = jobs.flatMap((j) => (stats[j.id]?.gaps ?? []).map((g) => ({ job: j, gap: g })));

  return (
    <main className="mx-auto max-w-6xl px-6 pb-16 pt-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-sky-700 dark:text-sky-300">ExpertAI</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Jobs</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            One card per desk job. Every expert session adds confirmed rules and open gaps; new hires are coached from what the expert
            actually said.
          </p>
        </div>
        <Link href="/jobs/new" className={primaryBtn}>
          <span aria-hidden className="text-base leading-none">+</span>
          New job
        </Link>
      </header>

      {jobs.length === 0 ? (
        <div className={`${card} mt-8 p-10 text-center`}>
          <p className="text-base font-medium text-slate-800 dark:text-slate-100">No jobs yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create one from a role ExpertAI already knows, or start blank.</p>
          <Link href="/jobs/new" className={`${primaryBtn} mt-5`}>
            New job
          </Link>
        </div>
      ) : (
        <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} stats={stats[j.id] ?? EMPTY} />
          ))}
        </section>
      )}

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Needs an expert</h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {needs.length === 0 ? "No open gaps" : `${needs.length} open ${needs.length === 1 ? "gap" : "gaps"}`}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Cases nobody has covered yet. Open the job with the expert and the apprentice asks these first.
        </p>
        {needs.length === 0 ? (
          <div className={`${card} mt-4 px-5 py-6 text-sm text-slate-500 dark:text-slate-400`}>
            Nothing waiting. Gaps appear here when a new hire hits a case the Work Map cannot answer, or when a session ends with an
            unanswered question.
          </div>
        ) : (
          <ul className={`${card} mt-4 divide-y divide-slate-200 dark:divide-slate-800`}>
            {needs.map(({ job, gap }) => (
              <li key={`${job.id}:${gap.id}`}>
                <Link
                  href={`/?job=${encodeURIComponent(job.id)}`}
                  className="flex items-start justify-between gap-4 px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 dark:text-slate-100">{gap.question}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{job.name}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-sky-700 dark:text-sky-300">Ask the expert →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function JobCard({ job, stats }: { job: JobSummary; stats: JobStats }) {
  const tools = job.software.map((s) => s.name);
  return (
    <Link
      href={`/?job=${encodeURIComponent(job.id)}`}
      className={`${card} group flex flex-col p-6 transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md dark:hover:border-sky-700`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-50">{job.name}</h2>
          <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-400">{job.role?.name ?? `${job.category} (blank start)`}</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {job.category}
        </span>
      </div>

      <p className="mt-3 min-h-[1.25rem] text-xs text-slate-500 dark:text-slate-400">
        {tools.length ? tools.join(" · ") : "Software not set"}
        {job.screen_fields === 0 && <span className="ml-2 text-indigo-600 dark:text-indigo-300">Screen not mapped yet</span>}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
        <Stat label="Experts recorded" value={stats.experts} />
        <Stat label="Rules learned" value={stats.learned} />
        <Stat label="Differ from standard" value={stats.differs} tone="indigo" />
        <Stat label="Open gaps" value={stats.gaps.length} tone={stats.gaps.length ? "rose" : undefined} />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600 dark:text-slate-300">Coverage</span>
          <span className="tabular-nums text-slate-500 dark:text-slate-400">{stats.coverage}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400 transition-all" style={{ width: `${stats.coverage}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Confirmed rules over confirmed plus unconfirmed standard rules.</p>
      </div>
    </Link>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "indigo" | "rose" }) {
  const color =
    tone === "rose" && value > 0
      ? "text-rose-600 dark:text-rose-300"
      : tone === "indigo" && value > 0
        ? "text-indigo-600 dark:text-indigo-300"
        : "text-slate-900 dark:text-slate-50";
  return (
    <div>
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
