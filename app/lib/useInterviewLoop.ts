"use client";

import { useEffect, useRef, useState } from "react";
import type { QuestionPick, WorkMap } from "@understudy/shared";
import { gate } from "@understudy/engine";
import type { ApprenticeAgent } from "@understudy/voice";
import { screenEvents } from "@/lib/session";

const TICK_MS = 250;
const RECENT_EVENTS = 20;
const WORKMAP_DEBOUNCE_MS = 2000;

export interface AskedQuestion extends QuestionPick { t: number; }

/**
 * Step 2 loop: every 250ms run engine.gate(); when it is open and something new happened
 * (a screen event or an expert answer), ask /api/question for the one question worth asking
 * and hand it to the agent as ask_now. Keeps the Work Map fresh via /api/workmap.
 */
export function useInterviewLoop(opts: {
  agent: ApprenticeAgent;
  active: boolean;
  jobId: string;
  expert: string;
  now: () => number;
}) {
  const { agent, active, jobId, expert, now } = opts;
  const [gateOpen, setGateOpen] = useState(false);
  const [asked, setAsked] = useState<AskedQuestion[]>([]);
  const [map, setMap] = useState<WorkMap | null>(null);

  const agentRef = useRef(agent);
  const mapRef = useRef<WorkMap | null>(null);
  const lastInput = useRef(0);
  const lastScreenChange = useRef(0);
  const dirty = useRef(false);
  const inFlight = useRef(false);
  const askedKeys = useRef(new Set<string>());

  useEffect(() => {
    agentRef.current = agent;
    mapRef.current = map;
  });

  // Keyboard / mouse activity anywhere on the page.
  useEffect(() => {
    const mark = () => (lastInput.current = now());
    const types = ["keydown", "pointerdown", "pointermove", "wheel", "input"] as const;
    types.forEach((t) => window.addEventListener(t, mark, { passive: true }));
    return () => types.forEach((t) => window.removeEventListener(t, mark));
  }, [now]);

  // New screen events reset the screen-quiet timer and make a question worth checking.
  useEffect(
    () =>
      screenEvents.subscribe(() => {
        lastScreenChange.current = now();
        dirty.current = true;
      }),
    [now],
  );

  // A new expert line may answer the last question, so a follow-up becomes possible.
  const lastLine = agent.transcript[agent.transcript.length - 1];
  useEffect(() => {
    if (lastLine?.speaker === "expert") dirty.current = true;
  }, [lastLine]);

  // Rebuild the Work Map from the full history shortly after the expert speaks.
  const expertLines = agent.transcript.filter((l) => l.speaker === "expert").length;
  useEffect(() => {
    if (!active || expertLines === 0) return;
    const id = setTimeout(async () => {
      try {
        const res = await fetch("/api/workmap", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            job_id: jobId,
            expert,
            events: screenEvents.all(),
            transcript: agentRef.current.transcript,
            previous: mapRef.current ?? undefined,
          }),
        });
        if (res.ok) setMap((await res.json()) as WorkMap);
      } catch {
        /* keep the last map */
      }
    }, WORKMAP_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [active, expertLines, jobId, expert]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(async () => {
      const a = agentRef.current;
      const speech = a.getSpeechSignals();
      const t = now();
      const g = gate({
        msSinceInput: t - lastInput.current,
        isSpeaking: speech.isSpeaking,
        msSinceSpeech: speech.msSinceSpeech,
        msSinceScreenChange: t - lastScreenChange.current,
      });
      setGateOpen((prev) => (prev === g.open ? prev : g.open));
      if (!g.open || !dirty.current || inFlight.current || a.status !== "connected") return;

      dirty.current = false;
      inFlight.current = true;
      try {
        const res = await fetch("/api/question", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            job_id: jobId,
            recent: screenEvents.all().slice(-RECENT_EVENTS),
            transcript: a.transcript,
            map: mapRef.current ?? { job_id: jobId, expert, steps: [], rules: [], open_gaps: [] },
          }),
        });
        const pick = res.ok ? ((await res.json()) as QuestionPick | null) : null;
        const key = pick && `${pick.about_event_id}|${pick.question}`;
        if (pick && key && !askedKeys.current.has(key)) {
          askedKeys.current.add(key);
          agentRef.current.sendContext({ kind: "ask_now", pick });
          setAsked((qs) => [...qs, { ...pick, t: now() }]);
        }
      } catch {
        dirty.current = true; // retry on the next quiet tick
      } finally {
        inFlight.current = false;
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [active, jobId, expert, now]);

  return { gateOpen, asked, map };
}
