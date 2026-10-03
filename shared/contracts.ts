// Cross-part contracts for Understudy. Change only with agreement from every owner that depends on it.

// ---------- Screen events (engine -> everyone) ----------
export type ScreenEventType =
  | "screen_opened" | "record_opened" | "field_changed" | "status_changed"
  | "dialog_opened" | "note_added" | "unknown_change";

export type Value = string | number | null;

export interface ScreenEvent {
  id: string;
  t: number;              // ms since session start
  type: ScreenEventType;
  record?: string;        // record id visible on screen, e.g. receipt or invoice number
  field?: string;
  from?: Value;
  to?: Value;
  confidence: number;     // 0..1
  detail: string;
  frameId?: string;       // thumbnail stored in IndexedDB
}

export interface ScreenState {
  view: string;
  record: Record<string, Value>;
  visible_warnings: string[];
}

// POST /api/vision  (app route -> engine.analyzeFrame)
export interface VisionRequest { frame_jpeg_base64: string; previous_state: ScreenState | null; t: number; }
export interface VisionResponse { screen_state: ScreenState; events: ScreenEvent[]; }

// ---------- Timing (engine, runs in browser) ----------
export interface GateSignals {
  msSinceInput: number;         // keyboard / mouse
  isSpeaking: boolean;          // anyone talking right now
  msSinceSpeech: number;
  msSinceScreenChange: number;
}
export interface GateResult { open: boolean; reason: string; }
// engine: gate(signals: GateSignals): GateResult   (open after 1500ms quiet on all three)

export interface QuestionPick { question: string; about_event_id: string; is_guardrail: boolean; }
// engine (server): pickQuestion(recent: ScreenEvent[], map: WorkMap, policy: string, transcript?: TranscriptLine[]): Promise<QuestionPick | null>

export interface StuckSignals {
  msIdleWithRecordOpen: number;
  backAndForthCount: number;    // same field changed back and forth in last 30s
  msHoveringAction?: { action: string; ms: number };
  hesitationWords: number;      // "um", "wait", "I don't know" in last 20s
}
export interface StuckResult { stuck: boolean; hint: string; }
// engine: detectStuck(s: StuckSignals): StuckResult

// ---------- Work Map (brain -> voice, app) ----------
export type RuleType = "judgment" | "guardrail" | "exception" | "limit" | "stop_and_ask";
export type Op = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "missing" | "present";

export interface Condition { field: string; op: Op; value?: Value | Value[]; }

export interface ScreenMoment { t: number; record?: string; frameId?: string; }

export interface Rule {
  id: string;
  text: string;                 // plain words: "Refunds over $100 need a manager"
  type: RuleType;
  when: Condition[];            // all must hold
  then: {
    must?: Record<string, Value>;      // e.g. { refund_method: "Store credit" }
    must_not?: Record<string, Value>;  // e.g. { refund_method: "Cash" }
    must_not_action?: string[];        // e.g. ["refund"]
    escalate_to?: string;              // e.g. "Shift manager"
  };
  reason_quote: string;         // the expert's own words
  screen_moment: ScreenMoment;
  clip_id?: string;             // expert audio clip
  source: "live_question" | "debrief" | "teach_back" | "policy";
  confirmed: boolean;           // true after teach-back
}

export interface WorkMapStep {
  n: number;
  title: string;
  screen_moment: ScreenMoment;
  decision: string;
  rule_ids: string[];
}

export interface OpenGap { id: string; question: string; about_event_id?: string; }

export interface WorkMap {
  job_id: string;
  expert: string;
  steps: WorkMapStep[];
  rules: Rule[];
  open_gaps: OpenGap[];
  confirmed_at?: string;
}
// brain (server): buildWorkMap(input: { job_id: string; expert: string; events: ScreenEvent[];
//   transcript: TranscriptLine[]; previous?: WorkMap }): Promise<WorkMap>

export interface TranscriptLine { t: number; speaker: "expert" | "agent" | "new_hire"; text: string; off_record?: boolean; }

// ---------- Tutor check (brain -> app) ----------
export interface ProposedAction { action: string; record: Record<string, Value>; }
export interface CheckResult {
  ok: boolean;
  rule?: Rule;
  explanation?: string;
  clip_id?: string;
  screen_moment?: ScreenMoment;
}
// brain: checkAction(a: ProposedAction, map: WorkMap): CheckResult

// ---------- Messages into the voice agent (voice) ----------
export type AgentContextMessage =
  | { kind: "screen_event"; event: ScreenEvent }
  | { kind: "ask_now"; pick: QuestionPick }
  | { kind: "start_debrief"; gaps: OpenGap[]; map: WorkMap }
  | { kind: "guardrail_hit"; check: CheckResult }
  | { kind: "stuck"; hint: string }
  | { kind: "off_record"; on: boolean };
// voice: sendContext(m: AgentContextMessage): void   (formats as text, e.g. "[SCREEN] field_changed refund_method Card -> Cash on R-88104")

// ---------- Job profile (shared/jobs/*.json) ----------
export interface JobField { key: string; label: string; type: "text" | "money" | "date" | "select" | "status"; options?: string[]; pii?: boolean; }
export interface JobAction { key: string; label: string; sets: Record<string, Value>; }
export interface JobProfile {
  job: { id: string; name: string; category: string; business_date: string; written_policy: string; escalate_to: string };
  screen: { record_type: string; fields: JobField[]; actions: JobAction[] };
  [extra: string]: unknown;     // catalog, customers, cases, hidden_rules (answer key, never sent to agent)
}

// ---------- Scoreboard (brain) ----------
export interface Scoreboard {
  rules_learned: number; rules_total: number;   // vs hidden_rules
  vision_accuracy: number;                       // vs fake-app ground truth, 0..1
  tutor_catches: number; tutor_traps: number;
  false_alarms: number;
  live_questions: number; guardrail_questions: number;
}
