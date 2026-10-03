"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CheckResult, JobProfile, ScreenEvent, WorkMap } from "@understudy/shared";
import { checkAction } from "@understudy/brain";
import { detectStuck, startCapture } from "@understudy/engine";
import { ApprenticeVoiceProvider, useApprenticeAgent, type ApprenticeAgent } from "@understudy/voice";
import FakeApp from "@/components/FakeApp";
import { EventRow } from "@/components/ApprenticePanel";
import type { ClientJob, JobRecord } from "@/lib/job";
import { activity, screenEvents, sessionT } from "@/lib/session";
import { workMaps } from "@/lib/workmap";

const STUCK_TICK_MS = 1000;

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
  const map = useSyncExternalStore(workMaps.subscribe, () => workMaps.get(jobId), noMap);
  const expert = map?.expert || "The expert";
  const [blocked, setBlocked] = useState<{ action: string; check: CheckResult } | null>(null);
  const [replay, setReplay] = useState(false);

  const agent = useApprenticeAgent("tutor", {
    expert,
    escalateTo: profile.job.escalate_to,
    workMap: map,
    now: sessionT,
    onReplayRequested: () => setReplay(true),
  });

  const confirmedRules = map?.rules.filter((r) => r.confirmed).length ?? 0;

  // Runs before every save. Not ok: block it, tell the tutor, offer the expert's moment.
  function beforeAction(action: string, record: JobRecord): boolean {
    if (!map) return true;
    const check = checkAction({ action, record }, map, { job: profile as unknown as JobProfile });
    if (check.ok) {
      if (blocked) agent.resolveGuardrail();
      setBlocked(null);
      return true;
    }
    setBlocked({ action, check });
    setReplay(false);
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
        <TutorPanel agent={agent} jobId={jobId} confirmedRules={confirmedRules} hasMap={!!map} />
      </div>
    </main>
  );
}

function TutorPanel({
  agent,
  jobId,
  confirmedRules,
  hasMap,
}: {
  agent: ApprenticeAgent;
  jobId: string;
  confirmedRules: number;
  hasMap: boolean;
}) {
  const events = useSyncExternalStore(screenEvents.subscribe, screenEvents.all, noEvents);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastHint, setLastHint] = useState<string | null>(null);
  const capture = useRef<{ stop(): void } | null>(null);
  const agentRef = useRef(agent);
  const lastInput = useRef(0);

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

  // Stuck detection: engine decides from the signals, the tutor offers help (voice throttles repeats).
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const a = agentRef.current;
      if (a.status !== "connected" || a.activeGuardrail) return;
      const now = sessionT();
      const openedAt = activity.recordOpenedAt();
      const result = detectStuck({
        msIdleWithRecordOpen: openedAt === null ? 0 : now - Math.max(openedAt, lastInput.current),
        backAndForthCount: activity.backAndForthCount(now),
        msHoveringAction: activity.hovering(now),
        hesitationWords: a.getHesitationWords(),
      });
      if (result.stuck && result.hint) {
        const outcome = a.sendContext({ kind: "stuck", hint: result.hint });
        if (outcome === "sent" || outcome === "queued") setLastHint(result.hint);
      }
    }, STUCK_TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  async function start() {
    setError(null);
    try {
      capture.current = await startCapture({
        onResult: (r) => {
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
              ? "Work Map not confirmed yet, so no rules are enforced"
              : `${confirmedRules} confirmed rule${confirmedRules > 1 ? "s" : ""} enforced`}
        </p>
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
        {lastHint && (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <span className="mr-1 text-xs font-medium uppercase">Looks stuck</span>
            {lastHint}
          </p>
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
                    {l.speaker === "agent" ? "Tutor" : "You"}
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
      <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">Paused before saving</p>
      <p className="mt-1 font-medium text-amber-950 dark:text-amber-100">
        {expert} would stop here before &ldquo;{actionLabel}&rdquo;.
      </p>
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

const noMap = (): WorkMap | null => null;
const EMPTY_EVENTS: ScreenEvent[] = [];
const noEvents = () => EMPTY_EVENTS;
const formatT = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
