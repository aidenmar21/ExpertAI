// Rule validation. Pure and browser-safe (no SDK, no env): the server runs it on every model-generated rule.
import type { JobProfile, Op, Rule, RuleType, ScreenEvent, Value } from "@understudy/shared";
import { canonicalEvents, checkAction } from "./index";
import type { DecisionRecord } from "./records";

// What the model returns for one rule (flat lists so a strict JSON schema can describe it).
export interface RuleCandidate {
  record_id: string;
  text: string;
  type: RuleType;
  when: { field: string; op: string; value: unknown; evidence?: string }[];   // evidence: words in reason_quote that state this condition
  must: { field: string; value: string | number | null }[];
  must_not: { field: string; value: string | number | null }[];
  must_not_action: string[];
  escalate_to: string | null;
  reason_quote: string;
}

// Where a rule came from: the record, the exact quote, and when it was said.
export interface RuleEvidence {
  record_id: string;
  quote_index: number;           // index into record.quotes
  quote_t: number | null;        // transcript t of that answer
  event_ids: string[];
}

export interface Rejection { candidate: RuleCandidate; reason: string }

// A decision the expert actually made on screen: final values and the action they took.
export interface ExpertCase { record: string; values: Record<string, Value>; action: string }

export const RULE_TYPES: RuleType[] = ["judgment", "guardrail", "exception", "limit", "stop_and_ask"];
export const OPS: Op[] = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "missing", "present"];
const NUMERIC: Op[] = ["gt", "gte", "lt", "lte"];
const UNIVERSAL = /\b(always|every|any|all|never|no matter)\b/i;

// Sentences of an expert answer. A rule's quote must sit inside one, so two independent statements don't merge.
export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
}

export function normQuote(s: string): string {
  return s.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9$€.']+/g, " ").trim();
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const isScalar = (v: unknown): v is string | number | null =>
  v === null || typeof v === "string" || (typeof v === "number" && Number.isFinite(v));

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\s*[$€]?\s*-?\d+(\.\d+)?\s*$/.test(v)) return Number(v.replace(/[^0-9.\-]/g, ""));
  return null;
}

// Expert's own decisions, from on-screen record values plus what they changed. Used to reject over-broad rules.
export function expertCases(job: JobProfile, events: ScreenEvent[], valuesFor: (record: string) => Record<string, Value> | null): ExpertCase[] {
  const byRecord = new Map<string, ScreenEvent[]>();
  for (const e of canonicalEvents(job, events)) if (e.record) byRecord.set(e.record, [...(byRecord.get(e.record) ?? []), e]);
  const out: ExpertCase[] = [];
  for (const [record, evs] of byRecord) {
    const base = valuesFor(record);
    if (!base) continue;
    const values: Record<string, Value> = { ...base };
    let finalStatus: Value | undefined;
    for (const e of evs.sort((a, b) => a.t - b.t)) {
      if (!e.field || e.to === undefined) continue;
      if (e.field === "status") finalStatus = e.to;
      else values[e.field] = e.to;
    }
    const action = finalStatus === undefined ? undefined
      : job.screen.actions.find((a) => String(a.sets.status ?? "").toLowerCase() === String(finalStatus).toLowerCase());
    if (action) out.push({ record, values, action: action.key });
  }
  return out;
}

export interface ValidateOptions {
  job: JobProfile;
  records: DecisionRecord[];
  cases?: ExpertCase[];          // expert's own decisions; a rule that would block one is too broad
}

// Turns model candidates into Rules. Every rejection says why, so the model can repair it once.
export function validateCandidates(cands: RuleCandidate[], o: ValidateOptions): { rules: Rule[]; evidence: Record<string, RuleEvidence>; rejected: Rejection[] } {
  const fields = new Map(o.job.screen.fields.map((f) => [f.key, f]));
  const actions = new Set(o.job.screen.actions.map((a) => a.key));
  const byId = new Map(o.records.map((r) => [r.id, r]));
  const rules: Rule[] = [], rejected: Rejection[] = [];
  const evidence: Record<string, RuleEvidence> = {};
  const reject = (candidate: RuleCandidate, reason: string) => { rejected.push({ candidate, reason }); };

  const badValue = (field: string, v: unknown): string | null => {
    const f = fields.get(field);
    if (!f) return `field "${field}" is not on screen`;
    if (f.options && typeof v === "string" && !f.options.some((x) => x.toLowerCase() === v.toLowerCase()))
      return `"${v}" is not an option of ${field} (${f.options.join(", ")})`;
    return null;
  };

  for (const c of cands) {
    const rec = byId.get(c.record_id);
    if (!rec) { reject(c, `unknown record_id ${c.record_id}`); continue; }
    if (rec.why === null) { reject(c, "the expert never explained this decision"); continue; }

    // 1. Exact expert quote, linked to the answer it came from.
    const q = normQuote(c.reason_quote ?? "");
    const qi = q.length >= 8 ? rec.quotes.findIndex((x) => normQuote(x).includes(q)) : -1;
    if (qi < 0) { reject(c, "reason_quote is not the expert's exact words from this record"); continue; }
    if (!sentences(rec.quotes[qi]).some((x) => normQuote(x).includes(q))) {
      reject(c, "reason_quote spans more than one sentence; quote the single sentence that states this rule"); continue;
    }

    // 2. Conditions: supported op, real field, right value shape.
    if (!RULE_TYPES.includes(c.type)) { reject(c, `unsupported rule type ${c.type}`); continue; }
    const when: Rule["when"] = [];
    let err: string | null = null;
    for (const w of c.when) {
      const op = w.op as Op;
      const ev = normQuote(w.evidence ?? "");
      if (!ev || !q.includes(ev)) {
        err = `condition ${w.field} ${w.op} is not stated in the rule's own quote "${c.reason_quote}" (evidence: ${JSON.stringify(w.evidence ?? "")})`; break;
      }
      if (!OPS.includes(op)) { err = `unsupported op "${w.op}"`; break; }
      if (!fields.has(w.field)) { err = `field "${w.field}" is not on screen`; break; }
      if (op === "missing" || op === "present") { when.push({ field: w.field, op }); continue; }
      if (NUMERIC.includes(op)) {
        const n = toNumber(w.value);
        if (n === null) { err = `${op} on ${w.field} needs a number, got ${JSON.stringify(w.value)}`; break; }
        when.push({ field: w.field, op, value: n }); continue;
      }
      if (op === "in") {
        if (!Array.isArray(w.value) || !w.value.length || !w.value.every(isScalar)) { err = `in on ${w.field} needs a non-empty list`; break; }
        err = (w.value as Value[]).map((v) => badValue(w.field, v)).find(Boolean) ?? null;
        if (err) break;
        when.push({ field: w.field, op, value: w.value as Value[] }); continue;
      }
      if (!isScalar(w.value) || w.value === null) { err = `${op} on ${w.field} needs a value`; break; }
      err = badValue(w.field, w.value);
      if (err) break;
      when.push({ field: w.field, op, value: w.value });
    }
    if (err) { reject(c, err); continue; }

    // 3. Outcome: real fields/actions, and something checkable.
    const kv = (xs: RuleCandidate["must"]) => {
      for (const x of xs) { const e = badValue(x.field, x.value); if (e) return e; }
      return null;
    };
    err = kv(c.must) ?? kv(c.must_not) ?? (c.must_not_action.find((a) => !actions.has(a)) ? `unknown action in ${JSON.stringify(c.must_not_action)}` : null);
    if (err) { reject(c, err); continue; }
    const then: Rule["then"] = {};
    if (c.must.length) then.must = Object.fromEntries(c.must.map((x) => [x.field, x.value]));
    if (c.must_not.length) then.must_not = Object.fromEntries(c.must_not.map((x) => [x.field, x.value]));
    if (c.must_not_action.length) then.must_not_action = c.must_not_action;
    if (c.escalate_to) then.escalate_to = c.escalate_to;
    if (!Object.keys(then).length) { reject(c, "rule has no checkable outcome"); continue; }

    // 4. Breadth: no conditions only if the expert spoke universally.
    if (!when.length && !UNIVERSAL.test(rec.quotes[qi])) { reject(c, "no conditions, but the expert did not say this applies always"); continue; }

    const rule: Rule = {
      id: `rule-${rec.id}-${hash(JSON.stringify([when, then, q]))}`,
      text: c.text, type: c.type, when, then,
      reason_quote: c.reason_quote,
      screen_moment: rec.sources.screen_moment,
      clip_id: rec.sources.clip_id,
      source: rec.status === "corrected" ? "debrief" : "live_question",
      confirmed: false,                            // only teach-back confirms
    };

    // 5. Breadth: must not block a decision the expert actually made.
    const clash = (o.cases ?? []).find((k) =>
      !checkAction({ action: k.action, record: k.values }, { job_id: "", expert: "", steps: [], open_gaps: [], rules: [rule] }, { job: o.job, includeUnconfirmed: true }).ok);
    if (clash) { reject(c, `too broad: it would block the expert's own "${clash.action}" on ${clash.record}`); continue; }

    if (rules.some((r) => r.id === rule.id)) continue;   // duplicate
    rules.push(rule);
    evidence[rule.id] = { record_id: rec.id, quote_index: qi, quote_t: rec.quote_t?.[qi] ?? null, event_ids: rec.sources.event_ids };
  }
  return { rules, evidence, rejected };
}
