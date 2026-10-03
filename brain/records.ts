// Decision records: the expert's actual answers, tied to the screen moment they explain.
// Browser-safe and deterministic. The LLM step in server.ts only refines these into Rules.
import type {
  OpenGap, QuestionPick, ScreenEvent, ScreenMoment, TranscriptLine, Value, WorkMap,
} from "@understudy/shared";
import { redact } from "./index";

// ---------- Types (brain-owned; proposed for shared/contracts.ts) ----------
export type QuestionKind = "why" | "what_would_change" | "when_to_stop";
export type RecordStatus = "unconfirmed" | "confirmed" | "corrected";

export interface DecisionSources {
  event_ids: string[];
  transcript_t: number[];       // t of every transcript line this record uses
  screen_moment: ScreenMoment;
  clip_id?: string;
}

export interface DecisionRecord {
  id: string;
  record?: string;              // e.g. receipt or invoice number
  what: string;                 // what the expert decided, from the screen
  how: string | null;           // the concrete change: "refund_method: Original card -> Store credit"
  why: string | null;           // expert's own words; null = not explained yet
  exceptions: string[];         // "what would change it", expert's words
  guardrails: string[];         // "when to stop / never", expert's words
  escalate_to?: string;
  quotes: string[];             // every expert answer used, verbatim (redacted)
  quote_t?: number[];           // transcript t of each quote (same order as quotes)
  superseded?: { why: string | null; quotes: string[]; replaced_at: number }; // reasoning before a correction
  sources: DecisionSources;
  asked: QuestionKind[];        // which questions were already asked (no repeats)
  unknown: QuestionKind[];      // asked or needed but not answered
  status: RecordStatus;
}

export interface CaptureInput {
  events: ScreenEvent[];
  transcript: TranscriptLine[];
  piiNames?: string[];          // extra strings to redact, e.g. PII field values
  escalateTo?: string;          // job.escalate_to
}

// ---------- Helpers ----------
const MEANINGFUL: ScreenEvent["type"][] = ["field_changed", "status_changed", "note_added"];
const EVENT_LINK_MS = 90_000;   // an answer explains an event up to 90s before the question

export function isMeaningful(e: ScreenEvent): boolean {
  return MEANINGFUL.includes(e.type) && e.confidence >= 0.5;
}

export function classifyQuestion(text: string): QuestionKind | null {
  const s = text.toLowerCase();
  if (!s.includes("?")) return null;
  if (/\b(stop|ask (someone|a|the|your)|manager|escalat|never|not allowed|call (a|the|your))/.test(s)) return "when_to_stop";
  if (/\b(chang|differen|otherwise|exception|unless|instead|what if|every time|always)/.test(s)) return "what_would_change";
  if (/\b(why|reason|how come|what made you|how did you decide)\b/.test(s)) return "why";
  return "why";
}

const VAGUE = /^(i (don'?t|do not) know|not sure|no idea|just because|habit|it depends|dunno|um+|hmm+)\W*$/i;
const NEGATIVE = /^(no|nope|nothing|never|not really|no exceptions?)\W*$/i;

function isVague(answer: string): boolean {
  const s = answer.trim();
  return s.length < 4 || VAGUE.test(s) || /^(i (don'?t|do not) know|not sure)\b/i.test(s) && s.length < 40;
}

function fmt(v: Value | undefined): string {
  return v === null || v === undefined || v === "" ? "(empty)" : String(v);
}

export function describeEvent(e: ScreenEvent): { what: string; how: string | null } {
  const on = e.record ? ` on ${e.record}` : "";
  if (e.field && (e.from !== undefined || e.to !== undefined)) {
    return {
      what: `${e.type === "status_changed" ? "Set status" : `Changed ${e.field}`}${on}`,
      how: `${e.field}: ${fmt(e.from)} -> ${fmt(e.to)}`,
    };
  }
  return { what: e.detail || e.type, how: null };
}

// Off-record windows: from the first off_record line until the next on-record line.
export function offRecordWindows(transcript: TranscriptLine[]): { start: number; end: number }[] {
  const lines = [...transcript].sort((a, b) => a.t - b.t);
  const out: { start: number; end: number }[] = [];
  let start: number | null = null;
  for (const l of lines) {
    if (l.off_record && start === null) start = l.t;
    if (!l.off_record && start !== null) { out.push({ start, end: l.t }); start = null; }
  }
  if (start !== null) out.push({ start, end: Number.POSITIVE_INFINITY });
  return out;
}

// Removes everything said or done off the record. Nothing off-record ever reaches the Work Map.
export function onRecordOnly(events: ScreenEvent[], transcript: TranscriptLine[]) {
  const wins = offRecordWindows(transcript);
  const inWin = (t: number) => wins.some((w) => t >= w.start && t < w.end);
  return {
    events: events.filter((e) => !inWin(e.t)),
    transcript: transcript.filter((l) => !l.off_record && !inWin(l.t)),
  };
}

// ---------- Capture ----------
// Pairs each agent question with the expert's answer and the screen event it is about.
// Unanswered meaningful events become records with why=null (open gaps). Nothing is invented.
export function captureDecisions(input: CaptureInput): DecisionRecord[] {
  const { events, transcript } = onRecordOnly(input.events, input.transcript);
  const evs = [...events].sort((a, b) => a.t - b.t);
  const lines = [...transcript].sort((a, b) => a.t - b.t);
  const byEvent = new Map<string, DecisionRecord>();
  const clean = (s: string) => redact(s, input.piiNames ?? []);

  const recordFor = (e: ScreenEvent): DecisionRecord => {
    let r = byEvent.get(e.id);
    if (!r) {
      const d = describeEvent(e);
      r = {
        id: `dr-${e.id}`, record: e.record, what: clean(d.what), how: d.how ? clean(d.how) : null,
        why: null, exceptions: [], guardrails: [], quotes: [], quote_t: [],
        sources: { event_ids: [e.id], transcript_t: [], screen_moment: { t: e.t, record: e.record, frameId: e.frameId } },
        asked: [], unknown: [], status: "unconfirmed",
      };
      byEvent.set(e.id, r);
    }
    return r;
  };

  for (const e of evs) if (isMeaningful(e)) recordFor(e);

  for (let i = 0; i < lines.length; i++) {
    const q = lines[i];
    if (q.speaker !== "agent") continue;
    const kind = classifyQuestion(q.text);
    if (!kind) continue;

    // Expert answer = consecutive expert lines after the question, until the next agent line.
    const answer: TranscriptLine[] = [];
    for (let j = i + 1; j < lines.length && lines[j].speaker !== "agent"; j++) {
      if (lines[j].speaker === "expert") answer.push(lines[j]);
    }

    // Event = latest meaningful event at or before the question (within the link window).
    const ev = [...evs].reverse().find((e) => isMeaningful(e) && e.t <= q.t && q.t - e.t <= EVENT_LINK_MS);
    if (!ev) continue;
    const r = recordFor(ev);
    if (!r.asked.includes(kind)) r.asked.push(kind);
    r.sources.transcript_t.push(q.t);

    const text = answer.map((a) => a.text.trim()).join(" ").trim();
    if (!text || isVague(text)) { if (!r.unknown.includes(kind)) r.unknown.push(kind); continue; }

    const said = clean(text);
    r.quotes.push(said);
    r.quote_t!.push(answer[0].t);
    r.sources.transcript_t.push(...answer.map((a) => a.t));
    r.unknown = r.unknown.filter((k) => k !== kind);
    if (kind === "why") r.why = r.why ? `${r.why} ${said}` : said;
    else if (kind === "what_would_change") { if (!NEGATIVE.test(text)) r.exceptions.push(said); }
    else {
      if (!NEGATIVE.test(text)) r.guardrails.push(said);
      if (input.escalateTo && new RegExp(`\\b(${input.escalateTo}|manager|supervisor|controller)\\b`, "i").test(text)) {
        r.escalate_to = input.escalateTo;
      }
    }
  }

  for (const r of byEvent.values()) if (r.why === null && !r.unknown.includes("why")) r.unknown.push("why");
  return [...byEvent.values()].sort((a, b) => a.sources.screen_moment.t - b.sources.screen_moment.t);
}

// ---------- Questions ----------
// Grounded question for one slot of a record. Order: why -> what would change it -> when to stop.
export function questionFor(r: DecisionRecord, kind: QuestionKind): string {
  const change = r.how ? ` ${r.how.replace(" -> ", " to ").replace(/^(\w+):/, "$1 from")}` : "";
  const on = r.record ? ` on ${r.record}` : "";
  switch (kind) {
    case "why": return `Why did you change${change || ` that`}${on}?`;
    case "what_would_change": return `What would make you decide differently on a case like ${r.record ?? "this"}?`;
    case "when_to_stop": return `Is there a point on a case like this where you'd stop and ask someone instead?`;
  }
}

// Next question worth asking about this record, or null. Never repeats an asked kind.
export function nextQuestionKind(r: DecisionRecord): QuestionKind | null {
  const order: QuestionKind[] = ["why", "what_would_change", "when_to_stop"];
  for (const k of order) if (!r.asked.includes(k)) return k;
  return null;
}

export function recordsToGaps(records: DecisionRecord[]): OpenGap[] {
  return records
    .filter((r) => r.why === null)
    .map((r) => ({ id: `gap-${r.id}`, question: questionFor(r, "why"), about_event_id: r.sources.event_ids[0] }));
}

// ---------- Work Map with records ----------
// What the expert said to correct a decision, e.g. in the debrief or teach-back.
export interface Correction { record_id: string; text: string; t: number }

// WorkMap plus brain's extras. Structurally a WorkMap, so existing consumers keep working.
export type WorkMapWithRecords = WorkMap & {
  records: DecisionRecord[];
  rule_sources?: Record<string, import("./validate").RuleEvidence>;   // rule id -> exact quote + source
  corrections?: Correction[];
  extracted?: Record<string, string>;      // record id -> quotes signature the rules were built from
  rejected_rules?: { record_id: string; text: string; reason: string }[];
};

// Replaces a record's reasoning with the expert's correction. Old quotes are kept only as history,
// so no rule can be grounded in them any more. Corrected text is redacted like any other answer.
export function applyCorrections(records: DecisionRecord[], corrections: Correction[], piiNames: string[] = []): DecisionRecord[] {
  return records.map((r) => {
    const mine = corrections.filter((c) => c.record_id === r.id).sort((a, b) => a.t - b.t);
    if (!mine.length) return r;
    const last = mine[mine.length - 1];
    const text = redact(last.text, piiNames);
    return {
      ...r,
      superseded: { why: r.why, quotes: r.quotes, replaced_at: last.t },
      why: text, quotes: [text], quote_t: [last.t], exceptions: [], guardrails: [],
      unknown: r.unknown.filter((k) => k !== "why"),
      sources: { ...r.sources, transcript_t: [...r.sources.transcript_t, last.t] },
      status: "corrected",
    };
  });
}

// Records a correction on the map. The next buildWorkMap drops the obsolete rules and re-extracts from the correction.
export function correctWorkMap(map: WorkMapWithRecords, c: Correction): WorkMapWithRecords {
  return { ...map, corrections: [...(map.corrections ?? []), c] };
}

// ---------- Confirmation ----------
export function confirmRecords(records: DecisionRecord[], ids?: string[]): DecisionRecord[] {
  return records.map((r) => (!ids || ids.includes(r.id)) && r.why !== null ? { ...r, status: "confirmed" } : r);
}

// ---------- Agent-facing text ----------
// Plain text for the tutor/interviewer agent context. Never includes hidden_rules (brain never sees them here).
export function workMapToAgentText(map: WorkMap & { records?: DecisionRecord[] }): string {
  const lines: string[] = [`WORK MAP for ${map.job_id}, taught by ${map.expert}.`];
  if (map.rules.length) {
    lines.push("Rules:");
    for (const r of map.rules) {
      lines.push(`- [${r.type}${r.confirmed ? ", confirmed" : ""}] ${r.text}${r.then.escalate_to ? ` (escalate to ${r.then.escalate_to})` : ""}. ${map.expert} said: "${r.reason_quote}"`);
    }
  }
  const recs = map.records ?? [];
  if (recs.length) {
    lines.push("Decisions observed:");
    for (const d of recs) {
      lines.push(`- ${d.what}${d.how ? ` (${d.how})` : ""}. Why: ${d.why ?? "UNKNOWN, do not guess"}.` +
        (d.exceptions.length ? ` Exceptions: ${d.exceptions.join(" / ")}.` : "") +
        (d.guardrails.length ? ` Stop when: ${d.guardrails.join(" / ")}.` : ""));
    }
  }
  if (map.open_gaps.length) lines.push(`Not yet explained: ${map.open_gaps.map((g) => g.question).join(" | ")}`);
  return lines.join("\n");
}

// ---------- Question picker (for engine.pickQuestion) ----------
export interface PickOptions {
  now?: number;                 // ms since session start; defaults to the latest event/line
  maxAgeMs?: number;            // only ask about recent decisions (default 60s)
  followUps?: boolean;          // after "why", ask what would change it / when to stop (default true)
  piiNames?: string[];
}

// One grounded question, or null to stay silent.
// Follow-ups on the latest decision first (once explained), then the most recent unexplained decision.
// Never repeats a question kind on a record, and never re-asks after a vague answer (that goes to the debrief).
export function pickFromRecords(events: ScreenEvent[], transcript: TranscriptLine[], opts: PickOptions = {}): QuestionPick | null {
  const { events: evs, transcript: lines } = onRecordOnly(events, transcript);
  if (lines.length && transcript[transcript.length - 1]?.off_record) return null;   // currently off the record
  const recs = captureDecisions({ events: evs, transcript: lines, piiNames: opts.piiNames });
  if (!recs.length) return null;
  const now = opts.now ?? Math.max(...evs.map((e) => e.t), ...lines.map((l) => l.t), 0);
  const fresh = recs.filter((r) => now - r.sources.screen_moment.t <= (opts.maxAgeMs ?? 60_000));
  const latest = fresh[fresh.length - 1];
  if (!latest) return null;

  const pick = (r: DecisionRecord, kind: QuestionKind): QuestionPick =>
    ({ question: questionFor(r, kind), about_event_id: r.sources.event_ids[0], is_guardrail: kind === "when_to_stop" });

  // Stay on the decision being discussed: follow up on the latest one once it's explained.
  if (opts.followUps !== false && latest.why !== null) {
    const k = nextQuestionKind(latest);
    if (k) return pick(latest, k);
  }
  const unexplained = [...fresh].reverse().find((r) => r.why === null && !r.asked.includes("why"));
  return unexplained ? pick(unexplained, "why") : null;
}
