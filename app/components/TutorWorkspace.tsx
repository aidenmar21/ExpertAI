"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { CheckResult, JobProfile, ScreenEvent, StuckSignals, Value, WorkMap } from "@understudy/shared";
import { checkAction, nextStep, planWalkthrough, type ExpertDemo, type GuideStep } from "@understudy/brain";
import { detectStuck, startCapture, stuckScore } from "@understudy/engine";
import { ApprenticeVoiceProvider, useApprenticeAgent, type ApprenticeAgent } from "@understudy/voice";
import FakeApp from "@/components/FakeApp";
import GuideCursor from "@/components/GuideCursor";
import Walkthrough, { type WalkEvent } from "@/components/Walkthrough";
import { GuideBar, GuideMeButton, barBtn } from "@/components/GuideBar";
import { expertDemos } from "@/lib/keytrace";
import { EventRow, isPermissionDenied } from "@/components/ApprenticePanel";
import type { ClientJob, JobRecord } from "@/lib/job";
import { activity, screenEvents, sessionT } from "@/lib/session";
import { useWorkMap, workMaps } from "@/lib/workmap";
import { sessionStats } from "@/lib/stats";
import { flag } from "@/lib/flags";
import { auditHeaders, logAudit } from "@/lib/audit";
import { useStuckDetector } from "@/lib/useStuckDetector";
import { STUCK_DETECTOR_COPY, describeMeta, stuckAuditPayload } from "@/lib/stuckModel";
import { banner, btn, card, emptyBox, eyebrow, link, pill } from "@/components/ui/styles";
import { MomentThumb } from "@/components/Provenance";

const STUCK_TICK_MS = 1000;
const NO_DEMOS: ExpertDemo[] = [];
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
  const [showMe, setShowMe] = useState(false); // off until asked: the app stays clear; Guide me (or Show pointer) brings help
  const [open, setOpen] = useState<{ record: JobRecord; touched: string[]; expected: JobRecord; onScreen: JobRecord } | null>(null);
  const [walk, setWalk] = useState<GuideStep[] | null>(null);
  const initial = useRef(new Map<number, JobRecord>());
  // Fields the new hire has changed on this record: the guide moves past the expert's steps they've done.
  const onRecord = useCallback((r: JobRecord, i: number, expected: JobRecord, onScreen: JobRecord) => {
    if (!initial.current.has(i)) initial.current.set(i, r);
    const first = initial.current.get(i)!;
    setOpen({ record: r, touched: Object.keys(r).filter((k) => r[k] !== first[k]), expected, onScreen });
  }, []);
  const demos = useSyncExternalStore(expertDemos.subscribe, expertDemos.all, () => NO_DEMOS);

  const agent = useApprenticeAgent("tutor", {
    expert,
    escalateTo: profile.job.escalate_to,
    workMap: map,
    briefing,
    now: sessionT,
    onReplayRequested: () => setReplay(true),
    onShowMeRequested: () => showMeHow.current("voice"),
    // Asked out loud ("show me", "how do I…"): play the walkthrough even if the agent doesn't call the tool.
    onTranscript: (line) => {
      if (line.speaker === "new_hire" && /\b(show me|guide me|how do i|how do you|walk me through|what do i do)\b/i.test(line.text)) showMeHow.current("asked");
    },
    // Neither a company rule nor the standard covers it: it becomes an open gap for the next expert session.
    onNewCase: (summary) => workMaps.addGap(jobId, { id: `gap-${Date.now()}`, question: `New hire case: ${summary}` }),
  });

  // Show-me pointer: the next field or button for the open record, from the rules and the expert's own steps.
  const step = useMemo(
    () => (open ? nextStep({ ...open, map, job: profile as unknown as JobProfile, demos }) : null),
    [open, map, profile, demos],
  );

  // "Show me how": a drawn mouse plays the rest of this case through, then the pointer guide takes over.
  const showMeHow = useRef<(how: "button" | "voice" | "asked") => void>(() => {});
  useEffect(() => {
    showMeHow.current = (how) => {
      if (!open) return;
      const plan = planWalkthrough({ ...open, map, job: profile as unknown as JobProfile, demos });
      if (!plan.length) return;
      setWalk(plan);
      // The tutor gets the same steps, so it can talk the new hire through them while the mouse plays.
      agent.sendContext({ kind: "guide", steps: plan.map((p) => (p.value != null && p.target.kind === "field" ? `${p.say} (${p.value})` : p.say)) });
      logAudit("show_me_how", { how, steps: plan.length, from_expert: plan.filter((p) => p.path).length }, "new_hire");
    };
  }, [open, map, profile, demos, agent]);

  function toggleShowMe() {
    const on = !showMe;
    setShowMe(on);
    if (on && step) {
      agent.sendContext({ kind: "stuck", hint: step.why ? `${step.say} ${step.why}` : step.say });
      logAudit("show_me", { target: `${step.target.kind}:${step.target.key}`, source: step.source, rule_id: step.rule_id ?? null }, "new_hire");
    }
  }

  // Guide me reports each moment to the tutor agent, so it can see what is being guided and explain it.
  const [guideNow, setGuideNow] = useState<string | null>(null);
  const onGuideEvent = useCallback(
    (e: WalkEvent) => {
      if (!walk) return;
      const field = e.step.target.kind === "field" ? profile.screen.fields.find((f) => f.key === e.step.target.key) : undefined;
      const action = e.step.target.kind === "action" ? profile.screen.actions.find((a) => a.key === e.step.target.key) : undefined;
      const value = e.step.value != null && e.step.value !== "" ? String(e.step.value) : undefined;
      agent.sendContext({
        kind: "guide_progress",
        progress: {
          event: e.event,
          step: e.index + 1,
          total: walk.length,
          say: e.step.say,
          target: field?.label ?? action?.label,
          ...(value ? { value } : {}),
          ...(e.step.why ? { why: e.step.why } : {}),
          // What they typed goes to the tutor, except in fields marked PII (names, card numbers).
          ...(e.event === "wrong" ? { typed: field?.pii ? undefined : e.typed } : {}),
        },
      });
      const n = `Step ${e.index + 1} of ${walk.length}`;
      setGuideNow(
        e.event === "showing" ? `${n} · showing: ${e.step.say}`
        : e.event === "your_turn" ? `${n} · your turn: ${e.step.say}`
        : e.event === "wrong" ? `${n} · not quite yet. Check it against the slip.`
        : e.event === "finished" ? "Done! You did every step."
        : null,
      );
      if (e.event === "finished" || e.event === "stopped") logAudit("guide_me_end", { how: e.event, step: e.index + 1, steps: walk.length }, "new_hire");
    },
    [walk, profile, agent],
  );

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
    setShowMe(true);
    sessionStats.update(jobId, (st) => ({ ...st, blocked: [...st.blocked, { caseIndex, action, t: sessionT() }] }));
    agent.sendContext({ kind: "guardrail_hit", check });
    logAudit("tutor_intervention", {
      rule_id: check.rule?.id ?? null, action_blocked: action, case_index: caseIndex,
      standard: !!check.standard, said: check.explanation ?? null,
    }, "expertai");
    return false;
  }

  function dismiss() {
    setBlocked(null);
    setReplay(false);
    agent.resolveGuardrail();
  }

  const label = (key: string) => profile.screen.actions.find((a) => a.key === key)?.label ?? key;

  // The pause card slides in from the top and out again (AnimatePresence owns the exit).
  const notice = (
    <AnimatePresence initial={false}>
      {blocked && (
        <GuardrailNotice
          key="guardrail"
          expert={expert}
          actionLabel={label(blocked.action)}
          check={blocked.check}
          map={map}
          replay={replay}
          onReplay={() => setReplay(true)}
          onDismiss={dismiss}
        />
      )}
    </AnimatePresence>
  );

  return (
    <main className="mx-auto grid w-full max-w-[90rem] min-h-0 flex-1 grid-cols-1 gap-6 px-5 pb-6 pt-6 sm:px-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="flex min-h-[32rem] min-w-0 flex-col gap-3">
        <GuideBar
          title="Learn this case"
          status={
            walk
              ? (guideNow ?? "Follow the mouse. It shows each step, then waits while you do it.")
              : step
                ? <>Next: <span className="font-medium text-ink">{step.say}</span> Stuck? Press Guide me or ask the tutor.</>
                : "All done here. Pick the next case from the queue."
          }
        >
          {!walk && (
            <button type="button" onClick={toggleShowMe} aria-pressed={showMe} disabled={!step} className={showMe ? barBtn.quietOn : barBtn.quiet}>
              {showMe ? "Hide pointer" : "Show pointer"}
            </button>
          )}
          <GuideMeButton running={!!walk} disabled={!walk && !step} onClick={() => (walk ? setWalk(null) : showMeHow.current("button"))} />
        </GuideBar>
        <div className="min-h-0 flex-1">
          <FakeApp
            profile={profile}
            mode="new_hire"
            beforeAction={beforeAction}
            notice={notice}
            onRecord={onRecord}
            overlay={
              <>
                {walk && (
                  <Walkthrough
                    plan={walk}
                    expert={expert}
                    interactive
                    onEvent={onGuideEvent}
                    onDone={() => {
                      setWalk(null);
                      setGuideNow(null);
                      setShowMe(true);
                    }}
                  />
                )}
                <GuideCursor
                  step={showMe && !walk ? step : null}
                  expert={expert}
                  stepLabel={step?.source === "expert_demo" ? `Next step · how ${expert} did it` : "Next step"}
                  onClose={() => setShowMe(false)}
                />
              </>
            }
          />
        </div>
      </div>
      <div className="min-h-[24rem] min-w-0">
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
  // The stuck detector: a small neural network that decides WHEN to offer help (never what the rules are).
  const detector = useStuckDetector(jobId);
  const detectorRef = useRef(detector);

  useEffect(() => {
    agentRef.current = agent;
    detectorRef.current = detector;
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
      const fieldsTouched = screenEvents.all().filter((e) => e.type === "field_changed" && (openedAt === null || e.t >= openedAt)).length;
      const summary: StuckFeedbackSignals = {
        idle_ms: signals.msIdleWithRecordOpen,
        back_and_forth: signals.backAndForthCount,
        hover_ms: signals.msHoveringAction?.ms ?? 0,
        hesitation: signals.hesitationWords,
        since_help_ms: lastHelpAt.current === null ? now : now - lastHelpAt.current,
        fields_touched: fieldsTouched,
      };
      // Network probability once the model is ready; the rule score until then.
      const d = detectorRef.current;
      const next = d.ready ? d.probability(summary) : stuckScore(signals);
      setScore((prev) => (Math.abs(prev - next) < 0.05 ? prev : next));
      if (next < d.threshold) return;
      const result = detectStuck(signals);
      const hint = result.hint || "Looks like you're deciding on this one";
      if (inFlight.current || now - lastGuideAt.current < GUIDE_EVERY_MS) return;
      inFlight.current = true;
      lastGuideAt.current = now;
      logAudit("stuck", stuckAuditPayload(summary, next), "expertai");
      fetchGuide(jobId, record.current, signals.msHoveringAction?.action, signals)
        .then((g) => {
          const b = agentRef.current;
          if (b.status !== "connected" || b.activeGuardrail) return;
          const speak = g?.speak || hint;
          const outcome = b.sendContext({ kind: "stuck", hint: speak });
          if (outcome === "sent" || outcome === "queued") {
            lastHelpAt.current = sessionT();
            setGuide({ hint: g?.hint || hint, step: g?.step ?? "", judgment: g?.judgment, guardrail: g?.guardrail, signals: summary, t: sessionT(), vote: null });
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
    logAudit("stuck_feedback", stuckAuditPayload(guide.signals, score, label), "new_hire");
    void detector.retrain().catch(() => undefined); // learns from this vote in the background (well under 5s)
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
  const connecting = agent.status === "connecting";
  const statusText = !hasMap
    ? "No Work Map yet"
    : agent.isAgentSpeaking
      ? "Speaking"
      : connected
        ? running ? "Watching and listening" : "Listening"
        : connecting
          ? "Connecting…"
          : running ? "Watching (voice offline)" : "Ready to start a shift";

  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  const latestAgentLine = [...agent.transcript].reverse().find((l) => l.speaker === "agent") ?? null;
  const problem = error || agent.error;
  const denied = problem ? isPermissionDenied(problem) : false;

  return (
    <aside aria-label="Tutor" className={`${card} flex h-full flex-col overflow-hidden`}>
      {/* ---- fixed header block ---- */}
      <header className="border-b border-line px-5 pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={eyebrow}>New-hire shift</p>
            <h2 className="mt-0.5 text-card text-ink">Tutor</h2>
          </div>
          {running || connected ? (
            <button type="button" onClick={stop} className={`${btn.secondary} ${btn.compact}`}>
              End shift
            </button>
          ) : (
            <button type="button" onClick={start} disabled={!hasMap} className={`${btn.primary} ${btn.compact}`}>
              Start shift
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-meta text-ink-secondary" aria-live="polite">{statusText}</p>
          {running && (
            <span className={pill.danger} role="status">
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              Screen and mic captured
            </span>
          )}
          {connecting && <span className={pill.neutral}>Requesting mic access…</span>}
        </div>

        {/* rules-enforced line */}
        <p className="mt-2 text-meta text-ink-secondary">
          {!hasMap
            ? "Record the expert first; the tutor only enforces rules the expert confirmed."
            : confirmedRules === 0
              ? `No company rules confirmed yet; ${standardRules} industry-standard rules speak up when nothing else covers a case.`
              : `${confirmedRules} company rule${confirmedRules > 1 ? "s" : ""} enforced, ${standardRules} industry-standard fallback${standardRules === 1 ? "" : "s"}.`}
        </p>

        {running && (
          <div className="mt-2 flex items-center gap-3">
            <p className="text-meta text-ink">Ask ExpertAI anything about this job out loud.</p>
            {flag("stuck") && (
              <div
                className="ml-auto h-1 w-16 shrink-0 overflow-hidden rounded-full bg-surface-hover"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(score * 100)}
                title={`${STUCK_DETECTOR_COPY} ${Math.round(score * 100)}% (help at ${Math.round(detector.threshold * 100)}%)`}
                aria-label={`Stuck score ${Math.round(score * 100)} percent`}
              >
                <div className="h-full rounded-full bg-warning-ink transition-[width] duration-500 ease-ui" style={{ width: `${Math.round(score * 100)}%` }} />
              </div>
            )}
          </div>
        )}

        {running && flag("stuck") && (
          <details className="mt-2 text-meta text-ink-secondary">
            <summary className="cursor-pointer select-none">{STUCK_DETECTOR_COPY}</summary>
            <p className="mt-1">
              {detector.training ? "Training…" : describeMeta(detector.meta)}
              {detector.feedbackCount > 0 ? ` · ${detector.feedbackCount} votes so far` : ""}
            </p>
            <label className="mt-2 flex items-center gap-2">
              <span className="shrink-0">Offer help above</span>
              <input
                type="range" min={0.3} max={0.95} step={0.05} value={detector.threshold}
                onChange={(e) => detector.setThreshold(Number(e.target.value))}
                className="min-w-0 flex-1" aria-label="Stuck threshold"
              />
              <span className="w-10 text-right tabular-nums">{Math.round(detector.threshold * 100)}%</span>
            </label>
          </details>
        )}

        {(latestEvent || latestAgentLine) && (
          <dl className="mt-3 grid gap-1 text-meta">
            {latestEvent && (
              <div className="flex min-w-0 gap-2">
                <dt className="shrink-0 text-ink-tertiary">Screen</dt>
                <dd className="min-w-0 truncate text-ink-secondary">
                  {latestEvent.type.replace(/_/g, " ")}
                  {latestEvent.field ? ` · ${latestEvent.field}` : ""}
                  {latestEvent.detail ? ` · ${latestEvent.detail}` : ""}
                </dd>
              </div>
            )}
            {latestAgentLine && (
              <div className="flex min-w-0 gap-2">
                <dt className="shrink-0 text-ink-tertiary">ExpertAI</dt>
                <dd className="min-w-0 truncate text-ink-secondary">{latestAgentLine.text}</dd>
              </div>
            )}
          </dl>
        )}

        {!hasMap && (
          <Link href={`/?job=${jobId}`} className={`${link} mt-2 inline-block text-meta font-medium`}>
            Go to expert mode
          </Link>
        )}

        {problem && (
          <div role="alert" className={`${banner.danger} mt-3`}>
            <div className="min-w-0">
              <p className="font-medium">{denied ? "Screen share or microphone access was refused" : "Something went wrong"}</p>
              <p className="mt-1 text-meta">
                {denied
                  ? "Nothing was captured. Allow screen sharing and the microphone in the browser's site settings, then choose Start shift again."
                  : problem}
              </p>
            </div>
          </div>
        )}
      </header>

      {/* ---- scrollable body ---- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {guide && (
          <section aria-label="Stuck hint" className="mb-4 rounded-lg bg-warning-surface px-4 py-3 text-warning-ink">
            <div className="flex items-center justify-between gap-3">
              <p className={`${eyebrow} text-warning-ink`}>Looks stuck · generated hint</p>
              <div className="flex items-center gap-1" role="group" aria-label="Was this hint right?">
                <FeedbackButton label="Helpful" active={guide.vote === true} onClick={() => vote(true)} up />
                <FeedbackButton label="Not helpful" active={guide.vote === false} onClick={() => vote(false)} />
              </div>
            </div>
            <p className="mt-1 text-body">{guide.hint}</p>
            {guide.step && (
              <p className="mt-2 text-body text-ink">
                <span className="font-medium">Usual next step: </span>
                {guide.step}
              </p>
            )}
            {guide.judgment && <p className="mt-1.5 text-meta text-ink-secondary">{guide.judgment}</p>}
            {guide.guardrail && (
              <p className="mt-1.5 text-meta">
                <span className="font-medium">Keep in mind: </span>
                {guide.guardrail}
              </p>
            )}
            {guide.vote !== null && <p className="mt-2 text-meta text-ink-secondary" aria-live="polite">Thanks, noted.</p>}
          </section>
        )}

        <GuideFeed outbox={agent.outbox} connected={agent.status === "connected"} />

        {agent.newCases.length > 0 && (
          <section className="pb-6" aria-label="New cases for the expert">
            <p className={`${eyebrow} pb-3`}>New cases for the expert</p>
            <ul className="space-y-2">
              {agent.newCases.map((c, i) => (
                <li key={i} className="rounded-md border border-dashed border-line px-3.5 py-2.5 text-body text-ink">
                  {c}
                </li>
              ))}
            </ul>
          </section>
        )}

        {agent.transcript.length > 0 && (
          <section className="pb-6" aria-label="Conversation">
            <div className="flex items-center justify-between gap-3 pb-3">
              <p className={eyebrow}>Conversation</p>
              <span className="text-note text-ink-tertiary">ExpertAI lines are generated</span>
            </div>
            <ol className="space-y-2">
              {agent.transcript.slice(-8).map((l, i) => (
                <li
                  key={i}
                  className={`rounded-md px-3.5 py-2.5 text-body text-ink ${l.speaker === "agent" ? "bg-info-surface" : "bg-surface-subtle"}`}
                >
                  <span className="mr-2 text-note font-medium uppercase tracking-wider text-ink-secondary">
                    {l.speaker === "agent" ? "ExpertAI" : "You"}
                  </span>
                  {l.text}
                </li>
              ))}
            </ol>
          </section>
        )}

        <p className={`${eyebrow} pb-3`}>Screen events</p>
        {events.length === 0 ? (
          <div className={emptyBox}>
            <p className="text-body font-medium text-ink">Nothing to show yet</p>
            <p className="mt-1 text-meta text-ink-secondary">
              {running ? "The tutor stays quiet on routine work; changes it notices appear here." : "Start a shift to share your screen with the tutor."}
            </p>
          </div>
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
  const reduce = useReducedMotion();
  const moment = check.screen_moment;
  const step = moment && map?.steps.find((s) => s.screen_moment.t === moment.t || (moment.record && s.screen_moment.record === moment.record));

  return (
    <motion.div
      role="alert"
      aria-labelledby="guardrail-title"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
      transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
      className="mx-4 mb-3 rounded-md bg-warning-surface p-4 text-warning-ink"
    >
      <p className={`${eyebrow} text-warning-ink`}>{check.standard ? "Paused · industry standard" : "Paused before saving"}</p>
      <p id="guardrail-title" className="mt-1 text-body font-medium">
        {check.standard ? `Most people in this job would stop here before "${actionLabel}".` : `${expert} would stop here before "${actionLabel}".`}
      </p>
      {check.standard && (
        <p className="mt-1 text-meta">This is the industry standard, not a rule {expert} gave. Check with your manager if unsure.</p>
      )}
      {check.rule && (
        <blockquote className="mt-2 border-l-2 border-current/40 pl-3 text-body italic">&ldquo;{check.rule.reason_quote}&rdquo;</blockquote>
      )}
      {check.rule?.then.escalate_to && <p className="mt-2 text-body">This one goes to the {check.rule.then.escalate_to}.</p>}

      {replay && moment && (
        <div className="mt-3 rounded-md bg-surface p-3 text-body text-ink">
          <div className="flex items-start gap-3">
            <MomentThumb moment={moment.frameId ? moment : { ...moment, frameId: step?.screen_moment.frameId }} label={`${expert}'s moment`} />
            <div className="min-w-0">
              <p className={eyebrow}>
                {expert}&rsquo;s moment · {formatT(moment.t)}
                {moment.record ? ` · ${moment.record}` : ""}
              </p>
              <p className="mt-1">{step ? `${step.title}: ${step.decision}` : check.rule?.text}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!replay && moment && (
          <button type="button" onClick={onReplay} className={`${btn.primary} ${btn.compact}`}>
            Show {expert}&rsquo;s moment
          </button>
        )}
        <button type="button" onClick={onDismiss} className={`${btn.secondary} ${btn.compact}`}>
          Got it
        </button>
      </div>
    </motion.div>
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
      className={`inline-flex size-11 items-center justify-center rounded-sm transition-colors duration-150 ease-ui pointer-fine:size-9 ${
        active ? "bg-warning-ink/15 text-warning-ink" : "text-warning-ink hover:bg-warning-ink/10"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`size-5 ${up ? "" : "rotate-180"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
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
      headers: { "content-type": "application/json", ...auditHeaders() },
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

/** What Guide me told the tutor agent, newest first: proof the tutor can see what is being guided. */
function GuideFeed({ outbox, connected }: { outbox: ApprenticeAgent["outbox"]; connected: boolean }) {
  const lines = outbox.filter((o) => o.text.startsWith("[GUIDE")).slice(-6).reverse();
  if (!lines.length) return null;
  return (
    <section className="pb-6" aria-label="What the tutor sees from the guide">
      <p className={`${eyebrow} pb-2`}>Tutor is following the guide {connected ? "· live" : "· start the shift to have it explain"}</p>
      <ol className="space-y-1.5">
        {lines.map((o) => (
          <li key={o.id} className="rounded-md border border-line bg-surface-subtle px-3 py-2 text-[13px] leading-5 text-ink">
            {o.text.split("\n")[0].replace(/ (Explain this step|Gently point out|Say well done|Stay quiet|You will get).*$/, "")}
            <span className="ml-2 text-note text-ink-tertiary">{o.delivery === "turn" ? "tutor explains" : "background"} · {o.outcome}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
