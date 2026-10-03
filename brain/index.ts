// brain package entry. Browser-safe: rule checker, redaction, scoreboard. Server-only code goes in server.ts.
import type {
  CheckResult, Condition, JobProfile, ProposedAction, Rule, Scoreboard, ScreenEvent, Value, WorkMap,
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

export function checkAction(a: ProposedAction, map: WorkMap): CheckResult {
  if (SAFE_ACTIONS.has(a.action)) return { ok: true };
  for (const rule of map.rules) {
    if (!rule.when.every((c) => evalCondition(c, a.record))) continue;
    const why = violation(rule, a.action, a.record)
      ?? (rule.then.escalate_to ? `this needs ${rule.then.escalate_to}` : null);
    if (!why) continue;
    return {
      ok: false,
      rule,
      explanation: `${rule.text} (${why}). In the expert's words: "${rule.reason_quote}"`,
      clip_id: rule.clip_id,
      screen_moment: rule.screen_moment,
    };
  }
  return { ok: true };
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

// ---------- Scoreboard ----------
export interface GroundTruthChange { t: number; field: string; from: Value; to: Value; record?: string; }

export interface ScoreInput {
  job: JobProfile;
  map: WorkMap;
  groundTruth?: GroundTruthChange[];
  events?: ScreenEvent[];
  tutor?: { catches: number; traps: number; false_alarms: number };
  questions?: { live: number; guardrail: number };
  // hidden rule id -> learned rule ids; filled by a judge/LLM later. Without it, counts confirmed rules capped at total.
  matches?: Record<string, string[]>;
}

export function score(s: ScoreInput): Scoreboard {
  const hidden = (s.job.hidden_rules as { id: string }[] | undefined) ?? [];
  const learned = s.matches
    ? hidden.filter((h) => (s.matches![h.id] ?? []).length > 0).length
    : Math.min(hidden.length, s.map.rules.filter((r) => r.confirmed).length);

  const gt = s.groundTruth ?? [];
  const evs = canonicalEvents(s.job, s.events ?? []).filter((e) => e.field);
  const hit = gt.filter((g) =>
    evs.some((e) => same(e.field, g.field) && same(e.to, g.to) && Math.abs(e.t - g.t) < 10_000)).length;

  return {
    rules_learned: learned,
    rules_total: hidden.length,
    vision_accuracy: gt.length ? hit / gt.length : 0,
    tutor_catches: s.tutor?.catches ?? 0,
    tutor_traps: s.tutor?.traps ?? 0,
    false_alarms: s.tutor?.false_alarms ?? 0,
    live_questions: s.questions?.live ?? 0,
    guardrail_questions: s.questions?.guardrail ?? 0,
  };
}

export function emptyWorkMap(job_id: string, expert: string): WorkMap {
  return { job_id, expert, steps: [], rules: [], open_gaps: [] };
}

export * from "./records";
