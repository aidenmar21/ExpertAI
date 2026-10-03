"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { OpenGap, WorkMap } from "@understudy/shared";
import type { JobSummary } from "@/lib/job";
import { differsFromStandard, workMaps } from "@/lib/workmap";
import AuditLink from "@/components/AuditLink";
import { btn, card, emptyBox, eyebrow, page, pill } from "@/components/ui/styles";

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

/** Top chrome for pages outside a job: brand at left, Audit at right. */
export function PageChrome({ children }: { children?: React.ReactNode }) {
  return (
    <header className="ui-chrome sticky top-0 z-[100]" data-material="true">
      <nav aria-label="Primary" className="mx-auto flex min-h-16 w-full max-w-[90rem] items-center justify-between gap-4 px-5 sm:px-6 md:px-8">
        <Link href="/jobs" title="All jobs" className="rounded-sm text-card text-ink no-underline hover:text-link">
          ExpertAI
        </Link>
        <div className="flex items-center gap-2">
          {children}
          <AuditLink className="-mr-2" />
        </div>
      </nav>
    </header>
  );
}

export default function JobsDashboard({ jobs }: { jobs: JobSummary[] }) {
  const stats = useJobStats(jobs.map((j) => j.id));
  const needs = jobs.flatMap((j) => (stats[j.id]?.gaps ?? []).map((g) => ({ job: j, gap: g })));

  return (
    <div className="flex min-h-screen flex-col">
      <PageChrome />
      <main className={`${page} pb-16 pt-8`}>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className={eyebrow}>ExpertAI</p>
            <h1 className="mt-1 text-page text-ink">Jobs</h1>
            <p className="mt-2 max-w-[65ch] text-reading text-ink-secondary">
              One card per desk job. Every expert session adds confirmed rules and open gaps; new hires are coached from what the expert
              actually said.
            </p>
          </div>
          <Link href="/jobs/new" className={`${btn.primary} no-underline`}>
            New job
          </Link>
        </header>

        {jobs.length === 0 ? (
          <div className={`${emptyBox} mt-8 py-12`}>
            <p className="text-sub text-ink">No jobs yet</p>
            <p className="mx-auto mt-2 max-w-[48ch] text-body text-ink-secondary">Create one from a role ExpertAI already knows, or start blank.</p>
            <Link href="/jobs/new" className={`${btn.secondary} mt-5 no-underline`}>
              Create the first job
            </Link>
          </div>
        ) : (
          <section aria-label="Jobs" className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {jobs.map((j) => (
              <JobCard key={j.id} job={j} stats={stats[j.id] ?? EMPTY} />
            ))}
          </section>
        )}

        <section aria-labelledby="needs-title" className="mt-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="needs-title" className="text-section text-ink">Needs an expert</h2>
            <span className="text-meta text-ink-secondary">
              {needs.length === 0 ? "No open gaps" : `${needs.length} open ${needs.length === 1 ? "gap" : "gaps"}`}
            </span>
          </div>
          <p className="mt-1 max-w-[65ch] text-body text-ink-secondary">
            Cases nobody has covered yet. Open the job with the expert and the apprentice asks these first.
          </p>
          {needs.length === 0 ? (
            <div className={`${card} mt-4 px-5 py-6 text-body text-ink-secondary`}>
              Nothing waiting. Gaps appear here when a new hire hits a case the Work Map cannot answer, or when a session ends with an
              unanswered question.
            </div>
          ) : (
            <ul className={`${card} mt-4 divide-y divide-line overflow-hidden`}>
              {needs.map(({ job, gap }) => (
                <li key={`${job.id}:${gap.id}`}>
                  <Link
                    href={`/?job=${encodeURIComponent(job.id)}`}
                    className="flex min-h-16 items-center justify-between gap-4 px-5 py-3 no-underline transition-colors duration-150 ease-ui hover:bg-surface-hover"
                  >
                    <div className="min-w-0">
                      <p className="text-body text-ink">{gap.question}</p>
                      <p className="mt-1 text-meta text-ink-secondary">{job.name}</p>
                    </div>
                    <span className="shrink-0 text-meta font-medium text-link">Ask the expert</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function JobCard({ job, stats }: { job: JobSummary; stats: JobStats }) {
  const tools = job.software.map((s) => s.name);
  return (
    <Link
      href={`/?job=${encodeURIComponent(job.id)}`}
      className={`${card} group flex min-w-0 flex-col p-5 no-underline transition-[border-color,background-color] duration-150 ease-ui hover:border-line-control hover:bg-surface-hover/40 md:p-6`}
    >
      <div className="min-w-0">
        <h2 className="text-card text-ink">{job.name}</h2>
        <p className="mt-1 text-meta text-ink-secondary">{job.role?.name ?? `${job.category} (blank start)`}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={pill.neutral}>{job.category}</span>
        <span className="text-meta text-ink-tertiary">{tools.length ? tools.join(" · ") : "Software not set"}</span>
        {job.screen_fields === 0 && <span className={pill.warning}>Screen not mapped yet</span>}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
        <Stat label="Experts recorded" value={stats.experts} />
        <Stat label="Rules learned" value={stats.learned} />
        <Stat label="Differ from standard" value={stats.differs} tone="info" />
        <Stat label="Open gaps" value={stats.gaps.length} tone={stats.gaps.length ? "warn" : undefined} />
      </dl>

      <div className="mt-5">
        <div className="flex items-center justify-between text-meta">
          <span className="font-medium text-ink">Coverage</span>
          <span className="tabular-nums text-ink-secondary">{stats.coverage}%</span>
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-hover"
          role="meter"
          aria-label="Coverage"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stats.coverage}
        >
          <div className="h-full rounded-full bg-action transition-[width] duration-300 ease-ui" style={{ width: `${stats.coverage}%` }} />
        </div>
        <p className="mt-1.5 text-note text-ink-tertiary">Confirmed rules over confirmed plus unconfirmed standard rules.</p>
      </div>
    </Link>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "info" | "warn" }) {
  const color = tone === "warn" && value > 0 ? "text-warning-ink" : tone === "info" && value > 0 ? "text-info-ink" : "text-ink";
  return (
    <div className="min-w-0">
      <dd className={`text-sub tabular-nums ${color}`}>{value}</dd>
      <dt className="mt-0.5 text-note text-ink-secondary">{label}</dt>
    </div>
  );
}
