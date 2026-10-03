"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { ScreenEvent, ScreenState, WorkMap } from "@understudy/shared";
import { startCapture, type CaptureHandle } from "@understudy/engine";
import { ApprenticeVoiceProvider, useApprenticeAgent, type ApprenticeAgent } from "@understudy/voice";
import { resetSession, screenEvents, sessionT } from "@/lib/session";
import { sessionStats } from "@/lib/stats";
import { useFlag } from "@/lib/flags";
import { useInterviewLoop } from "@/lib/useInterviewLoop";
import { rebuildWorkMap, useWorkMap } from "@/lib/workmap";
import DiscoveryReview, { type Discovered } from "@/components/DiscoveryReview";
import { banner, btn, card, emptyBox, eyebrow, field, link, pill } from "@/components/ui/styles";
import { auditHeaders, logAudit } from "@/lib/audit";
import { putFrame } from "@/lib/frames";

/** Live feed of what the apprentice saw on screen, plus the voice agent. */
interface PanelProps { jobId: string; escalateTo: string; expert?: string; screenFields?: number; }

export default function ApprenticePanel({ jobId, escalateTo, expert = "Aarav", screenFields = 0 }: PanelProps) {
  return (
    <ApprenticeVoiceProvider>
      <Panel jobId={jobId} escalateTo={escalateTo} expert={expert} screenFields={screenFields} />
    </ApprenticeVoiceProvider>
  );
}

function Panel({ jobId, escalateTo, expert, screenFields }: Required<PanelProps>) {
  const events = useSyncExternalStore(screenEvents.subscribe, screenEvents.all, noEvents);
  const map = useWorkMap(jobId, expert);
  const briefing = useBriefing(jobId);
  const screenRef = useRef<ScreenState | null>(null);
  const [found, setFound] = useState<Discovered | null>(null);
  const discovering = useRef(false);
  const discoveredOnce = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const capture = useRef<CaptureHandle | null>(null);
  const latestFrame = useRef<string | null>(null); // last frame sent to vision; becomes the thumbnail for its events
  const discoverNext = useRef(false); // "Watch another app": run discovery on the new share's first frame
  const [otherApp, setOtherApp] = useState(false);
  const agentRef = useRef<ApprenticeAgent | null>(null);

  const history = () => ({ jobId, expert, events: screenEvents.all(), transcript: agentRef.current?.transcript ?? [] });

  const agent = useApprenticeAgent("interviewer", {
    expert,
    escalateTo,
    workMap: map,
    briefing,
    now: sessionT,
    onError: setError,
    // Expert said yes to the teach-back: rebuild with every correction, then confirm so rules enforce.
    onTeachBackConfirmed: () => {
      rebuildWorkMap({ ...history(), confirm: true }).catch(() => setError("Could not confirm the Work Map"));
    },
  });
  useEffect(() => {
    agentRef.current = agent;
  });

  useEffect(() => () => capture.current?.stop(), []);

  const inDebrief = agent.debrief !== "idle";
  // Only rules this expert actually taught (or confirmed); unconfirmed industry-standard rules live on the Work Map page.
  const learned = map?.rules.filter((r) => r.source !== "baseline" || r.confirmed) ?? [];
  const offRecord = agent.offRecord;
  const offRecordRef = useRef(false);
  const offRecordEnabled = useFlag("offRecord");

  // Voice owns the off-the-record state (button or the expert saying it). Mirror it into the timeline gaps.
  useEffect(() => {
    if (offRecordRef.current !== offRecord) logAudit(offRecord ? "off_record_start" : "off_record_end", { t: sessionT() }, "expert");
    offRecordRef.current = offRecord;
    if (offRecord) {
      capture.current?.pause(); // off the record: no frames leave the browser
      latestFrame.current = null; // and none are kept as thumbnails
    } else capture.current?.resume();
    const t = sessionT();
    sessionStats.update(jobId, (st) => {
      const open = st.offRecord.find((w) => w.end === null);
      if (offRecord && !open) return { ...st, offRecord: [...st.offRecord, { start: t, end: null }] };
      if (!offRecord && open) return { ...st, offRecord: st.offRecord.map((w) => (w.end === null ? { ...w, end: t } : w)) };
      return st;
    });
  }, [offRecord, jobId]);

  const toggleOffRecord = () => agent.sendContext({ kind: "off_record", on: !offRecord });
  const loop = useInterviewLoop({
    agent, active: watching && !inDebrief && !offRecord, jobId, expert, now: sessionT, screen: () => screenRef.current,
  });

  /** App discovery: learn the layout from one frame (first share for a job with no screen map, or on demand). */
  async function discover(frame: string | null | undefined) {
    if (!frame || discovering.current) return;
    discovering.current = true;
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "content-type": "application/json", ...auditHeaders() },
        body: JSON.stringify({ job_id: jobId, frame_jpeg_base64: frame }),
      });
      if (res.ok) setFound((await res.json()) as Discovered);
    } catch {
      /* discovery is optional */
    } finally {
      discovering.current = false;
    }
  }

  async function startDebrief() {
    setPreparing(true);
    setError(null);
    capture.current?.stop(); // capture is over; the debrief is a conversation
    capture.current = null;
    setWatching(false);
    try {
      const fresh = (await rebuildWorkMap(history())) ?? map ?? emptyMap(jobId, expert);
      agent.sendContext({ kind: "start_debrief", gaps: fresh.open_gaps, map: fresh });
    } catch {
      setError("Could not build the Work Map for the debrief");
    } finally {
      setPreparing(false);
    }
  }

  /** Frame and result handlers shared by the first share and "Watch another app". */
  function captureHandlers(): Parameters<typeof startCapture>[0] {
    return {
      onFrame: (frame) => {
        if (offRecordRef.current) {
          latestFrame.current = null;
          return;
        }
        latestFrame.current = frame;
        if (discoverNext.current || (screenFields === 0 && !discoveredOnce.current)) {
          discoverNext.current = false;
          discoveredOnce.current = true;
          void discover(frame);
        }
      },
      onResult: (r) => {
        if (offRecordRef.current) return; // off the record: nothing is kept or forwarded
        screenRef.current = r.screen_state;
        // The frame these events came from becomes their screen moment's thumbnail (kept only in this browser).
        let frameId: string | undefined;
        const frame = latestFrame.current;
        if (r.events.length > 0 && frame) {
          const t = sessionT();
          frameId = `f_${t}`;
          void putFrame(jobId, frameId, frame, t);
        }
        for (const raw of r.events) {
          // One clock for events and transcript: stamp with the session time it arrived.
          const event = { ...raw, t: sessionT(), ...(frameId ? { frameId } : {}) };
          screenEvents.push(event);
          agentRef.current?.sendContext({ kind: "screen_event", event });
        }
      },
    };
  }

  async function start() {
    setError(null);
    if (screenEvents.all().length === 0) resetSession();
    try {
      capture.current = await startCapture(captureHandlers());
      setWatching(true);
      await agent.start();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  /** Any-app demo: share a different window or tab, learn its layout from the first frame, keep the session going. */
  async function watchAnother() {
    setError(null);
    try {
      const next = await startCapture(captureHandlers()); // the browser's picker: any window, tab or screen
      capture.current?.stop();
      capture.current = next;
      if (offRecordRef.current) next.pause();
      latestFrame.current = null;
      discoverNext.current = true;
      setFound(null);
      setOtherApp(true);
      setWatching(true);
    } catch (e) {
      // Picker dismissed: the current share keeps running.
      if (!isPermissionDenied(e instanceof Error ? e.message : String(e))) setError(e instanceof Error ? e.message : String(e));
    }
  }

  function stop() {
    capture.current?.stop();
    capture.current = null;
    setWatching(false);
    agent.stop();
  }

  const connected = agent.status === "connected";
  const connecting = agent.status === "connecting";
  const statusText = inDebrief
    ? agent.debrief === "confirmed" ? "Debrief done" : "Debrief in progress"
    : agent.isAgentSpeaking
    ? "Speaking"
    : connected
      ? watching ? "Watching and listening" : "Listening"
      : connecting
        ? "Connecting…"
        : watching ? "Watching (voice offline)" : "Not watching yet";

  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  const latestAgentLine = [...agent.transcript].reverse().find((l) => l.speaker === "agent") ?? null;
  const problem = error || agent.error;
  const denied = problem ? isPermissionDenied(problem) : false;

  return (
    <aside aria-label="ExpertAI apprentice" className={`${card} flex h-full flex-col overflow-hidden`}>
      {/* ---- fixed header block ---- */}
      <header className="border-b border-line px-5 pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={eyebrow}>Expert session</p>
            <h2 className="mt-0.5 text-card text-ink">ExpertAI</h2>
          </div>
          {watching || connected ? (
            <button type="button" onClick={stop} className={`${btn.secondary} ${btn.compact}`}>
              Stop session
            </button>
          ) : (
            <button type="button" onClick={start} className={`${btn.primary} ${btn.compact}`}>
              Start watching
            </button>
          )}
        </div>

        {/* status line + capture state (24.1): text, never a dot alone */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-meta text-ink-secondary" aria-live="polite">{statusText}</p>
          {watching && !offRecord && (
            <span className={pill.danger} role="status">
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              Recording screen and mic · <Elapsed running={watching} />
            </span>
          )}
          {!watching && connected && !offRecord && (
            <span className={pill.danger} role="status">
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              Mic on
            </span>
          )}
          {offRecord && (
            <span className={pill.danger} role="status">Off the record · nothing is kept</span>
          )}
          {connecting && <span className={pill.neutral}>Requesting mic access…</span>}
        </div>

        {/* gate chip: breathes only while the gate is open */}
        {watching && !offRecord && (
          <div className="mt-2 flex items-center gap-2">
            <span
              title="Gate: opens after 1.5s of quiet on input, speech, and screen"
              className={loop.gateOpen ? pill.success : pill.neutral}
            >
              <GateDot open={loop.gateOpen} />
              {loop.gateOpen ? "Quiet: ExpertAI may ask" : "Busy: holding questions"}
            </span>
          </div>
        )}

        {/* latest screen event + latest agent line, one line each */}
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

        {connected && !inDebrief && (
          <div className="mt-4 flex flex-wrap gap-2">
            {offRecordEnabled && (
              <button
                type="button"
                onClick={toggleOffRecord}
                aria-pressed={offRecord}
                className={`${offRecord ? btn.danger : btn.secondary} ${btn.compact}`}
              >
                {offRecord ? "Back on the record" : "Go off the record"}
              </button>
            )}
            <button
              type="button"
              onClick={startDebrief}
              disabled={preparing || offRecord}
              aria-busy={preparing}
              className={`${btn.primary} ${btn.compact} flex-1`}
            >
              {preparing ? "Preparing debrief…" : "Finish and debrief"}
            </button>
          </div>
        )}

        {problem && (
          <div role="alert" className={`${banner.danger} mt-3`}>
            <div className="min-w-0">
              <p className="font-medium">{denied ? "Screen share or microphone access was refused" : "Something went wrong"}</p>
              <p className="mt-1 text-meta">
                {denied
                  ? "Nothing was recorded. Allow screen sharing and the microphone in the browser's site settings, then choose Start watching again."
                  : problem}
              </p>
            </div>
          </div>
        )}
      </header>

      {/* ---- scrollable body ---- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {found && otherApp && (
          <p className={`${pill.info} mb-3`} role="status">Watching: another app</p>
        )}
        {found && (
          <DiscoveryReview
            jobId={jobId}
            found={found}
            onDone={() => {
              setFound(null);
              window.location.reload(); // the page re-renders the fake app from the saved screen map
            }}
          />
        )}
        {inDebrief && <DebriefCard agent={agent} jobId={jobId} map={map} />}

        {loop.asked.length > 0 && (
          <section className="pb-6" aria-label="Questions asked">
            <p className={`${eyebrow} pb-3`}>Questions asked · {loop.asked.length}</p>
            <ol className="space-y-2">
              {[...loop.asked].reverse().map((q, i) => (
                <li key={i} className="rounded-md bg-info-surface px-3.5 py-2.5 text-body text-ink">
                  <span className="mr-2 text-note font-medium uppercase tracking-wider text-info-ink">ExpertAI asked</span>
                  {q.question}
                  {q.is_guardrail && <span className={`${pill.warning} ml-2`}>guardrail</span>}
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="flex items-center justify-between gap-3 pb-3">
          <p className={eyebrow}>Screen events</p>
          {watching && !found && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={watchAnother}
                title="Share a different window or tab; ExpertAI learns its layout from the first frame"
                className="text-meta text-ink-secondary underline-offset-[0.15em] hover:text-link hover:underline"
              >
                Watch another app
              </button>
              <button
                type="button"
                onClick={() => discover(capture.current?.grab())}
                title="Learn this app's fields and buttons from the current frame"
                className={`${link} text-meta font-medium`}
              >
                Learn this app
              </button>
            </div>
          )}
        </div>
        {events.length === 0 ? (
          <div className={emptyBox}>
            <p className="text-body font-medium text-ink">No screen events yet</p>
            <p className="mt-1 text-meta text-ink-secondary">
              {watching ? "Events appear here as ExpertAI notices changes on the shared screen." : "Start watching to share your screen; changes show up here."}
            </p>
          </div>
        ) : (
          <ol className="space-y-2">
            {events
              .map((e, i) => <EventRow key={`${e.id}-${i}`} e={e} />)
              .reverse()}
          </ol>
        )}

        {learned.length > 0 && (
          <section className="pt-6" aria-label="Learned rules">
            <div className="flex items-center justify-between gap-3 pb-3">
              <p className={eyebrow}>Learned rules · {learned.length}</p>
              <Link href={`/workmap?job=${jobId}`} className={`${link} text-meta font-medium`}>
                Open Work Map
              </Link>
            </div>
            <ol className="space-y-2">
              {learned.map((r) => (
                <li key={r.id} className="rounded-md bg-surface-subtle px-3.5 py-2.5 text-body">
                  <p className="font-medium text-ink">{r.text}</p>
                  <p className="mt-1 text-meta text-ink-secondary">&ldquo;{r.reason_quote}&rdquo;</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {agent.transcript.length > 0 && (
          <section className="pt-6" aria-label="Conversation">
            <div className="flex items-center justify-between gap-3 pb-3">
              <p className={eyebrow}>Conversation</p>
              <span className="text-note text-ink-tertiary">ExpertAI lines are generated</span>
            </div>
            <ol className="space-y-2">
              {agent.transcript.slice(-8).map((l, i) => (
                <li
                  key={i}
                  className={`rounded-md px-3.5 py-2.5 text-body ${
                    l.speaker === "agent" ? "bg-info-surface text-ink" : "bg-surface-subtle text-ink"
                  }`}
                >
                  <span className="mr-2 text-note font-medium uppercase tracking-wider text-ink-secondary">
                    {l.speaker === "agent" ? "ExpertAI" : l.speaker.replace("_", " ")}
                  </span>
                  {l.text}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {/* ---- footer ---- */}
      {connected && <SayBox onSay={agent.say} />}
    </aside>
  );
}

/** The role briefing for this job (what ExpertAI already knows), fetched once; also synced to the agents' knowledge base. */
function useBriefing(jobId: string): string | null {
  const [briefing, setBriefing] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/briefing", { method: "POST", headers: { "content-type": "application/json", ...auditHeaders() }, body: JSON.stringify({ job_id: jobId }) })
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
const emptyMap = (job_id: string, expert: string) => ({ job_id, expert, steps: [], rules: [], open_gaps: [] });

/** Browser refused getDisplayMedia / getUserMedia (24.1 denied state). Presentation only. */
export const isPermissionDenied = (msg: string) => /notallowed|permission|denied|not allowed|dismissed/i.test(msg);

/** Gate indicator: breathes (scale 1 -> 1.15 -> 1, 1.8s) only while the gate is open; static otherwise and under reduced motion. */
function GateDot({ open }: { open: boolean }) {
  const reduce = useReducedMotion();
  const breathe = open && !reduce;
  return (
    <motion.span
      aria-hidden
      className="size-1.5 rounded-full bg-current"
      animate={breathe ? { scale: [1, 1.15, 1] } : { scale: 1 }}
      transition={breathe ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
    />
  );
}

/** Session clock for the recording indicator (24.1): tabular, fixed width so controls do not shift. */
function Elapsed({ running }: { running: boolean }) {
  const [t, setT] = useState(() => sessionT());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setT(sessionT()), 1000);
    return () => clearInterval(id);
  }, [running]);
  return <span className="inline-block min-w-[4ch] tabular-nums">{formatT(t)}</span>;
}

const formatT = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const PHASES = [
  { key: "asking", label: "Questions" },
  { key: "teach_back", label: "Teach-back" },
  { key: "confirmed", label: "Confirmed" },
] as const;

function DebriefCard({ agent, jobId, map }: { agent: ApprenticeAgent; jobId: string; map: WorkMap | null }) {
  const phaseIndex = PHASES.findIndex((p) => p.key === agent.debrief);
  const current = agent.debriefPlan[agent.debriefIndex];

  return (
    <section aria-label="Debrief" className="mb-6 rounded-lg border border-line bg-surface-subtle p-4">
      <ol className="flex flex-wrap items-center gap-2 text-note" aria-label="Debrief progress">
        {PHASES.map((p, i) => (
          <li key={p.key} className="flex items-center gap-2">
            <span
              aria-current={i === phaseIndex ? "step" : undefined}
              className={
                i < phaseIndex ? pill.success : i === phaseIndex ? `${pill.selected} bg-action text-on-action` : pill.outline
              }
            >
              {i < phaseIndex ? `${p.label} · done` : p.label}
            </span>
            {i < PHASES.length - 1 && <span aria-hidden className="text-ink-tertiary">›</span>}
          </li>
        ))}
      </ol>

      {agent.debrief === "asking" && current && (
        <div className="mt-4">
          <p className="text-meta text-ink-secondary">
            Question {agent.debriefIndex + 1} of {agent.debriefPlan.length}
            {current.is_guardrail && <span className={`${pill.warning} ml-2`}>guardrail</span>}
          </p>
          <p className="mt-1 text-body font-medium text-ink">{current.question}</p>
          <button type="button" onClick={agent.nextDebriefQuestion} className={`${btn.tertiary} ${btn.compact} mt-2 -ml-3`}>
            Skip to next question
          </button>
        </div>
      )}

      {agent.debrief === "teach_back" && (
        <div className="mt-4">
          <p className="text-meta text-ink-secondary">ExpertAI explains it back. Say &ldquo;yes&rdquo; to confirm, or correct it.</p>
          {agent.teachBack ? (
            <p className="mt-2 rounded-md bg-surface px-3.5 py-2.5 text-body leading-relaxed text-ink">
              <span className="mr-2 text-note font-medium uppercase tracking-wider text-ink-secondary">Generated summary</span>
              {agent.teachBack}
            </p>
          ) : (
            <p className="mt-2 text-body text-ink-secondary" aria-live="polite">Listening for the summary…</p>
          )}
        </div>
      )}

      {agent.debrief === "confirmed" && (
        <div className="mt-4">
          <p className="text-body font-medium text-success-ink">
            {map?.confirmed_at ? "Work Map confirmed. Rules are now enforced in new-hire mode." : "Confirming the Work Map…"}
          </p>
          <Link href={`/workmap?job=${jobId}`} className={`${link} mt-2 inline-block text-body font-medium`}>
            Open Work Map
          </Link>
        </div>
      )}
    </section>
  );
}

/** Type instead of talking, for noisy rooms. Goes to the agent and the transcript as the expert. */
function SayBox({ onSay }: { onSay: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSay(text.trim());
        setText("");
      }}
      className="flex items-end gap-2 border-t border-line px-4 py-3"
    >
      <label htmlFor="expert-say" className="sr-only">
        Type instead of talking
      </label>
      <input
        id="expert-say"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type instead of talking…"
        autoComplete="off"
        className={`${field} min-w-0 flex-1`}
      />
      <button type="submit" className={btn.secondary} disabled={!text.trim()}>
        Send
      </button>
    </form>
  );
}

export function EventRow({ e }: { e: ScreenEvent }) {
  return (
    <li className="rounded-md bg-surface-subtle px-3.5 py-2.5 text-body">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-ink">{e.type.replace(/_/g, " ")}</span>
        <span className="text-meta tabular-nums text-ink-tertiary">{(e.t / 1000).toFixed(1)}s</span>
      </div>
      {e.field && (
        <p className="mt-1 text-ink">
          {e.field}: <span className="text-ink-secondary">{String(e.from ?? "—")}</span> →{" "}
          <span className="font-medium">{String(e.to ?? "—")}</span>
        </p>
      )}
      {e.detail && <p className="mt-0.5 text-meta text-ink-secondary">{e.detail}</p>}
    </li>
  );
}
