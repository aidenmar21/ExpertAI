"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ScreenEvent } from "@understudy/shared";
import { startCapture } from "@understudy/engine";
import { ApprenticeVoiceProvider, useApprenticeAgent } from "@understudy/voice";
import { screenEvents, sessionT } from "@/lib/session";

/** Live feed of what the apprentice saw on screen, plus the voice agent. */
export default function ApprenticePanel({ expert = "Aarav" }: { expert?: string }) {
  return (
    <ApprenticeVoiceProvider>
      <Panel expert={expert} />
    </ApprenticeVoiceProvider>
  );
}

function Panel({ expert }: { expert: string }) {
  const events = useSyncExternalStore(screenEvents.subscribe, screenEvents.all, noEvents);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const capture = useRef<{ stop(): void } | null>(null);

  const agent = useApprenticeAgent("interviewer", { expert, now: sessionT, onError: setError });
  const agentRef = useRef(agent);
  useEffect(() => {
    agentRef.current = agent;
  });

  useEffect(() => () => capture.current?.stop(), []);

  async function start() {
    setError(null);
    try {
      capture.current = await startCapture({
        onResult: (r) => {
          for (const event of r.events) {
            screenEvents.push(event);
            agentRef.current.sendContext({ kind: "screen_event", event });
          }
        },
      });
      setWatching(true);
      await agentRef.current.start();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function stop() {
    capture.current?.stop();
    capture.current = null;
    setWatching(false);
    agentRef.current.stop();
  }

  const connected = agent.status === "connected";
  const statusText = agent.isAgentSpeaking
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
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Apprentice</h2>
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
        <p className="mt-1 text-xs text-slate-500">{statusText}</p>
        {(error || agent.error) && (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error || agent.error}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <p className="pb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Screen events</p>
        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
            Events appear here as the apprentice notices changes.
          </p>
        ) : (
          <ol className="space-y-2">
            {events
              .map((e, i) => <EventRow key={`${e.id}-${i}`} e={e} />)
              .reverse()}
          </ol>
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
                    {l.speaker === "agent" ? "Apprentice" : l.speaker.replace("_", " ")}
                  </span>
                  {l.text}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </aside>
  );
}

const noEvents = (): ScreenEvent[] => [];

function EventRow({ e }: { e: ScreenEvent }) {
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
