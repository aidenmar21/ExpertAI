"use client";
// useApprenticeAgent: the ElevenLabs interviewer / tutor agent, as one hook.
// Requires an <ApprenticeVoiceProvider> (ElevenLabs ConversationProvider) ancestor.
import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import type { MessagePayload } from "@elevenlabs/react";
import type { AgentContextMessage, CheckResult, TranscriptLine, WorkMap } from "../shared/contracts";
import {
  type AgentMode,
  type Delivery,
  asksForConfirmation,
  countHesitations,
  deliveryFor,
  detectRecordToggle,
  formatContext,
  holdOutgoing,
  isAffirmative,
  isOwnContextEcho,
} from "./format";
import { type DebriefQuestion, formatDebriefQuestion, formatTeachBack, formatWorkMapContext, planDebrief } from "./debrief";

export type DebriefPhase = "idle" | "asking" | "teach_back" | "confirmed";

/** TranscriptLine plus the screen event a debrief question/answer is about (proposed optional contract field). */
export type VoiceTranscriptLine = TranscriptLine & { about_event_id?: string };

export type SendOutcome = "sent" | "queued" | "dropped" | "held" | "throttled";

export interface OutboxEntry {
  id: number;
  t: number;
  text: string;
  delivery: Delivery;
  outcome: SendOutcome;
  reason?: string;
}

export interface ApprenticeAgentOptions {
  /** Expert's name, used in tutor lines ("Aarav would stop here"). */
  expert?: string;
  /** job.escalate_to, used in the general guardrail debrief question. */
  escalateTo?: string;
  /** Current Work Map. Sent to the agent as silent context on connect and whenever it changes. */
  workMap?: WorkMap | null;
  /** Role briefing (what ExpertAI already knows about this job); sent once per connection as silent context. */
  briefing?: string | null;
  /** App route returning a WebRTC conversation token for ?mode=. Default "/api/voice/token". */
  tokenEndpoint?: string;
  /** Public agent id. If set, connects directly and skips the token route. */
  agentId?: string;
  /** Session clock in ms, shared with engine so transcript t lines up with ScreenEvent.t. Default: ms since start(). */
  now?: () => number;
  /** Min ms between [STUCK] nudges. Default 30000. */
  stuckCooldownMs?: number;
  /** Every final transcript line (expert / new hire / agent). off_record lines are flagged, not dropped. */
  onTranscript?: (line: VoiceTranscriptLine) => void;
  onOffRecordChange?: (on: boolean) => void;
  /** Fires once when the expert confirms the teach-back. App: brain confirmWorkMap(). */
  onTeachBackConfirmed?: () => void;
  /** Tutor asked to replay the expert's screen moment / clip for the active guardrail. */
  onReplayRequested?: (check: CheckResult | null) => void;
  /** New hire asked to be shown how (tutor client tool show_me_how): play the on-screen walkthrough. */
  onShowMeRequested?: () => void;
  /** Tutor hit something the Work Map doesn't cover. */
  onNewCase?: (summary: string) => void;
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
const ADVANCE_DELAY_MS = 700;
const MAX_FOLLOW_UPS = 1;
const ADVANCE_FALLBACK_MS = 15_000;
const TEACH_BACK_MIN_CHARS = 160;
// Expressive TTS puts lowercase audio tags like [neutral] in the agent's text. Ours are uppercase.
const AUDIO_TAG_RE = /\[[a-z][a-z ]{0,24}\]\s*/g;

export function useApprenticeAgent(mode: AgentMode, opts: ApprenticeAgentOptions = {}) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const [transcript, setTranscript] = useState<VoiceTranscriptLine[]>([]);
  const [outbox, setOutbox] = useState<OutboxEntry[]>([]);
  const [offRecord, setOffRecordState] = useState(false);
  const [debrief, setDebrief] = useState<DebriefPhase>("idle");
  const [debriefPlan, setDebriefPlan] = useState<DebriefQuestion[]>([]);
  const [debriefIndex, setDebriefIndex] = useState(-1);
  const [teachBack, setTeachBack] = useState<string | null>(null);
  const [activeGuardrail, setActiveGuardrail] = useState<CheckResult | null>(null);
  const [newCases, setNewCases] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const startedAt = useRef<number>(Date.now());
  const offRecordRef = useRef(false);
  const debriefRef = useRef<DebriefPhase>("idle");
  const queue = useRef<AgentContextMessage[]>([]);
  const lastVoiceAt = useRef(0);
  const agentSpeakingRef = useRef(false);
  const hesitations = useRef<{ at: number; n: number }[]>([]);
  const guardrailRef = useRef<CheckResult | null>(null);
  const lastStuckAt = useRef(-Infinity);
  const outboxSeq = useRef(0);
  const sentMapRef = useRef<WorkMap | null>(null);
  // Debrief runner: which question is out, and whether the expert has answered it.
  const dq = useRef({ plan: [] as DebriefQuestion[], index: -1, answered: false, followUps: 0, ready: false, readyAt: 0, timer: 0 as ReturnType<typeof setTimeout> | 0 });
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

  const log = (text: string, delivery: Delivery, outcome: SendOutcome, reason?: string) => {
    const entry: OutboxEntry = { id: ++outboxSeq.current, t: clock(), text, delivery, outcome, ...(reason ? { reason } : {}) };
    setOutbox((prev) => [...prev, entry]);
  };

  /** Raw send of already-formatted text. Logs to the outbox. */
  const push = (text: string, delivery: Delivery) => {
    if (convRef.current.status !== "connected") {
      log(text, delivery, "dropped", "agent not connected");
      return "dropped" as const;
    }
    if (delivery === "turn") convRef.current.sendUserMessage(text);
    else convRef.current.sendContextualUpdate(text);
    log(text, delivery, "sent");
    return "sent" as const;
  };

  const confirmTeachBack = () => {
    if (debriefRef.current === "confirmed") return;
    setPhase("confirmed");
    optsRef.current.onTeachBackConfirmed?.();
  };

  // ---------- Debrief runner ----------
  const askDebriefQuestion = (index: number) => {
    const d = dq.current;
    d.index = index;
    d.answered = false;
    d.followUps = 0;
    d.ready = false;
    d.readyAt = 0;
    setDebriefIndex(index);
    if (index < d.plan.length) push(formatDebriefQuestion(d.plan[index], index, d.plan.length), "turn");
    else push(formatTeachBack(), "turn");
  };

  // Next question once the agent has finished its reply. If speaking state never clears, go anyway after ADVANCE_FALLBACK_MS.
  const maybeAdvance = () => {
    const d = dq.current;
    if (!d.ready || debriefRef.current !== "asking" || d.index >= d.plan.length) return;
    if (!d.readyAt) d.readyAt = Date.now();
    if (d.timer) clearTimeout(d.timer);
    d.timer = setTimeout(() => {
      d.timer = 0;
      const cur = dq.current;
      if (!cur.ready || debriefRef.current !== "asking") return;
      if (agentSpeakingRef.current && Date.now() - cur.readyAt < ADVANCE_FALLBACK_MS) return maybeAdvance();
      askDebriefQuestion(cur.index + 1);
    }, agentSpeakingRef.current ? 1000 : ADVANCE_DELAY_MS);
  };

  const currentAbout = () => {
    const d = dq.current;
    return debriefRef.current === "asking" && d.index >= 0 && d.index < d.plan.length ? d.plan[d.index].about_event_id : undefined;
  };

  // ---------- Incoming messages ----------
  const typed = useRef<{ text: string; at: number }[]>([]);

  const handleMessage = (p: MessagePayload) => {
    const text = (p.message || "").trim();
    if (!text) return;
    const fromHuman = p.role === "user";
    if (fromHuman && isOwnContextEcho(text)) return; // our own [TAG] messages, not speech
    if (fromHuman) {
      // A typed line we already recorded in say(), echoed back by the SDK.
      typed.current = typed.current.filter((x) => Date.now() - x.at < 10_000);
      const i = typed.current.findIndex((x) => x.text === text);
      if (i >= 0) {
        typed.current.splice(i, 1);
        return;
      }
    }
    handleLine(text, fromHuman);
  };

  const handleLine = (raw: string, fromHuman: boolean) => {
    const text = fromHuman ? raw : raw.replace(AUDIO_TAG_RE, "").trim();
    if (!text) return;
    const about = currentAbout();

    if (fromHuman) {
      const toggle = detectRecordToggle(text);
      if (toggle !== null && setOffRecordLocal(toggle)) {
        push(toggle ? "[OFF RECORD]" : "[ON RECORD]", "context");
      }
      if (debriefRef.current === "teach_back" && isAffirmative(text)) confirmTeachBack();
      if (debriefRef.current === "asking" && !offRecordRef.current) dq.current.answered = true;
      if (modeRef.current === "tutor") {
        const n = countHesitations(text);
        if (n) hesitations.current.push({ at: Date.now(), n });
      }
    } else if (debriefRef.current === "asking") {
      const d = dq.current;
      // Teach-back: asked for, or the agent got there on its own with a full summary.
      if (asksForConfirmation(text) && (d.index >= d.plan.length || text.length >= TEACH_BACK_MIN_CHARS)) {
        if (d.timer) clearTimeout(d.timer);
        d.timer = 0;
        d.ready = false;
        d.index = d.plan.length;
        setDebriefIndex(d.plan.length);
        setPhase("teach_back");
        setTeachBack(text);
      } else if (d.answered && text.includes("?") && d.followUps < MAX_FOLLOW_UPS) {
        d.followUps++; // agent asked a follow-up: wait for that answer too
        d.answered = false;
        d.ready = false;
        if (d.timer) clearTimeout(d.timer);
        d.timer = 0;
        d.readyAt = 0;
      } else if (d.answered) {
        d.ready = true; // answered (and followed up): next question once the agent stops talking
        maybeAdvance();
      }
    } else if (debriefRef.current === "teach_back" && asksForConfirmation(text)) {
      setTeachBack(text); // corrected teach-back
    }

    const line: VoiceTranscriptLine = {
      t: clock(),
      speaker: fromHuman ? (modeRef.current === "tutor" ? "new_hire" : "expert") : "agent",
      text,
      ...(offRecordRef.current ? { off_record: true } : {}),
      ...(about ? { about_event_id: about } : {}),
    };
    setTranscript((prev) => [...prev, line]);
    optsRef.current.onTranscript?.(line);
  };

  const sentBriefingRef = useRef<string | null>(null);
  const sendWorkMap = () => {
    if (convRef.current.status !== "connected") return;
    const briefing = optsRef.current.briefing;
    if (briefing && briefing !== sentBriefingRef.current) {
      sentBriefingRef.current = briefing;
      push(`[ROLE BRIEFING]\n${briefing}`, "context");
    }
    const map = optsRef.current.workMap;
    if (!map || map === sentMapRef.current) return;
    sentMapRef.current = map;
    push(formatWorkMapContext(map), "context");
  };

  const conversation = useConversation({
    onMessage: handleMessage,
    onVadScore: ({ vadScore }) => {
      if (vadScore >= VAD_SPEAKING) lastVoiceAt.current = Date.now();
    },
    onConnect: () => {
      setError(null);
      sentMapRef.current = null; // new conversation: the agent needs the briefing and Work Map again
      sentBriefingRef.current = null;
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
        confirmTeachBack();
        return "Teach-back confirmed.";
      },
      replay_expert_moment: () => {
        optsRef.current.onReplayRequested?.(guardrailRef.current);
        return guardrailRef.current ? "Replaying the expert's moment on screen." : "There is no moment to replay right now.";
      },
      guide_me: () => {
        optsRef.current.onShowMeRequested?.();
        return "Guiding them through every step on their screen now.";
      },
      show_me_how: () => {
        optsRef.current.onShowMeRequested?.();
        return "Playing the walkthrough on their screen now. Let them watch, then say: your turn.";
      },
      flag_new_case: (params: Record<string, unknown>) => {
        const summary = String(params?.summary ?? "").trim() || "Case not covered by the work map";
        setNewCases((prev) => [...prev, summary]);
        optsRef.current.onNewCase?.(summary);
        return "Flagged for the manager.";
      },
    },
  });
  convRef.current = conversation;

  // Agent speaking state, from the SDK's own state so it can't miss a change.
  useEffect(() => {
    agentSpeakingRef.current = conversation.isSpeaking;
    lastVoiceAt.current = Date.now();
    if (!conversation.isSpeaking) maybeAdvance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.isSpeaking]);

  // On connect (and whenever the Work Map changes): send the map, then anything queued while connecting.
  useEffect(() => {
    if (conversation.status !== "connected") return;
    sendWorkMap();
    queue.current.splice(0).forEach((m) => deliver(m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.workMap, conversation.status]);

  const deliver = (m: AgentContextMessage): SendOutcome => {
    if (m.kind === "start_debrief") {
      const plan = planDebrief(m.gaps, m.map, optsRef.current.escalateTo);
      const d = dq.current;
      if (d.timer) clearTimeout(d.timer);
      dq.current = { plan, index: -1, answered: false, followUps: 0, ready: false, readyAt: 0, timer: 0 };
      setDebriefPlan(plan);
      setTeachBack(null);
      setPhase("asking");
      if (m.map !== sentMapRef.current) {
        sentMapRef.current = m.map;
        push(formatWorkMapContext(m.map), "context");
      }
      askDebriefQuestion(0);
      return "sent";
    }
    return push(formatContext(m, { expert: optsRef.current.expert }), deliveryFor(m));
  };

  /**
   * Send anything to the agent (contract 8). Screen events are silent context; everything else makes the agent speak.
   * start_debrief runs the whole debrief: one question at a time, then the teach-back.
   */
  const sendContext = useCallback((m: AgentContextMessage): SendOutcome => {
    const delivery = m.kind === "start_debrief" ? "turn" : deliveryFor(m);
    const preview = () => formatContext(m, { expert: optsRef.current.expert });

    if (m.kind === "off_record") setOffRecordLocal(m.on);
    // Off the record: the agent must not see (or ask about) what happens on screen. ask_now is dropped during the debrief.
    const hold = holdOutgoing(m, { offRecord: offRecordRef.current, debrief: debriefRef.current });
    if (hold) {
      log(preview(), delivery, hold.outcome, hold.reason);
      return hold.outcome;
    }
    if (m.kind === "stuck") {
      const why = guardrailRef.current
        ? "guardrail in progress"
        : agentSpeakingRef.current
          ? "agent is speaking"
          : Date.now() - lastStuckAt.current < (optsRef.current.stuckCooldownMs ?? 30_000)
            ? "nudged recently"
            : null;
      if (why) {
        log(preview(), delivery, "throttled", why);
        return "throttled";
      }
    }
    if (convRef.current.status !== "connected") {
      // Keep silent context for when the agent connects; drop stale prompts to speak.
      if (delivery === "context") {
        queue.current.push(m);
        if (queue.current.length > MAX_QUEUE) queue.current.shift();
        log(preview(), delivery, "queued", "sent when connected");
        return "queued";
      }
      log(preview(), delivery, "dropped", "agent not connected");
      return "dropped";
    }
    if (m.kind === "stuck") lastStuckAt.current = Date.now();
    if (m.kind === "guardrail_hit") {
      guardrailRef.current = m.check;
      setActiveGuardrail(m.check);
    }
    return deliver(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Type instead of talking: the agent hears it as the human's turn, and it goes in the transcript. */
  const say = useCallback((text: string) => {
    const t = text.trim();
    if (!t || convRef.current.status !== "connected") return false;
    typed.current.push({ text: t, at: Date.now() });
    convRef.current.sendUserMessage(t);
    handleLine(t, true);
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Skip ahead in the debrief (e.g. the agent never acknowledged). After the last question this asks for the teach-back. */
  const nextDebriefQuestion = useCallback(() => {
    if (debriefRef.current !== "asking") return;
    const d = dq.current;
    if (d.timer) clearTimeout(d.timer);
    d.timer = 0;
    if (d.index < d.plan.length) askDebriefQuestion(d.index + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The new hire changed course or the save went through: clear the active guardrail. */
  const resolveGuardrail = useCallback(() => {
    guardrailRef.current = null;
    setActiveGuardrail(null);
  }, []);

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
    if (dq.current.timer) clearTimeout(dq.current.timer);
    dq.current.timer = 0;
    convRef.current.endSession();
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

  /** Clear transcript, outbox, and flow state for a fresh session. */
  const reset = useCallback(() => {
    if (dq.current.timer) clearTimeout(dq.current.timer);
    dq.current = { plan: [], index: -1, answered: false, followUps: 0, ready: false, readyAt: 0, timer: 0 };
    setTranscript([]);
    setOutbox([]);
    setOffRecordLocal(false);
    setPhase("idle");
    setDebriefPlan([]);
    setDebriefIndex(-1);
    setTeachBack(null);
    guardrailRef.current = null;
    setActiveGuardrail(null);
    setNewCases([]);
    queue.current = [];
    hesitations.current = [];
    lastStuckAt.current = -Infinity;
    sentMapRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (dq.current.timer) clearTimeout(dq.current.timer);
  }, []);

  return {
    mode,
    status: conversation.status, // "disconnected" | "connecting" | "connected" | "disconnecting"
    isAgentSpeaking: conversation.isSpeaking,
    isMuted: conversation.isMuted,
    setMuted: conversation.setMuted,
    error,
    transcript,
    outbox,
    offRecord,
    debrief,
    debriefPlan,
    debriefIndex, // index into debriefPlan; === debriefPlan.length once the teach-back was requested
    teachBack,    // the agent's latest "here's what I learned... Is that right?"
    activeGuardrail,
    newCases,
    start,
    stop,
    reset,
    sendContext,
    say,
    nextDebriefQuestion,
    resolveGuardrail,
    getSpeechSignals,
    getHesitationWords,
  };
}

export type ApprenticeAgent = ReturnType<typeof useApprenticeAgent>;
