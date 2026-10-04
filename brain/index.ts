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

/**
 * Fields a rule may refer to that the screen shows only indirectly, computed generically from the job:
 * days_since_<x> / days_to_<x> for every <x>_date field (vs the job's business_date), and
 * payment_method = "card" when a non-empty card field is shown. Never overrides a field the screen has.
 */
export function deriveFields(job: JobProfile | null | undefined, rec: Rec): Rec {
  const out: Rec = { ...rec };
  const today = job ? Date.parse(job.job.business_date) : NaN;
  for (const [k, v] of Object.entries(rec)) {
    const m = /^(.+)_date$/.exec(k);
    if (!m || typeof v !== "string" || !v || Number.isNaN(today)) continue;
    const d = Date.parse(v);
    if (Number.isNaN(d)) continue;
    const days = Math.round((today - d) / 86_400_000);
    if (out[`days_since_${m[1]}`] === undefined) out[`days_since_${m[1]}`] = days;
    if (out[`days_to_${m[1]}`] === undefined) out[`days_to_${m[1]}`] = -days;
  }
  if (out.payment_method === undefined && "card" in rec) {
    out.payment_method = rec.card != null && String(rec.card).trim() !== "" ? "card" : null;
  }
  return out;
}

export function checkAction(a: ProposedAction, map: WorkMap, opts: CheckOptions = {}): CheckResult {
  if (SAFE_ACTIONS.has(a.action)) return { ok: true };
  const sets = opts.job?.screen.actions.find((x) => x.key === a.action)?.sets ?? {};
  a = { ...a, record: deriveFields(opts.job, a.record) };
  const after: Rec = { ...a.record, ...sets };
  // Superseded baselines (overridden, or matched by a company rule) never enforce on their own.
  const active = map.rules.filter((r) => !r.overridden_by && !r.confirmed_by);
  // Company rules first. Preview (includeUnconfirmed) also counts unconfirmed company rules. Baseline rules only
  // speak when no company rule covers the case: as the industry-standard fallback, or when previewing/probing
  // (engine's question picker checks a map of baseline rules with includeUnconfirmed and baselineFallback off).
  const company = active.filter((r) => r.source !== "baseline" || r.confirmed).filter((r) => r.confirmed || opts.includeUnconfirmed);
  const covered = company.some((r) => r.when.every((c) => evalCondition(c, a.record)));
  const fallback = covered || (opts.baselineFallback === false && !opts.includeUnconfirmed)
    ? []
    : active.filter((r) => r.source === "baseline" && !r.confirmed);
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
  const valueKey = (v: Value | undefined) => v == null ? null : String(v).trim().toLowerCase();
  const conditionKey = (c: Condition) => JSON.stringify([c.field, c.op,
    c.op === "missing" || c.op === "present" ? null
      : Array.isArray(c.value) ? [...new Set(c.value.map(valueKey))].sort() : valueKey(c.value),
  ]);
  const conditions = (r: Rule) => [...new Set(r.when.map(conditionKey))].sort();
  const sameConditions = (x: Rule, y: Rule) => JSON.stringify(conditions(x)) === JSON.stringify(conditions(y));
  const direction = (op: Condition["op"]) => ["gt", "gte"].includes(op) ? "above" : ["lt", "lte"].includes(op) ? "below" : null;
  // A company can change a numeric limit without changing who approves it. That replaces the
  // baseline limit; disjoint categorical cases (Opened vs New) do not replace each other.
  const changedLimit = (x: Rule, y: Rule) => {
    const matches = (a: Condition, b: Condition) => conditionKey(a) === conditionKey(b)
      || (a.field === b.field && direction(a.op) !== null && direction(a.op) === direction(b.op)
        && typeof a.value === "number" && typeof b.value === "number");
    return x.when.length === y.when.length && x.when.every(a => y.when.some(b => matches(a, b)))
      && y.when.every(b => x.when.some(a => matches(a, b)));
  };
  // Same intent unless the two rules actually conflict: a required value that differs, a value one requires and the
  // other forbids, or different people to escalate to. Wording and extra detail ("at the lowest price") don't count.
  const sameOutcome = (x: Rule, y: Rule) => !conflicts(x.then, y.then) && overlaps(x.then, y.then);
  return carried.map((b) => {
    if (b.source !== "baseline") return b;
    const relatedOutcome = (l: Rule) => conflicts(b.then, l.then) || overlaps(b.then, l.then);
    const match = learned.find((l) => sameConditions(b, l) && relatedOutcome(l))
      ?? learned.find((l) => changedLimit(b, l) && relatedOutcome(l));
    if (!match) return b;
    if (sameConditions(b, match) && sameOutcome(b, match)) {
      return {
        ...b, confirmed: true, overridden_by: undefined, override_quote: undefined, confirmed_by: match.id,
        reason_quote: match.reason_quote, clip_id: match.clip_id, screen_moment: match.screen_moment,
      };
    }
    return { ...b, confirmed: false, confirmed_by: undefined, overridden_by: match.id, override_quote: match.reason_quote };
  });
}

/**
 * The expert went against a baseline rule and explained why, but the explanation did not yield a checkable rule
 * (e.g. a permission: "we do refund cash here"). The baseline rule is still overridden at this company.
 */
export function overrideByDecisions(
  carried: Rule[],
  decisions: { id: string; record?: string; why: string | null; quotes: string[]; event: { field?: string; to?: Value } }[],
  valuesFor: (recordId: string | undefined) => Rec | null,
): Rule[] {
  return carried.map((b) => {
    if (b.source !== "baseline" || b.confirmed || b.overridden_by) return b;
    for (const d of decisions) {
      if (d.why === null || !d.event.field) continue;
      const rec: Rec = { ...(valuesFor(d.record) ?? {}), [d.event.field]: d.event.to ?? null };
      if (!b.when.every((c) => evalCondition(c, rec))) continue;
      const must = b.then.must?.[d.event.field];
      const mustNot = b.then.must_not?.[d.event.field];
      const broke = (must !== undefined && !same(must, d.event.to))
        || (mustNot !== undefined && same(mustNot, d.event.to));
      if (broke) return { ...b, overridden_by: d.id, override_quote: d.quotes[0] ?? d.why ?? undefined };
    }
    return b;
  });
}
function conflicts(a: Rule["then"], b: Rule["then"]): boolean {
  const eq = (x: unknown, y: unknown) => String(x ?? "").trim().toLowerCase() === String(y ?? "").trim().toLowerCase();
  for (const [k, v] of Object.entries(a.must ?? {})) {
    if (b.must && k in b.must && !eq(b.must[k], v)) return true;
    if (b.must_not && k in b.must_not && eq(b.must_not[k], v)) return true;
  }
  for (const [k, v] of Object.entries(b.must ?? {})) if (a.must_not && k in a.must_not && eq(a.must_not[k], v)) return true;
  if (a.escalate_to && b.escalate_to && !eq(a.escalate_to, b.escalate_to)) return true;
  return false;
}
/** They say something in common: a shared required value, a shared blocked action, or the same escalation. */
function overlaps(a: Rule["then"], b: Rule["then"]): boolean {
  const eq = (x: unknown, y: unknown) => String(x ?? "").trim().toLowerCase() === String(y ?? "").trim().toLowerCase();
  if (Object.entries(a.must ?? {}).some(([k, v]) => b.must && k in b.must && eq(b.must[k], v))) return true;
  if (Object.entries(a.must_not ?? {}).some(([k, v]) => b.must_not && k in b.must_not && eq(b.must_not[k], v))) return true;
  if ((a.must_not_action ?? []).some((x) => (b.must_not_action ?? []).includes(x))) return true;
  return !!a.escalate_to && eq(a.escalate_to, b.escalate_to);
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
export * from "./guide";
