"use client";
// useApprenticeAgent: the ElevenLabs interviewer / tutor agent, as one hook.
// Requires an <ApprenticeVoiceProvider> (ElevenLabs ConversationProvider) ancestor.
import { useCallback, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import type { MessagePayload } from "@elevenlabs/react";
import type { AgentContextMessage, TranscriptLine } from "../shared/contracts";
import {
  type AgentMode,
  asksForConfirmation,
  countHesitations,
  deliveryFor,
  detectRecordToggle,
  formatContext,
  isAffirmative,
  isOwnContextEcho,
} from "./format";

export type DebriefPhase = "idle" | "asking" | "teach_back" | "confirmed";

export interface ApprenticeAgentOptions {
  /** Expert's name, used in tutor lines ("Aarav would stop here"). */
  expert?: string;
  /** App route returning a WebRTC conversation token for ?mode=. Default "/api/voice/token". */
  tokenEndpoint?: string;
  /** Public agent id. If set, connects directly and skips the token route. */
  agentId?: string;
  /** Session clock in ms, shared with engine so transcript t lines up with ScreenEvent.t. Default: ms since start(). */
  now?: () => number;
  /** Every final transcript line (expert / new hire / agent). off_record lines are flagged, not dropped. */
  onTranscript?: (line: TranscriptLine) => void;
  onOffRecordChange?: (on: boolean) => void;
  /** Fires once when the expert confirms the teach-back. */
  onTeachBackConfirmed?: () => void;
  onError?: (message: string) => void;
}

export interface SpeechSignals {
  isSpeaking: boolean;    // agent talking, or the human's voice activity is high
  msSinceSpeech: number;  // since anyone last spoke
}

const VAD_SPEAKING = 0.5;
const VAD_HOLD_MS = 300;
const MAX_QUEUE = 20;
const HESITATION_WINDOW_MS = 20_000;

export function useApprenticeAgent(mode: AgentMode, opts: ApprenticeAgentOptions = {}) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [offRecord, setOffRecordState] = useState(false);
  const [debrief, setDebrief] = useState<DebriefPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const startedAt = useRef<number>(Date.now());
  const offRecordRef = useRef(false);
  const debriefRef = useRef<DebriefPhase>("idle");
  const queue = useRef<AgentContextMessage[]>([]);
  const lastVoiceAt = useRef(0);
  const agentSpeakingRef = useRef(false);
  const hesitations = useRef<{ at: number; n: number }[]>([]);
  const convRef = useRef<ReturnType<typeof useConversation>>(null!);

  const clock = useCallback(() => (optsRef.current.now ? optsRef.current.now() : Date.now() - startedAt.current), []);

  const setPhase = (p: DebriefPhase) => {
    debriefRef.current = p;
    setDebrief(p);
  };

  const setOffRecordLocal = (on: boolean) => {
    if (offRecordRef.current === on) return false;
    offRecordRef.current = on;
    setOffRecordState(on);
    optsRef.current.onOffRecordChange?.(on);
    return true;
  };

  const pushLine = (line: TranscriptLine) => {
    setTranscript((prev) => [...prev, line]);
    optsRef.current.onTranscript?.(line);
  };

  const handleMessage = (p: MessagePayload) => {
    const text = (p.message || "").trim();
    if (!text) return;
    const fromHuman = p.role === "user";
    if (fromHuman && isOwnContextEcho(text)) return; // our own [TAG] messages, not speech

    if (fromHuman) {
      const toggle = detectRecordToggle(text);
      if (toggle !== null && setOffRecordLocal(toggle)) {
        convRef.current.sendContextualUpdate(toggle ? "[OFF RECORD]" : "[ON RECORD]");
      }
      if (debriefRef.current === "teach_back" && isAffirmative(text)) {
        setPhase("confirmed");
        optsRef.current.onTeachBackConfirmed?.();
      }
      if (mode === "tutor") {
        const n = countHesitations(text);
        if (n) hesitations.current.push({ at: Date.now(), n });
      }
    } else if (debriefRef.current === "asking" && asksForConfirmation(text)) {
      setPhase("teach_back");
    }

    pushLine({
      t: clock(),
      speaker: fromHuman ? (mode === "tutor" ? "new_hire" : "expert") : "agent",
      text,
      ...(offRecordRef.current ? { off_record: true } : {}),
    });
  };

  const conversation = useConversation({
    onMessage: handleMessage,
    onModeChange: ({ mode: m }) => {
      agentSpeakingRef.current = m === "speaking";
      lastVoiceAt.current = Date.now();
    },
    onVadScore: ({ vadScore }) => {
      if (vadScore >= VAD_SPEAKING) lastVoiceAt.current = Date.now();
    },
    onConnect: () => {
      setError(null);
      const pending = queue.current.splice(0);
      pending.forEach((m) => deliver(m));
    },
    onDisconnect: () => {
      agentSpeakingRef.current = false;
    },
    onError: (message) => {
      setError(message);
      optsRef.current.onError?.(message);
    },
    // Optional: only used if these client tools are also defined on the agent in the ElevenLabs dashboard.
    clientTools: {
      set_off_record: (params: Record<string, unknown>) => {
        const on = params?.on === true || params?.on === "true";
        setOffRecordLocal(on);
        return on ? "Off the record." : "Back on the record.";
      },
      confirm_teach_back: () => {
        setPhase("confirmed");
        optsRef.current.onTeachBackConfirmed?.();
        return "Teach-back confirmed.";
      },
    },
  });

  convRef.current = conversation;

  const deliver = (m: AgentContextMessage) => {
    const text = formatContext(m, { expert: optsRef.current.expert });
    if (deliveryFor(m) === "turn") convRef.current.sendUserMessage(text);
    else convRef.current.sendContextualUpdate(text);
  };

  /** Send anything to the agent. Screen events are silent context; everything else makes the agent speak. */
  const sendContext = useCallback(
    (m: AgentContextMessage) => {
      if (m.kind === "off_record") setOffRecordLocal(m.on);
      if (m.kind === "start_debrief") setPhase("asking");
      // Off the record: the agent must not see what happens on screen.
      if (m.kind === "screen_event" && offRecordRef.current) return;

      if (convRef.current.status !== "connected") {
        // Keep silent context for when the agent connects; drop stale prompts to speak.
        if (deliveryFor(m) === "context") {
          queue.current.push(m);
          if (queue.current.length > MAX_QUEUE) queue.current.shift();
        }
        return;
      }
      deliver(m);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const start = useCallback(async () => {
    setError(null);
    startedAt.current = Date.now();
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const { agentId, tokenEndpoint = "/api/voice/token" } = optsRef.current;
      if (agentId) {
        convRef.current.startSession({ agentId, userId: mode });
        return;
      }
      const res = await fetch(`${tokenEndpoint}?mode=${mode}`);
      if (!res.ok) throw new Error(`token route ${res.status}: ${await res.text()}`);
      const { token } = (await res.json()) as { token: string };
      convRef.current.startSession({ conversationToken: token, connectionType: "webrtc", userId: mode });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      optsRef.current.onError?.(message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const stop = useCallback(() => {
    convRef.current.endSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** For engine.gate(): is anyone talking, and how long since anyone did. */
  const getSpeechSignals = useCallback((): SpeechSignals => {
    const since = Date.now() - lastVoiceAt.current;
    const isSpeaking = agentSpeakingRef.current || since < VAD_HOLD_MS;
    return { isSpeaking, msSinceSpeech: isSpeaking ? 0 : since };
  }, []);

  /** For engine.detectStuck(): hesitation words from the new hire in the last 20s. */
  const getHesitationWords = useCallback(() => {
    const cutoff = Date.now() - HESITATION_WINDOW_MS;
    hesitations.current = hesitations.current.filter((h) => h.at >= cutoff);
    return hesitations.current.reduce((sum, h) => sum + h.n, 0);
  }, []);

  /** Reset the record flag and transcript for a fresh session. */
  const reset = useCallback(() => {
    setTranscript([]);
    setOffRecordLocal(false);
    setPhase("idle");
    queue.current = [];
    hesitations.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    mode,
    status: conversation.status, // "disconnected" | "connecting" | "connected" | "disconnecting"
    isAgentSpeaking: conversation.isSpeaking,
    isMuted: conversation.isMuted,
    setMuted: conversation.setMuted,
    error,
    transcript,
    offRecord,
    debrief,
    start,
    stop,
    reset,
    sendContext,
    getSpeechSignals,
    getHesitationWords,
  };
}

export type ApprenticeAgent = ReturnType<typeof useApprenticeAgent>;
