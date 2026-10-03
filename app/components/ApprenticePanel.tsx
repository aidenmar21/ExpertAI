"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { ScreenEvent, WorkMap } from "@understudy/shared";
import { startCapture } from "@understudy/engine";
import { ApprenticeVoiceProvider, useApprenticeAgent, type ApprenticeAgent } from "@understudy/voice";
import { resetSession, screenEvents, sessionT } from "@/lib/session";
import { sessionStats } from "@/lib/stats";
import { useFlag } from "@/lib/flags";
import { useInterviewLoop } from "@/lib/useInterviewLoop";
import { rebuildWorkMap, workMaps } from "@/lib/workmap";

/** Live feed of what the apprentice saw on screen, plus the voice agent. */
interface PanelProps { jobId: string; escalateTo: string; expert?: string; }

export default function ApprenticePanel({ jobId, escalateTo, expert = "Aarav" }: PanelProps) {
  return (
    <ApprenticeVoiceProvider>
      <Panel jobId={jobId} escalateTo={escalateTo} expert={expert} />
    </ApprenticeVoiceProvider>
  );
}

function Panel({ jobId, escalateTo, expert }: Required<PanelProps>) {
  const events = useSyncExternalStore(screenEvents.subscribe, screenEvents.all, noEvents);
  const map = useSyncExternalStore(workMaps.subscribe, () => workMaps.get(jobId), noMap);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const capture = useRef<{ stop(): void } | null>(null);
  const agentRef = useRef<ApprenticeAgent | null>(null);

  const history = () => ({ jobId, expert, events: screenEvents.all(), transcript: agentRef.current?.transcript ?? [] });

  const agent = useApprenticeAgent("interviewer", {
    expert,
    escalateTo,
    workMap: map,
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
  const offRecord = agent.offRecord;
  const offRecordRef = useRef(false);
  const offRecordEnabled = useFlag("offRecord");

  // Voice owns the off-the-record state (button or the expert saying it). Mirror it into the timeline gaps.
  useEffect(() => {
    offRecordRef.current = offRecord;
    const t = sessionT();
    sessionStats.update(jobId, (st) => {
      const open = st.offRecord.find((w) => w.end === null);
      if (offRecord && !open) return { ...st, offRecord: [...st.offRecord, { start: t, end: null }] };
      if (!offRecord && open) return { ...st, offRecord: st.offRecord.map((w) => (w.end === null ? { ...w, end: t } : w)) };
      return st;
    });
  }, [offRecord, jobId]);

  const toggleOffRecord = () => agent.sendContext({ kind: "off_record", on: !offRecord });
  const loop = useInterviewLoop({ agent, active: watching && !inDebrief && !offRecord, jobId, expert, now: sessionT });

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

  async function start() {
    setError(null);
    if (screenEvents.all().length === 0) resetSession();
    try {
      capture.current = await startCapture({
        onResult: (r) => {
          if (offRecordRef.current) return; // off the record: nothing is kept or forwarded
          for (const raw of r.events) {
            // One clock for events and transcript: stamp with the session time it arrived.
            const event = { ...raw, t: sessionT() };
            screenEvents.push(event);
            agentRef.current?.sendContext({ kind: "screen_event", event });
          }
        },
      });
      setWatching(true);
      await agent.start();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function stop() {
    capture.current?.stop();
    capture.current = null;
    setWatching(false);
    agent.stop();
  }

  const connected = agent.status === "connected";
  const statusText = inDebrief
    ? agent.debrief === "confirmed" ? "Debrief done" : "Debrief in progress"
    : agent.isAgentSpeaking
    ? "Speaking"
    : connected
      ? watching ? "Watching and listening" : "Listening"
      : agent.status === "connecting"
        ? "Connecting…"
        : watching ? "Watching (voice offline)" : "Not watching yet";

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                agent.isAgentSpeaking
                  ? "animate-pulse bg-indigo-500"
                  : connected || watching
                    ? "bg-teal-500"
                    : "bg-slate-300 dark:bg-slate-600"
              }`}
            />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">ExpertAI</h2>
          </div>
          {watching || connected ? (
            <button
              onClick={stop}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={start}
              className="rounded-xl bg-sky-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-500"
            >
              Start watching
            </button>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">{statusText}</p>
          {offRecord && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30">
              Off the record
            </span>
          )}
          {watching && !offRecord && (
            <span
              title="Gate: opens after 1.5s of quiet on input, speech, and screen"
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                loop.gateOpen
                  ? "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {loop.gateOpen ? "Quiet: ExpertAI may ask" : "Busy: holding questions"}
            </span>
          )}
        </div>
        {connected && !inDebrief && (
          <div className="mt-3 flex gap-2">
            {offRecordEnabled && (
              <button
                onClick={toggleOffRecord}
                aria-pressed={offRecord}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  offRecord
                    ? "bg-rose-600 text-white shadow-sm hover:bg-rose-500"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {offRecord ? "Back on the record" : "Off the record"}
              </button>
            )}
            <button
              onClick={startDebrief}
              disabled={preparing || offRecord}
              className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {preparing ? "Preparing debrief…" : "Finish & debrief"}
            </button>
          </div>
        )}
        {(error || agent.error) && (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error || agent.error}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {inDebrief && <DebriefCard agent={agent} jobId={jobId} map={map} />}

        {loop.asked.length > 0 && (
          <section className="pb-6">
            <p className="pb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
              Questions asked · {loop.asked.length}
            </p>
            <ol className="space-y-2">
              {[...loop.asked].reverse().map((q, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 text-sm text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200"
                >
                  {q.question}
                  {q.is_guardrail && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      guardrail
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        <p className="pb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Screen events</p>
        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
            Events appear here as ExpertAI notices changes.
          </p>
        ) : (
          <ol className="space-y-2">
            {events
              .map((e, i) => <EventRow key={`${e.id}-${i}`} e={e} />)
              .reverse()}
          </ol>
        )}

        {map && map.rules.length > 0 && (
          <section className="pt-6">
            <div className="flex items-center justify-between pb-3">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Learned rules · {map.rules.length}
              </p>
              <Link href={`/workmap?job=${jobId}`} className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-300">
                Open Work Map →
              </Link>
            </div>
            <ol className="space-y-2">
              {map.rules.map((r) => (
                <li key={r.id} className="rounded-xl bg-teal-50/70 px-3 py-2.5 text-sm dark:bg-teal-500/10">
                  <p className="font-medium text-teal-900 dark:text-teal-200">{r.text}</p>
                  <p className="mt-1 text-xs italic text-slate-500">&ldquo;{r.reason_quote}&rdquo;</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {agent.transcript.length > 0 && (
          <>
            <p className="pb-3 pt-6 text-xs font-medium uppercase tracking-wider text-slate-500">Conversation</p>
            <ol className="space-y-2">
              {agent.transcript.slice(-8).map((l, i) => (
                <li
                  key={i}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    l.speaker === "agent"
                      ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-200"
                      : "bg-slate-50 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
                  }`}
                >
                  <span className="mr-1 text-xs font-medium uppercase text-slate-500">
                    {l.speaker === "agent" ? "ExpertAI" : l.speaker.replace("_", " ")}
                  </span>
                  {l.text}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      {connected && <SayBox onSay={agent.say} />}
    </aside>
  );
}

const EMPTY_EVENTS: ScreenEvent[] = [];
const noEvents = () => EMPTY_EVENTS;
const noMap = (): WorkMap | null => null;
const emptyMap = (job_id: string, expert: string): WorkMap => ({ job_id, expert, steps: [], rules: [], open_gaps: [] });

const PHASES = [
  { key: "asking", label: "Questions" },
  { key: "teach_back", label: "Teach-back" },
  { key: "confirmed", label: "Confirmed" },
] as const;

function DebriefCard({ agent, jobId, map }: { agent: ApprenticeAgent; jobId: string; map: WorkMap | null }) {
  const phaseIndex = PHASES.findIndex((p) => p.key === agent.debrief);
  const current = agent.debriefPlan[agent.debriefIndex];

  return (
    <section className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
      <ol className="flex items-center gap-2 text-xs">
        {PHASES.map((p, i) => (
          <li key={p.key} className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                i < phaseIndex
                  ? "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300"
                  : i === phaseIndex
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {p.label}
            </span>
            {i < PHASES.length - 1 && <span className="text-slate-300 dark:text-slate-600">›</span>}
          </li>
        ))}
      </ol>

      {agent.debrief === "asking" && current && (
        <div className="mt-4">
          <p className="text-xs text-slate-500">
            Question {agent.debriefIndex + 1} of {agent.debriefPlan.length}
            {current.is_guardrail && <span className="ml-2 font-medium text-amber-700 dark:text-amber-300">guardrail</span>}
          </p>
          <p className="mt-1 text-sm font-medium text-indigo-950 dark:text-indigo-100">{current.question}</p>
          <button
            onClick={agent.nextDebriefQuestion}
            className="mt-3 text-xs font-medium text-indigo-700 hover:underline dark:text-indigo-300"
          >
            Skip to next →
          </button>
        </div>
      )}

      {agent.debrief === "teach_back" && (
        <div className="mt-4">
          <p className="text-xs text-slate-500">ExpertAI explains it back. Say &ldquo;yes&rdquo; to confirm, or correct it.</p>
          {agent.teachBack ? (
            <p className="mt-2 rounded-xl bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {agent.teachBack}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Listening for the summary…</p>
          )}
        </div>
      )}

      {agent.debrief === "confirmed" && (
        <div className="mt-4">
          <p className="text-sm font-medium text-teal-800 dark:text-teal-300">
            {map?.confirmed_at ? "Work Map confirmed. Rules are now enforced in tutor mode." : "Confirming the Work Map…"}
          </p>
          <Link href={`/workmap?job=${jobId}`} className="mt-2 inline-block text-sm font-medium text-sky-700 hover:underline dark:text-sky-300">
            Open Work Map →
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
      className="flex gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800"
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type instead of talking…"
        className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
      <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
        Send
      </button>
    </form>
  );
}

export function EventRow({ e }: { e: ScreenEvent }) {
  return (
    <li className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800/60">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sky-700 dark:text-sky-300">{e.type.replace(/_/g, " ")}</span>
        <span className="text-xs tabular-nums text-slate-500">{(e.t / 1000).toFixed(1)}s</span>
      </div>
      {e.field && (
        <p className="mt-1 text-slate-700 dark:text-slate-200">
          {e.field}: <span className="text-slate-500">{String(e.from ?? "—")}</span> →{" "}
          <span className="font-medium">{String(e.to ?? "—")}</span>
        </p>
      )}
      <p className="mt-0.5 text-xs text-slate-500">{e.detail}</p>
    </li>
  );
}
