// Pure formatting of AgentContextMessage -> text for the ElevenLabs agent. No React, no SDK: safe anywhere.
import type { AgentContextMessage, ScreenEvent, Value } from "../shared/contracts";

export type AgentMode = "interviewer" | "tutor";

/**
 * "context": silent background info (sendContextualUpdate), the agent does not take a turn.
 * "turn": the agent should speak now (sendUserMessage).
 */
export type Delivery = "context" | "turn";

export interface FormatOptions {
  expert?: string; // name used in tutor lines, e.g. "Aarav"
}

/** Every bracket tag we send. Used to recognise our own messages if the SDK echoes them back. */
export const CONTEXT_TAGS = ["[SCREEN]", "[ASK NOW]", "[DEBRIEF]", "[GUARDRAIL]", "[STUCK]", "[OFF RECORD]", "[ON RECORD]"];

export function deliveryFor(m: AgentContextMessage): Delivery {
  return m.kind === "screen_event" ? "context" : "turn";
}

function show(v: Value | undefined): string {
  if (v === null || v === undefined || v === "") return "empty";
  return String(v);
}

function sentence(s: string): string {
  return /[.!?"]$/.test(s) ? s : `${s}.`;
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function formatScreenEvent(e: ScreenEvent): string {
  const parts = ["[SCREEN]", e.type];
  if (e.field) parts.push(e.field);
  if (e.from !== undefined || e.to !== undefined) parts.push(`${show(e.from)} -> ${show(e.to)}`);
  if (e.record) parts.push(`on ${e.record}`);
  let line = parts.join(" ");
  if (e.detail) line += ` (${oneLine(e.detail)})`;
  return line;
}

/** Formats one context message, e.g. "[SCREEN] field_changed refund_method Card -> Cash on R-88104". */
export function formatContext(m: AgentContextMessage, opts: FormatOptions = {}): string {
  const expert = opts.expert || "the expert";
  switch (m.kind) {
    case "screen_event":
      return formatScreenEvent(m.event);

    case "ask_now":
      return `[ASK NOW] ${oneLine(m.pick.question)}${m.pick.is_guardrail ? " (guardrail)" : ""}`;

    case "start_debrief": {
      // The hook runs the debrief itself (debrief.ts); this is the one-shot fallback. Steps and rules are already in [WORK MAP].
      const lines = ["[DEBRIEF] Capture is over."];
      if (m.gaps.length) {
        lines.push("Ask one at a time:");
        m.gaps.forEach((g, i) => lines.push(`${i + 1}. ${oneLine(g.question)}`));
      }
      lines.push('Then tell the job back as a story, in order, in their words. End with "Is that right?"');
      return lines.join("\n");
    }

    case "guardrail_hit": {
      const { check } = m;
      const quote = check.rule?.reason_quote ? oneLine(check.rule.reason_quote) : "";
      const parts = check.standard
        ? [
            `[GUARDRAIL] Save paused. Industry standard, no company rule yet.`,
            `Say only: "Most people in this job would stop here. Why do you think?" Then wait.`,
            `After they answer, two sentences max: the usual way and why; say it's the usual way, not ${expert}'s rule.`,
          ]
        : [
            `[GUARDRAIL] Save paused.`,
            `Say only: "${expert} would stop here. Why do you think?" Then wait.`,
            `After they answer, two sentences max: ${expert}'s reason, quoting them.`,
          ];
      if (check.rule) {
        parts.push(sentence(`Rule: ${oneLine(check.rule.text)}`));
        if (quote) parts.push(`${expert} said: "${quote}"`);
        if (check.rule.then.escalate_to) parts.push(sentence(`Escalate to: ${check.rule.then.escalate_to}`));
      }
      // brain's explanation repeats the rule and quote; only add it when it says something new.
      if (check.explanation && !(quote && check.explanation.includes(quote))) parts.push(sentence(`Why: ${oneLine(check.explanation)}`));
      if (!check.standard && (check.clip_id || check.screen_moment)) parts.push("Replay available.");
      return parts.join(" ");
    }

    case "stuck":
      return `[STUCK] ${sentence(oneLine(m.hint))} Two sentences max, then wait.`;

    case "off_record":
      return m.on ? "[OFF RECORD]" : "[ON RECORD]";
  }
}

// ---------- transcript helpers ----------

// Spoken record toggles. The latest phrase in an utterance wins ("we were off the record, back on the record now" -> on).
const OFF_RE = /\boff the record\b|\b(?:don'?t|do not) record (?:this|that)\b|\b(?:pause|stop) (?:the )?recording\b/gi;
// "resume" alone, or "resume recording"; not "resume the refund" or "my resume".
const ON_RE =
  /\bon the record\b|(?<!\b(?:my|your|his|her|their|a|the) )\bresum(?:e|ing)\b(?!\s+(?:the|a|an|this|that|my|your|his|her|their)\s+(?!record))/gi;
const YES_RE = /^\s*(yes|yeah|yep|yup|correct|exactly|right|that'?s (right|correct|it)|perfect)\b/i;
const IS_THAT_RIGHT_RE = /\bis that (right|correct)\b/i;
const HESITATION_RE = /\b(um+|uh+|hmm+|wait)\b|\bi don'?t know\b|\bnot sure\b/gi;

function lastIndex(re: RegExp, text: string): number {
  let last = -1;
  for (const m of text.matchAll(re)) last = m.index ?? last;
  return last;
}

/** "let's go off the record" -> true, "back on the record" -> false, otherwise null. */
export function detectRecordToggle(text: string): boolean | null {
  const off = lastIndex(OFF_RE, text);
  const on = lastIndex(ON_RE, text);
  if (off < 0 && on < 0) return null;
  return off > on;
}

export type OutgoingHold = { outcome: "held" | "dropped"; reason: string };

/**
 * Should this message be kept from the agent right now? null = send it.
 * Off the record the agent must not see the screen or be prompted about it; during the debrief only the runner asks.
 */
export function holdOutgoing(m: AgentContextMessage, s: { offRecord: boolean; debrief: string }): OutgoingHold | null {
  if (s.offRecord && (m.kind === "screen_event" || m.kind === "ask_now")) return { outcome: "held", reason: "off the record" };
  if (m.kind === "ask_now" && (s.debrief === "asking" || s.debrief === "teach_back")) return { outcome: "dropped", reason: "debrief in progress" };
  return null;
}

export function isAffirmative(text: string): boolean {
  return YES_RE.test(text);
}

export function asksForConfirmation(agentText: string): boolean {
  return IS_THAT_RIGHT_RE.test(agentText);
}

export function countHesitations(text: string): number {
  return (text.match(HESITATION_RE) || []).length;
}

export function isOwnContextEcho(text: string): boolean {
  const t = text.trimStart();
  return CONTEXT_TAGS.some((tag) => t.startsWith(tag));
}
