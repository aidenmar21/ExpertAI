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
      return `[ASK NOW] ${oneLine(m.pick.question)}${m.pick.is_guardrail ? " (this is a guardrail question)" : ""}`;

    case "start_debrief": {
      const lines = ["[DEBRIEF] Capture is over. Start the debrief now."];
      if (m.gaps.length) {
        lines.push("Open gaps, ask one at a time:");
        m.gaps.forEach((g, i) => lines.push(`${i + 1}. ${oneLine(g.question)}`));
      } else {
        lines.push("No open gaps. Go straight to the teach-back.");
      }
      if (m.map.steps.length) {
        lines.push("Steps you saw:");
        m.map.steps.forEach((s) => lines.push(`${s.n}. ${oneLine(s.title)}: ${oneLine(s.decision)}`));
      }
      if (m.map.rules.length) {
        lines.push("Rules learned so far:");
        m.map.rules.forEach((r) => lines.push(`- ${oneLine(r.text)} (${r.type}; ${m.map.expert || expert} said: "${oneLine(r.reason_quote)}")`));
      }
      lines.push('After the gaps, explain the whole process back in under a minute, then ask "Is that right?"');
      return lines.join("\n");
    }

    case "guardrail_hit": {
      const { check } = m;
      const parts = [`[GUARDRAIL] The new hire is about to break a rule. Their save is paused. ${expert} would stop here.`];
      if (check.rule) {
        parts.push(`Rule: ${oneLine(check.rule.text)}.`);
        if (check.rule.reason_quote) parts.push(`${expert} said: "${oneLine(check.rule.reason_quote)}".`);
        if (check.rule.then.escalate_to) parts.push(`Escalate to: ${check.rule.then.escalate_to}.`);
      }
      if (check.explanation) parts.push(`Why: ${oneLine(check.explanation)}.`);
      if (check.clip_id || check.screen_moment) parts.push(`A replay of ${expert}'s screen moment is available.`);
      return parts.join(" ");
    }

    case "stuck":
      return `[STUCK] ${oneLine(m.hint)}`;

    case "off_record":
      return m.on ? "[OFF RECORD]" : "[ON RECORD]";
  }
}

// ---------- transcript helpers ----------

const OFF_RE = /\boff the record\b/i;
const ON_RE = /\bon the record\b/i;
const YES_RE = /^\s*(yes|yeah|yep|yup|correct|exactly|right|that'?s (right|correct|it)|perfect)\b/i;
const IS_THAT_RIGHT_RE = /\bis that (right|correct)\b/i;
const HESITATION_RE = /\b(um+|uh+|hmm+|wait)\b|\bi don'?t know\b|\bnot sure\b/gi;

/** "let's go off the record" -> true, "back on the record" -> false, otherwise null. */
export function detectRecordToggle(text: string): boolean | null {
  if (OFF_RE.test(text)) return true;
  if (ON_RE.test(text)) return false;
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
