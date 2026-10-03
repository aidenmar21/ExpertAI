// brain package entry. Browser-safe: rule checker, redaction, scoreboard. Server-only code goes in server.ts.
import type {
  CheckResult, Condition, JobProfile, ProposedAction, Rule, ScreenEvent, TranscriptLine, Value, WorkMap,
} from "@understudy/shared";

type Rec = Record<string, Value>;

function num(v: Value | undefined): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    return v.trim() !== "" && !Number.isNaN(n) ? n : null;
  }
  return null;
}

function same(a: Value | undefined, b: Value | undefined): boolean {
  if (a == null || b == null) return a == b;
  const na = num(a), nb = num(b);
  if (typeof a === "number" || typeof b === "number") return na !== null && na === nb;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

export function evalCondition(c: Condition, rec: Rec): boolean {
  const v = rec[c.field];
  const empty = v === undefined || v === null || v === "";
  switch (c.op) {
    case "missing": return empty;
    case "present": return !empty;
    case "eq": return same(v, c.value as Value);
    case "neq": return !same(v, c.value as Value);
    case "in": return Array.isArray(c.value) && c.value.some((x) => same(v, x));
    case "gt": case "gte": case "lt": case "lte": {
      const a = num(v), b = num(c.value as Value);
      if (a === null || b === null) return false;
      return c.op === "gt" ? a > b : c.op === "gte" ? a >= b : c.op === "lt" ? a < b : a <= b;
    }
    default: return false;
  }
}

function violation(rule: Rule, action: string, rec: Rec): string | null {
  const t = rule.then;
  if (t.must_not_action?.includes(action)) return `"${action}" is not allowed here`;
  for (const [k, want] of Object.entries(t.must ?? {}))
    if (!same(rec[k], want)) return `${k} should be ${want}`;
  for (const [k, bad] of Object.entries(t.must_not ?? {}))
    if (same(rec[k], bad)) return `${k} must not be ${bad}`;
  return null;
}

// Actions that hand the case off are always safe: escalating is what most rules ask for.
const SAFE_ACTIONS = new Set(["call_manager", "hold", "escalate", "send_to_controller", "request_info"]);

export interface CheckOptions {
  job?: JobProfile;               // applies the action's `sets` before checking must / must_not
  includeUnconfirmed?: boolean;   // default false: only teach-back-confirmed rules enforce
  baselineFallback?: boolean;     // default true: unconfirmed baseline rules speak when no company rule covers the case
}

export function checkAction(a: ProposedAction, map: WorkMap, opts: CheckOptions = {}): CheckResult {
  if (SAFE_ACTIONS.has(a.action)) return { ok: true };
  const sets = opts.job?.screen.actions.find((x) => x.key === a.action)?.sets ?? {};
  const after: Rec = { ...a.record, ...sets };
  // Company rules first (anything confirmed, including baseline rules the expert matched). If no company rule
  // covers the case at all, an unconfirmed baseline rule may speak as "the industry standard".
  const company = map.rules.filter((r) => r.confirmed || opts.includeUnconfirmed);
  const covered = company.some((r) => r.when.every((c) => evalCondition(c, a.record)));
  const fallback = covered || opts.baselineFallback === false
    ? []
    : map.rules.filter((r) => r.source === "baseline" && !r.confirmed && !r.overridden_by);
  for (const rule of [...company, ...fallback]) {
    const standard = rule.source === "baseline" && !rule.confirmed;
    if (!rule.when.every((c) => evalCondition(c, a.record))) continue;
    // Escalation-only rules hold every non-handoff action; rules with explicit restrictions only enforce those.
    const t = rule.then;
    const escalateOnly = t.escalate_to && !t.must && !t.must_not && !t.must_not_action?.length;
    const v = violation(rule, a.action, after);
    const why = v ? (t.escalate_to ? `${v}; hand it to ${t.escalate_to}` : v)
      : escalateOnly ? `this needs ${t.escalate_to}` : null;
    if (!why) continue;
    return {
      ok: false,
      rule,
      explanation: standard
        ? `The industry standard is: ${rule.text} (${why}). This company has not said otherwise yet.`
        : `${rule.text} (${why}). In the expert's words: "${rule.reason_quote}"`,
      clip_id: rule.clip_id,
      screen_moment: rule.screen_moment,
      ...(standard ? { standard: true } : {}),
    };
  }
  return { ok: true };
}

/**
 * Line the expert's own rules up against the baseline (industry standard) rules.
 * Same conditions and same outcome: the baseline rule flips to confirmed with the expert's quote and clip.
 * Same conditions, different outcome: the baseline rule is overridden by the expert's rule.
 */
export function reconcileBaseline(carried: Rule[], learned: Rule[]): Rule[] {
  const fieldsOf = (r: Rule) => new Set(r.when.map((c) => c.field));
  const sameFields = (x: Rule, y: Rule) => {
    const a = fieldsOf(x), b = fieldsOf(y);
    return a.size > 0 && a.size === b.size && [...a].every((f) => b.has(f));
  };
  const sameOutcome = (x: Rule, y: Rule) => JSON.stringify(normThen(x.then)) === JSON.stringify(normThen(y.then));
  return carried.map((b) => {
    if (b.source !== "baseline") return b;
    const match = learned.find((l) => sameFields(b, l));
    if (!match) return b;
    if (sameOutcome(b, match) || (!!b.then.escalate_to && b.then.escalate_to === match.then.escalate_to)) {
      return {
        ...b, confirmed: true, overridden_by: undefined,
        reason_quote: match.reason_quote, clip_id: match.clip_id, screen_moment: match.screen_moment,
      };
    }
    return { ...b, confirmed: false, overridden_by: match.id };
  });
}
function normThen(t: Rule["then"]) {
  return {
    must: t.must ?? {}, must_not: t.must_not ?? {},
    must_not_action: [...(t.must_not_action ?? [])].sort(), escalate_to: t.escalate_to ?? "",
  };
}

// ---------- Redaction ----------
const PATTERNS: [RegExp, string][] = [
  [/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g, "[IBAN]"],
  [/\b(?:\d[ -]?){13,19}\b/g, "[CARD]"],
  [/\b(visa|mastercard|amex|card)\s+ending\s+(in\s+)?\d{4}\b/gi, "[CARD]"],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[EMAIL]"],
  [/(?:\+\d{1,3}[\s-]?)?(?:\(\d{2,4}\)[\s-]?)?\d{3,4}[\s-]\d{3,4}(?:[\s-]\d{2,4})?\b/g, "[PHONE]"],
];

// Redacts card numbers, IBANs, emails, phones, plus any extra known names (e.g. PII field values).
export function redact(text: string, names: string[] = []): string {
  let out = text;
  for (const [re, tag] of PATTERNS) out = out.replace(re, tag);
  for (const n of names.filter((x) => x && x.length > 2).sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[NAME]");
  }
  return out;
}

export const OFF_RECORD_TEXT = "[off the record]";

// Transcript as the panel may show and store it: off-record lines (and anything said inside an off-record window)
// replaced by a marker, PII redacted everywhere else.
export function redactTranscript(transcript: TranscriptLine[], names: string[] = []): TranscriptLine[] {
  const sorted = [...transcript].sort((a, b) => a.t - b.t);
  let off = false;
  return sorted.map((l) => {
    if (l.off_record) off = true; else if (off) off = false;
    return l.off_record || off ? { ...l, text: OFF_RECORD_TEXT } : { ...l, text: redact(l.text, names) };
  });
}

// Every string in a value, redacted. Used as a last pass over the Work Map so model-written text can't leak PII.
export function redactDeep<T>(value: T, names: string[] = []): T {
  if (typeof value === "string") return redact(value, names) as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, names)) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v, names)])) as T;
  return value;
}

// Redacts PII fields (per job profile) out of a record.
export function redactRecord(rec: Rec, job: JobProfile): Rec {
  const pii = new Set(job.screen.fields.filter((f) => f.pii).map((f) => f.key));
  return Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, pii.has(k) && v != null ? "[REDACTED]" : v]));
}

// ---------- Field names ----------
const snake = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// Vision may name a field by its visible label ("Refund to" -> refund_to). Map it back to the job key (refund_method).
export function canonicalField(job: JobProfile, name: string | undefined): string | undefined {
  if (!name) return name;
  const n = snake(name);
  const f = job.screen.fields.find((x) => x.key === name || snake(x.key) === n || snake(x.label) === n);
  return f ? f.key : name;
}

export function canonicalEvents(job: JobProfile, events: ScreenEvent[]): ScreenEvent[] {
  return events.map((e) => (e.field ? { ...e, field: canonicalField(job, e.field) } : e));
}

export function emptyWorkMap(job_id: string, expert: string): WorkMap {
  return { job_id, expert, steps: [], rules: [], open_gaps: [] };
}

export * from "./records";
export * from "./validate";
export * from "./eval";
