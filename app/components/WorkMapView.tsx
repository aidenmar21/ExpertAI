"use client";

import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Condition, Rule, RuleType, WorkMap } from "@understudy/shared";
import { differsFromStandard, useWorkMap, workMaps } from "@/lib/workmap";
import KnowledgeBox from "@/components/KnowledgeBox";
import { sessionStats } from "@/lib/stats";
import Scoreboard from "@/components/Scoreboard";
import { btn, card, emptyBox, eyebrow, page, pill } from "@/components/ui/styles";
import Provenance, { MomentThumb } from "@/components/Provenance";

/** Rule-type chips: semantic pairs only (danger / warning / info / neutral / success). */
const TYPE_STYLE: Record<RuleType, string> = {
  guardrail: pill.danger,
  limit: pill.warning,
  stop_and_ask: pill.info,
  exception: pill.neutral,
  judgment: pill.success,
};

const OP_WORDS: Record<Condition["op"], string> = {
  eq: "is", neq: "is not", gt: ">", gte: "≥", lt: "<", lte: "≤", in: "is one of", missing: "is missing", present: "is present",
};

export default function WorkMapView({ jobId, jobName }: { jobId: string; jobName: string }) {
  const map = useWorkMap(jobId);
  const differs = differsFromStandard(map);
  // A baseline rule a company rule matched is shown once, as the company rule with a "matches the standard" badge.
  const company = map ? map.rules.filter((r) => r.source !== "baseline" || (r.confirmed && !r.confirmed_by)) : [];
  const standard = map ? map.rules.filter((r) => r.source === "baseline" && !r.confirmed) : [];
  const matchesStandard = new Set(map?.rules.filter((r) => r.source === "baseline" && r.confirmed_by).map((r) => r.confirmed_by) ?? []);
  const stats = useSyncExternalStore(sessionStats.subscribe, () => sessionStats.get(jobId), () => sessionStats.get(jobId));
  const gaps = stats.offRecord;

  return (
    <main className={`${page} pb-16 pt-8`}>
      {/* ---- header ---- */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={eyebrow}>{jobName}{map?.expert ? ` · learned from ${map.expert}` : ""}</p>
          <h1 className="mt-1 text-page text-ink">Work Map</h1>
          <p className="mt-2 max-w-[65ch] text-reading text-ink-secondary">
            {map
              ? `At your company, ${differs} rule${differs === 1 ? "" : "s"} differ${differs === 1 ? "s" : ""} from the industry standard.`
              : "Rules in the expert's own words, with the screen moment each one came from."}
          </p>
        </div>
        {map && (
          <div className="flex flex-wrap items-center gap-3">
            <span className={map.confirmed_at ? pill.success : pill.outline}>
              {map.confirmed_at ? `Confirmed ${new Date(map.confirmed_at).toLocaleTimeString()}` : "Not confirmed yet"}
            </span>
            <button
              type="button"
              onClick={() => confirm("Clear this Work Map? Every learned rule and step for this job will be removed.") && workMaps.set(jobId, null)}
              className={`${btn.dangerQuiet} ${btn.compact}`}
            >
              Clear Work Map
            </button>
          </div>
        )}
      </header>

      {!map ? (
        <div className={`${emptyBox} mt-10 py-12`}>
          <p className="text-sub text-ink">No Work Map yet</p>
          <p className="mx-auto mt-2 max-w-[48ch] text-body text-ink-secondary">
            Start an expert session on the job screen, explain a few decisions, then finish with a debrief. The map appears here.
          </p>
          <Link href={`/?job=${jobId}`} className={`${btn.primary} mt-5 no-underline`}>
            Open expert mode
          </Link>
        </div>
      ) : (
        <>
          {/* ---- stat tiles, one row ---- */}
          <dl className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Steps" value={map.steps.length} />
            <Stat label="Company rules" value={company.length} />
            <Stat label="Industry standard" value={standard.length} />
            <Stat label="Open gaps" value={map.open_gaps.length} tone={map.open_gaps.length > 0 ? "warn" : "ok"} />
          </dl>

          <Scoreboard jobId={jobId} map={map} />

          {/* ---- two columns: timeline | rules ---- */}
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <section aria-labelledby="timeline-title" className="min-w-0">
              <h2 id="timeline-title" className={eyebrow}>Timeline</h2>
              {map.steps.length === 0 && gaps.length === 0 ? (
                <p className="mt-4 text-body text-ink-secondary">No steps captured in this session.</p>
              ) : (
                <ol className="relative mt-5 space-y-6 border-l border-line pl-7">
                  {timeline(map.steps, gaps).map((item) =>
                    item.kind === "gap" ? (
                      <OffRecordGap key={`gap-${item.start}`} start={item.start} end={item.end} />
                    ) : (
                      <StepItem key={item.step.n} s={item.step} />
                    ),
                  )}
                </ol>
              )}
            </section>

            <section aria-labelledby="rules-title" className="min-w-0">
              <h2 id="rules-title" className={eyebrow}>Rules, in the expert&rsquo;s words</h2>
              {company.length === 0 ? (
                <p className="mt-4 text-body text-ink-secondary">No company rules yet. Run an expert session, or write company knowledge below.</p>
              ) : (
                <ul className="mt-5 space-y-3">
                  {company.map((r) => (
                    <RuleCard key={r.id} rule={r} map={map} matchesStandard={matchesStandard.has(r.id)} />
                  ))}
                </ul>
              )}

              {standard.length > 0 && (
                <>
                  <h2 className={`${eyebrow} mt-10`}>Industry standard · confirm or override</h2>
                  <p className="mt-1 max-w-[65ch] text-meta text-ink-secondary">
                    What ExpertAI already knew about this role. Each one flips to a company rule when the expert confirms it, or is replaced when they do it differently.
                  </p>
                  <ul className="mt-4 space-y-3">
                    {standard.map((r) => (
                      <RuleCard key={r.id} rule={r} overriddenBy={r.overridden_by ? map.rules.find((x) => x.id === r.overridden_by) : undefined} />
                    ))}
                  </ul>
                </>
              )}

              {map.open_gaps.length > 0 && (
                <>
                  <h2 className={`${eyebrow} mt-10`}>Still unexplained</h2>
                  <ul className="mt-4 space-y-2">
                    {map.open_gaps.map((g) => (
                      <li key={g.id} className="rounded-md border border-dashed border-line px-4 py-3 text-body text-ink">
                        {g.question}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <KnowledgeBox jobId={jobId} />
        </>
      )}
    </main>
  );
}

/**
 * Collapsed by default: type chip, rule text, confirmed state. Click expands to the quote, when/then,
 * the screen moment thumbnail and a "Why do we believe this?" link. Company rules sit on an accent-tinted hairline with the
 * quote in the link colour; baseline rules are muted on a dashed hairline; overridden standard text is struck.
 */
function RuleCard({ rule, map, overriddenBy, matchesStandard }: { rule: Rule; map?: WorkMap; overriddenBy?: Rule; matchesStandard?: boolean }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const bodyId = useId();
  const baseline = rule.source === "baseline" && !rule.confirmed;
  const overridden = baseline && !!rule.overridden_by;
  const then = [
    ...Object.entries(rule.then.must ?? {}).map(([k, v]) => `${k} must be ${v}`),
    ...Object.entries(rule.then.must_not ?? {}).map(([k, v]) => `${k} must not be ${v}`),
    ...(rule.then.must_not_action ?? []).map((a) => `don't ${a.replace(/_/g, " ")}`),
    ...(rule.then.escalate_to ? [`ask ${rule.then.escalate_to}`] : []),
  ];
  const when = rule.when
    .map((c) => `${c.field} ${OP_WORDS[c.op]}${c.value == null ? "" : ` ${Array.isArray(c.value) ? c.value.join(", ") : c.value}`}`)
    .join(" and ");

  return (
    <li
      className={
        baseline
          ? "rounded-lg border border-dashed border-line bg-surface-subtle/60"
          : "rounded-lg border border-action/30 bg-surface"
      }
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 rounded-lg px-5 py-4 text-left transition-colors duration-150 ease-ui hover:bg-surface-hover/60"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className={TYPE_STYLE[rule.type]}>{rule.type.replace(/_/g, " ")}</span>
            {baseline && (
              <span className={pill.neutral}>{overridden ? "overridden at your company" : "industry standard · unconfirmed"}</span>
            )}
            {rule.source === "policy" && <span className={pill.info}>written</span>}
            {((rule.source === "baseline" && rule.confirmed) || matchesStandard) && <span className={pill.success}>matches the standard</span>}
            {rule.confirmed && <span className={pill.success}>Confirmed</span>}
          </span>
          <span className={`mt-2 block text-body font-medium ${baseline ? "text-ink-secondary" : "text-ink"} ${overridden ? "line-through decoration-ink-tertiary" : ""}`}>
            {rule.text}
          </span>
          {overridden && (
            <span className="mt-1 block text-meta text-ink-secondary">
              Here instead:{" "}
              <span className="font-medium text-ink">
                {overriddenBy ? overriddenBy.text : rule.override_quote ? `“${rule.override_quote}”` : "the expert does it differently"}
              </span>
            </span>
          )}
        </span>
        <Chevron open={open} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            key="body"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-line px-5 pb-5 pt-4">
              <blockquote
                className={`border-l-2 pl-3 text-body italic ${baseline ? "border-line text-ink-secondary" : "border-action text-link"}`}
              >
                &ldquo;{rule.reason_quote}&rdquo;
              </blockquote>
              <dl className="mt-4 grid gap-1.5 text-meta text-ink-secondary">
                {when && (
                  <div>
                    <dt className="inline font-medium text-ink">When </dt>
                    <dd className="inline">{when}</dd>
                  </div>
                )}
                {then.length > 0 && (
                  <div>
                    <dt className="inline font-medium text-ink">Then </dt>
                    <dd className="inline">{then.join("; ")}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-4 flex items-center gap-3">
                <MomentThumb moment={rule.screen_moment} />
                <div className="text-meta text-ink-secondary">
                  <p className="font-medium text-ink">Screen moment</p>
                  <p className="tabular-nums">
                    {formatT(rule.screen_moment.t)}
                    {rule.screen_moment.record ? ` · ${rule.screen_moment.record}` : ""}
                  </p>
                </div>
              </div>
              {map && !baseline && (
                <div className="mt-4">
                  <Provenance rule={rule} map={map} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`mt-1 size-4 shrink-0 text-ink-tertiary transition-transform duration-150 ease-ui ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Stat({ label, value, tone = "ok" }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div className={`${card} min-w-0 px-5 py-4`}>
      <dt className="text-meta text-ink-secondary">{label}</dt>
      <dd className={`mt-1 text-metric tabular-nums ${tone === "warn" ? "text-warning-ink" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

function StepItem({ s }: { s: WorkMap["steps"][number] }) {
  return (
    <li className="relative">
      <span aria-hidden className="absolute -left-[33px] top-1.5 size-3 rounded-full border-2 border-canvas bg-action" />
      <div className="flex gap-4">
        <MomentThumb moment={s.screen_moment} label={s.title} />
        <div className="min-w-0">
          <p className="text-meta tabular-nums text-ink-tertiary">
            {formatT(s.screen_moment.t)}
            {s.screen_moment.record ? ` · ${s.screen_moment.record}` : ""}
          </p>
          <p className="mt-0.5 text-body font-medium text-ink">{s.title}</p>
          <p className="text-body text-ink-secondary">{s.decision}</p>
          {s.rule_ids.length > 0 && (
            <p className="mt-1 text-meta text-success-ink">
              {s.rule_ids.length} rule{s.rule_ids.length > 1 ? "s" : ""} learned here
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function OffRecordGap({ start, end }: { start: number; end: number | null }) {
  return (
    <li className="relative">
      <span aria-hidden className="absolute -left-[33px] top-1.5 size-3 rounded-full border-2 border-canvas bg-danger-ink" />
      <div className="hatched-danger rounded-md border border-danger-ink/30 px-3.5 py-2.5 text-meta text-danger-ink">
        <span className="font-medium">Off the record</span> · {formatT(start)}–{end === null ? "now" : formatT(end)}. Nothing from this window was kept.
      </div>
    </li>
  );
}

type TimelineItem =
  | { kind: "step"; step: WorkMap["steps"][number]; t: number }
  | { kind: "gap"; start: number; end: number | null; t: number };

/** Steps and off-the-record gaps in one time order. */
function timeline(steps: WorkMap["steps"], gaps: { start: number; end: number | null }[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...steps.map((step) => ({ kind: "step" as const, step, t: step.screen_moment.t })),
    ...gaps.map((g) => ({ kind: "gap" as const, start: g.start, end: g.end, t: g.start })),
  ];
  return items.sort((a, b) => a.t - b.t);
}

const formatT = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
