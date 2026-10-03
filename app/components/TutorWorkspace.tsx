"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CheckResult, JobProfile, ScreenEvent, StuckSignals, Value, WorkMap } from "@understudy/shared";
import { checkAction } from "@understudy/brain";
import { detectStuck, startCapture, stuckScore } from "@understudy/engine";
import { ApprenticeVoiceProvider, useApprenticeAgent, type ApprenticeAgent } from "@understudy/voice";
import FakeApp from "@/components/FakeApp";
import { EventRow } from "@/components/ApprenticePanel";
import type { ClientJob, JobRecord } from "@/lib/job";
import { activity, screenEvents, sessionT } from "@/lib/session";
import { useWorkMap, workMaps } from "@/lib/workmap";
import { sessionStats } from "@/lib/stats";
import { flag } from "@/lib/flags";

const STUCK_TICK_MS = 1000;
const GUIDE_EVERY_MS = 45_000; // at most one stuck hint per 45s

/** POST /api/guide: the usual next step for the record on screen, from the pre-loaded role knowledge. */
interface Guide { hint: string; step: string; judgment?: string; guardrail?: string; speak: string }
/** What a later agent trains on: expertai:stuck-feedback:<job> in localStorage, append-only. */
interface StuckFeedbackSignals { idle_ms: number; back_and_forth: number; hover_ms: number; hesitation: number; since_help_ms: number; fields_touched: number }
interface StuckFeedback { t: number; signals: StuckFeedbackSignals; label: boolean }
interface ShownGuide { hint: string; step: string; judgment?: string; guardrail?: string; signals: StuckFeedbackSignals; t: number; vote: boolean | null }

/** New-hire mode: the fake app plus the tutor. Every action is checked against the confirmed Work Map first. */
export default function TutorWorkspace({ profile }: { profile: ClientJob }) {
  return (
    <ApprenticeVoiceProvider>
      <Tutor profile={profile} />
    </ApprenticeVoiceProvider>
  );
}

function Tutor({ profile }: { profile: ClientJob }) {
  const jobId = profile.job.id;
  const map = useWorkMap(jobId);
  const briefing = useTutorBriefing(jobId);
  const expert = map?.expert || "The expert";
  const [blocked, setBlocked] = useState<{ action: string; check: CheckResult } | null>(null);
  const [replay, setReplay] = useState(false);

  const agent = useApprenticeAgent("tutor", {
    expert,
    escalateTo: profile.job.escalate_to,
    workMap: map,
    briefing,
    now: sessionT,
    onReplayRequested: () => setReplay(true),
    // Neither a company rule nor the standard covers it: it becomes an open gap for the next expert session.
    onNewCase: (summary) => workMaps.addGap(jobId, { id: `gap-${Date.now()}`, question: `New hire case: ${summary}` }),
  });

  const confirmedRules = map?.rules.filter((r) => r.confirmed).length ?? 0;
  const standardRules = map?.rules.filter((r) => r.source === "baseline" && !r.confirmed && !r.overridden_by).length ?? 0;

  // Runs before every save. Not ok: block it, tell the tutor, offer the expert's moment.
  function beforeAction(action: string, record: JobRecord, caseIndex: number): boolean {
    if (!map) return true;
    const check = checkAction({ action, record }, map, { job: profile as unknown as JobProfile });
    if (check.ok) {
      if (blocked) agent.resolveGuardrail();
      setBlocked(null);
      return true;
    }
    setBlocked({ action, check });
    setReplay(false);
    sessionStats.update(jobId, (st) => ({ ...st, blocked: [...st.blocked, { caseIndex, action, t: sessionT() }] }));
    agent.sendContext({ kind: "guardrail_hit", check });
    return false;
  }

  function dismiss() {
    setBlocked(null);
    setReplay(false);
    agent.resolveGuardrail();
  }

  const label = (key: string) => profile.screen.actions.find((a) => a.key === key)?.label ?? key;

  const notice = blocked && (
    <GuardrailNotice
      expert={expert}
      actionLabel={label(blocked.action)}
      check={blocked.check}
      map={map}
      replay={replay}
      onReplay={() => setReplay(true)}
      onDismiss={dismiss}
    />
  );

  return (
    <main className="grid min-h-0 flex-1 grid-cols-1 gap-6 px-6 pb-6 lg:grid-cols-3">
      <div className="min-h-[32rem] lg:col-span-2">
        <FakeApp profile={profile} mode="new_hire" beforeAction={beforeAction} notice={notice} />
      </div>
      <div className="min-h-[24rem]">
        <TutorPanel agent={agent} jobId={jobId} confirmedRules={confirmedRules} standardRules={standardRules} hasMap={!!map} />
      </div>
    </main>
  );
}

function TutorPanel({
  agent,
  jobId,
  confirmedRules,
  standardRules,
  hasMap,
}: {
  agent: ApprenticeAgent;
  jobId: string;
  confirmedRules: number;
  standardRules: number;
  hasMap: boolean;
}) {
  const events = useSyncExternalStore(screenEvents.subscribe, screenEvents.all, noEvents);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<ShownGuide | null>(null);
  const [score, setScore] = useState(0);
  const capture = useRef<{ stop(): void } | null>(null);
  const agentRef = useRef(agent);
  const lastInput = useRef(0);
  const record = useRef<Record<string, Value>>({}); // latest screen_state.record from vision
  const lastGuideAt = useRef(-GUIDE_EVERY_MS);
  const lastHelpAt = useRef<number | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    agentRef.current = agent;
  });
  useEffect(() => () => capture.current?.stop(), []);

  useEffect(() => {
    const mark = () => (lastInput.current = sessionT());
    const types = ["keydown", "pointerdown", "input"] as const;
    types.forEach((t) => window.addEventListener(t, mark, { passive: true }));
    return () => types.forEach((t) => window.removeEventListener(t, mark));
  }, []);

  // Stuck detection: engine decides from the signals; /api/guide turns the record on screen into the usual next
  // step from the role knowledge; the tutor says it. At most one hint per 45s, never while a guardrail is active.
  useEffect(() => {
    if (!running || !flag("stuck")) return;
    const id = setInterval(() => {
      const a = agentRef.current;
      if (a.status !== "connected" || a.activeGuardrail) return;
      const now = sessionT();
      const openedAt = activity.recordOpenedAt();
      const signals: StuckSignals = {
        msIdleWithRecordOpen: openedAt === null ? 0 : now - Math.max(openedAt, lastInput.current),
        backAndForthCount: activity.backAndForthCount(now),
        msHoveringAction: activity.hovering(now),
        hesitationWords: a.getHesitationWords(),
      };
      const next = stuckScore(signals);
      setScore((prev) => (Math.abs(prev - next) < 0.05 ? prev : next));
      const result = detectStuck(signals);
      if (!result.stuck || !result.hint) return;
      if (inFlight.current || now - lastGuideAt.current < GUIDE_EVERY_MS) return;
      inFlight.current = true;
      lastGuideAt.current = now;
      const fieldsTouched = screenEvents.all().filter((e) => e.type === "field_changed" && (openedAt === null || e.t >= openedAt)).length;
      const summary: StuckFeedbackSignals = {
        idle_ms: signals.msIdleWithRecordOpen,
        back_and_forth: signals.backAndForthCount,
        hover_ms: signals.msHoveringAction?.ms ?? 0,
        hesitation: signals.hesitationWords,
        since_help_ms: lastHelpAt.current === null ? now : now - lastHelpAt.current,
        fields_touched: fieldsTouched,
      };
      fetchGuide(jobId, record.current, signals.msHoveringAction?.action, signals)
        .then((g) => {
          const b = agentRef.current;
          if (b.status !== "connected" || b.activeGuardrail) return;
          const speak = g?.speak || result.hint;
          const outcome = b.sendContext({ kind: "stuck", hint: speak });
          if (outcome === "sent" || outcome === "queued") {
            lastHelpAt.current = sessionT();
            setGuide({ hint: g?.hint || result.hint, step: g?.step ?? "", judgment: g?.judgment, guardrail: g?.guardrail, signals: summary, t: sessionT(), vote: null });
          }
        })
        .finally(() => {
          inFlight.current = false;
        });
    }, STUCK_TICK_MS);
    return () => clearInterval(id);
  }, [running, jobId]);

  function vote(label: boolean) {
    if (!guide) return;
    appendStuckFeedback(jobId, { t: guide.t, signals: guide.signals, label });
    setGuide({ ...guide, vote: label });
  }

  async function start() {
    setError(null);
    try {
      capture.current = await startCapture({
        onResult: (r) => {
          if (r.screen_state?.record) record.current = r.screen_state.record;
          for (const raw of r.events) {
            const event = { ...raw, t: sessionT() };
            screenEvents.push(event);
            agentRef.current.sendContext({ kind: "screen_event", event });
          }
        },
      });
      activity.recordOpened(sessionT());
      setRunning(true);
      await agent.start();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function stop() {
    capture.current?.stop();
    capture.current = null;
    setRunning(false);
    agent.stop();
  }

  const connected = agent.status === "connected";

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                agent.isAgentSpeaking ? "animate-pulse bg-indigo-500" : connected ? "bg-teal-500" : "bg-slate-300 dark:bg-slate-600"
              }`}
            />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Tutor</h2>
          </div>
          {running || connected ? (
            <button
              onClick={stop}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={start}
              disabled={!hasMap}
              className="rounded-xl bg-teal-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-50"
            >
              Start shift
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {!hasMap
            ? "No Work Map yet. Record the expert first."
            : confirmedRules === 0
              ? `No company rules confirmed yet; ${standardRules} industry-standard rules speak up when nothing else covers a case`
              : `${confirmedRules} company rule${confirmedRules > 1 ? "s" : ""} enforced, ${standardRules} industry-standard fallbacks`}
        </p>
        {running && (
          <div className="mt-2 flex items-center gap-3">
            <p className="text-xs font-medium text-sky-700 dark:text-sky-300">Ask ExpertAI anything about this job out loud.</p>
            {flag("stuck") && (
              <div
                className="ml-auto h-1 w-16 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                title={`Stuck score ${Math.round(score * 100)}%`}
                aria-label={`Stuck score ${Math.round(score * 100)} percent`}
              >
                <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${Math.round(score * 100)}%` }} />
              </div>
            )}
          </div>
        )}
        {!hasMap && (
          <Link href={`/?job=${jobId}`} className="mt-2 inline-block text-xs font-medium text-sky-700 hover:underline dark:text-sky-300">
            Go to expert mode →
          </Link>
        )}
        {(error || agent.error) && (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error || agent.error}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {guide && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">Looks stuck</p>
              <div className="flex items-center gap-1" aria-label="Was this hint right?">
                <FeedbackButton label="Helpful" active={guide.vote === true} onClick={() => vote(true)} up />
                <FeedbackButton label="Not helpful" active={guide.vote === false} onClick={() => vote(false)} />
              </div>
            </div>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">{guide.hint}</p>
            {guide.step && (
              <p className="mt-2 text-sm text-slate-800 dark:text-slate-200">
                <span className="font-medium">Usual next step: </span>
                {guide.step}
              </p>
            )}
            {guide.judgment && <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{guide.judgment}</p>}
            {guide.guardrail && (
              <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-medium">Keep in mind: </span>
                {guide.guardrail}
              </p>
            )}
            {guide.vote !== null && <p className="mt-2 text-xs text-slate-500">Thanks, noted.</p>}
          </div>
        )}

        {agent.newCases.length > 0 && (
          <section className="pb-6">
            <p className="pb-3 text-xs font-medium uppercase tracking-wider text-slate-500">New cases for the expert</p>
            <ul className="space-y-2">
              {agent.newCases.map((c, i) => (
                <li key={i} className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
                  {c}
                </li>
              ))}
            </ul>
          </section>
        )}

        {agent.transcript.length > 0 && (
          <section className="pb-6">
            <p className="pb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Conversation</p>
            <ol className="space-y-2">
              {agent.transcript.slice(-8).map((l, i) => (
                <li
                  key={i}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    l.speaker === "agent"
                      ? "bg-teal-50 text-teal-900 dark:bg-teal-500/10 dark:text-teal-200"
                      : "bg-slate-50 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
                  }`}
                >
                  <span className="mr-1 text-xs font-medium uppercase text-slate-500">
                    {l.speaker === "agent" ? "ExpertAI" : "You"}
                  </span>
                  {l.text}
                </li>
              ))}
            </ol>
          </section>
        )}

        <p className="pb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Screen events</p>
        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
            The tutor stays quiet on routine work.
          </p>
        ) : (
          <ol className="space-y-2">
            {events.map((e, i) => <EventRow key={`${e.id}-${i}`} e={e} />).reverse()}
          </ol>
        )}
      </div>
    </aside>
  );
}

function GuardrailNotice({
  expert,
  actionLabel,
  check,
  map,
  replay,
  onReplay,
  onDismiss,
}: {
  expert: string;
  actionLabel: string;
  check: CheckResult;
  map: WorkMap | null;
  replay: boolean;
  onReplay: () => void;
  onDismiss: () => void;
}) {
  const moment = check.screen_moment;
  const step = moment && map?.steps.find((s) => s.screen_moment.t === moment.t || (moment.record && s.screen_moment.record === moment.record));

  return (
    <div className="mx-6 mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
      <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
        {check.standard ? "Paused · industry standard" : "Paused before saving"}
      </p>
      <p className="mt-1 font-medium text-amber-950 dark:text-amber-100">
        {check.standard ? `Most people in this job would stop here before "${actionLabel}".` : `${expert} would stop here before "${actionLabel}".`}
      </p>
      {check.standard && (
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          This is the industry standard, not a rule {expert} gave. Check with your manager if unsure.
        </p>
      )}
      {check.rule && (
        <blockquote className="mt-2 border-l-2 border-amber-400 pl-3 text-sm italic text-amber-900 dark:text-amber-200">
          &ldquo;{check.rule.reason_quote}&rdquo;
        </blockquote>
      )}
      {check.rule?.then.escalate_to && (
        <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">This one goes to the {check.rule.then.escalate_to}.</p>
      )}

      {replay && moment && (
        <div className="mt-3 rounded-xl bg-white p-3 text-sm dark:bg-slate-900">
          <p className="text-xs font-medium uppercase tracking-wider text-sky-700 dark:text-sky-300">
            {expert}&rsquo;s moment · {formatT(moment.t)}
            {moment.record ? ` · ${moment.record}` : ""}
          </p>
          <p className="mt-1 text-slate-800 dark:text-slate-200">{step ? `${step.title}: ${step.decision}` : check.rule?.text}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!replay && moment && (
          <button
            onClick={onReplay}
            className="rounded-xl bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-500"
          >
            Show {expert}&rsquo;s moment
          </button>
        )}
        <button
          onClick={onDismiss}
          className="rounded-xl border border-amber-400 px-3 py-1.5 text-sm font-medium text-amber-900 transition hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/20"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function FeedbackButton({ label, active, onClick, up }: { label: string; active: boolean; onClick: () => void; up?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`rounded-lg p-1.5 transition ${
        active
          ? "bg-amber-200 text-amber-900 dark:bg-amber-500/30 dark:text-amber-100"
          : "text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-500/20"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-4 w-4 ${up ? "" : "rotate-180"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Z" />
        <path d="M7 11l4-7a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7" />
      </svg>
    </button>
  );
}

async function fetchGuide(jobId: string, record: Record<string, Value>, action: string | undefined, signals: StuckSignals): Promise<Guide | null> {
  try {
    const r = await fetch("/api/guide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ job_id: jobId, record, action, signals }),
    });
    return r.ok ? ((await r.json()) as Guide) : null;
  } catch {
    return null;
  }
}

function appendStuckFeedback(jobId: string, entry: StuckFeedback) {
  const key = `expertai:stuck-feedback:${jobId}`;
  try {
    const prev = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    localStorage.setItem(key, JSON.stringify([...(Array.isArray(prev) ? prev : []), entry]));
  } catch {
    // storage unavailable: feedback is best-effort
  }
}

function useTutorBriefing(jobId: string): string | null {
  const [briefing, setBriefing] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/briefing?job=${encodeURIComponent(jobId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { briefing?: string } | null) => {
        if (!cancelled && b?.briefing) setBriefing(b.briefing);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [jobId]);
  return briefing;
}
const EMPTY_EVENTS: ScreenEvent[] = [];
const noEvents = () => EMPTY_EVENTS;
const formatT = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
