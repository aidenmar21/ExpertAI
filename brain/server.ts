// brain server entry. Only import from app API routes: uses ANTHROPIC_API_KEY and LLM_MODEL, never sent to the browser.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  JobProfile, Rule, RuleType, ScreenEvent, TranscriptLine, WorkMap, WorkMapStep,
} from "@understudy/shared";
import { canonicalEvents, emptyWorkMap } from "./index";
import { captureDecisions, recordsToGaps, type DecisionRecord } from "./records";

export interface BuildWorkMapInput {
  job_id: string;
  expert: string;
  events: ScreenEvent[];
  transcript: TranscriptLine[];
  previous?: WorkMap;
}

// WorkMap plus the decision records it was built from. Extra field is structurally compatible with WorkMap.
export type WorkMapWithRecords = WorkMap & { records: DecisionRecord[] };

// ---------- Job profile (agent-safe view) ----------
const JOB_DIRS = [join(process.cwd(), "shared/jobs"), join(process.cwd(), "../shared/jobs")];

export function loadJob(job_id: string): JobProfile | null {
  if (!/^[a-z0-9-]+$/.test(job_id)) return null;
  for (const d of JOB_DIRS) {
    const p = join(d, `${job_id}.json`);
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8")) as JobProfile;
  }
  return null;
}

// Only what the screen shows plus written policy. hidden_rules, cases, traps never leave this function.
export function agentSafeJob(job: JobProfile) {
  return { job: job.job, screen: job.screen };
}

// On-screen values of the case a record is about (from the job's fake records), PII fields removed.
export function screenValues(job: JobProfile | null, recordId: string | undefined): Record<string, unknown> | null {
  if (!job || !recordId) return null;
  const pii = new Set(job.screen.fields.filter((f) => f.pii).map((f) => f.key));
  const recs = (job.records as { expert?: Record<string, unknown>[]; new_hire?: Record<string, unknown>[] } | undefined) ?? {};
  const hit = [...(recs.expert ?? []), ...(recs.new_hire ?? [])].find((r) => Object.values(r).includes(recordId));
  return hit ? Object.fromEntries(Object.entries(hit).filter(([k]) => !pii.has(k))) : null;
}

function piiValues(job: JobProfile | null): string[] {
  if (!job) return [];
  const keys = new Set(job.screen.fields.filter((f) => f.pii).map((f) => f.key));
  const recs = (job.records as { expert?: Record<string, unknown>[]; new_hire?: Record<string, unknown>[] } | undefined) ?? {};
  const out = new Set<string>();
  for (const r of [...(recs.expert ?? []), ...(recs.new_hire ?? [])])
    for (const [k, v] of Object.entries(r)) if (keys.has(k) && typeof v === "string") out.add(v);
  return [...out];
}

// ---------- LLM refinement: records -> Rules ----------
const RULE_TYPES: RuleType[] = ["judgment", "guardrail", "exception", "limit", "stop_and_ask"];
const OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "missing", "present"];
const SCALAR = { type: ["string", "number", "null"] };

const RULES_SCHEMA = {
  type: "object",
  properties: {
    rules: {
      type: "array",
      items: {
        type: "object",
        properties: {
          record_id: { type: "string" },
          text: { type: "string" },
          type: { type: "string", enum: RULE_TYPES },
          when: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field: { type: "string" },
                op: { type: "string", enum: OPS },
                value: { anyOf: [SCALAR, { type: "array", items: SCALAR }] },
              },
              required: ["field", "op", "value"],
              additionalProperties: false,
            },
          },
          must: { type: "array", items: { type: "object", properties: { field: { type: "string" }, value: SCALAR }, required: ["field", "value"], additionalProperties: false } },
          must_not: { type: "array", items: { type: "object", properties: { field: { type: "string" }, value: SCALAR }, required: ["field", "value"], additionalProperties: false } },
          must_not_action: { type: "array", items: { type: "string" } },
          escalate_to: { type: ["string", "null"] },
          reason_quote: { type: "string" },
        },
        required: ["record_id", "text", "type", "when", "must", "must_not", "must_not_action", "escalate_to", "reason_quote"],
        additionalProperties: false,
      },
    },
  },
  required: ["rules"],
  additionalProperties: false,
} as const;

export type LlmRule = {
  record_id: string; text: string; type: RuleType;
  when: { field: string; op: string; value: unknown }[];
  must: { field: string; value: string | number | null }[];
  must_not: { field: string; value: string | number | null }[];
  must_not_action: string[]; escalate_to: string | null; reason_quote: string;
};

const SYSTEM = `You turn an expert's spoken explanations into checkable work rules.
Strict grounding:
- Use ONLY what the expert said in the decision records' quotes. Never add rules from general knowledge or the written policy alone.
- reason_quote must be copied verbatim (a contiguous substring) from one of that record's quotes.
- If a record's why is null, produce no rule for it.
- Conditions use only the listed screen field keys; actions use only the listed action keys.
- A rule with no conditions applies to every case, so only emit when=[] if the expert said "always".
- Use op "missing" for "no receipt"-style statements, numeric ops for amount limits.
- Scope: each record has screen_values (what was on screen for that case). Include a condition on every field the expert's reason depends on, so the rule does NOT fire on cases where the reason doesn't apply. Example: "opened access codes are never refundable" needs condition=Opened AND the item field identifying the access-code product, not condition alone. If the distinguishing value can only be named exactly, use eq or in with the exact on-screen value(s).
Return {"rules": []} if nothing is grounded.`;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9$€.]+/g, " ").trim();
}

function toRule(l: LlmRule, rec: DecisionRecord, job: JobProfile | null, i: number): Rule | null {
  const quotes = rec.quotes.map(norm).join(" | ");
  if (!l.reason_quote || !quotes.includes(norm(l.reason_quote))) return null; // not the expert's words
  const fields = new Set(job?.screen.fields.map((f) => f.key) ?? []);
  const actions = new Set(job?.screen.actions.map((a) => a.key) ?? []);
  if (job && l.when.some((c) => !fields.has(c.field))) return null;
  const kv = (xs: { field: string; value: string | number | null }[]) =>
    xs.length ? Object.fromEntries(xs.filter((x) => !job || fields.has(x.field)).map((x) => [x.field, x.value])) : undefined;
  const then: Rule["then"] = {
    must: kv(l.must), must_not: kv(l.must_not),
    must_not_action: l.must_not_action.filter((a) => !job || actions.has(a)),
    escalate_to: l.escalate_to ?? undefined,
  };
  if (!then.must_not_action?.length) delete then.must_not_action;
  if (!then.must && !then.must_not && !then.must_not_action && !then.escalate_to) return null; // not checkable
  return {
    id: `rule-${rec.id}-${i}`,
    text: l.text,
    type: RULE_TYPES.includes(l.type) ? l.type : "judgment",
    when: l.when.map((c) => ({ field: c.field, op: c.op as Rule["when"][number]["op"], value: c.value as Rule["when"][number]["value"] })),
    then,
    reason_quote: l.reason_quote,
    screen_moment: rec.sources.screen_moment,
    clip_id: rec.sources.clip_id,
    source: "live_question",
    confirmed: rec.status === "confirmed",
  };
}

// Keeps only rules whose quote is the expert's own words and whose fields/actions exist on screen.
export function groundRules(llm: LlmRule[], records: DecisionRecord[], job: JobProfile | null): Rule[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  return llm.flatMap((l, i) => {
    const rec = byId.get(l.record_id);
    const rule = rec && rec.why !== null ? toRule(l, rec, job, i) : null;
    return rule ? [rule] : [];
  });
}

export async function extractRules(records: DecisionRecord[], job: JobProfile | null): Promise<Rule[]> {
  const grounded = records.filter((r) => r.why !== null);
  if (!grounded.length || !process.env.ANTHROPIC_API_KEY) return [];
  const client = new Anthropic();
  const payload = {
    job: job ? agentSafeJob(job) : null,
    records: grounded.map((r) => ({
      record_id: r.id, record: r.record, screen_values: screenValues(job, r.record), what: r.what, how: r.how, why: r.why,
      exceptions: r.exceptions, guardrails: r.guardrails, escalate_to: r.escalate_to ?? null, quotes: r.quotes,
    })),
  };
  try {
    const res = await client.messages.create({
      model: process.env.LLM_MODEL || "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: RULES_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return [];
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return groundRules((JSON.parse(text) as { rules: LlmRule[] }).rules, records, job);
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error(`[brain] rule extraction failed: ${err.status} ${err.message}`);
    else console.error("[brain] rule extraction failed:", err);
    return [];   // Work Map still has records + gaps; rules arrive on the next build
  }
}

// ---------- buildWorkMap ----------
function stepsFrom(records: DecisionRecord[], rules: Rule[]): WorkMapStep[] {
  return records.map((r, i) => ({
    n: i + 1,
    title: r.what,
    screen_moment: r.sources.screen_moment,
    decision: r.how ?? r.what,
    rule_ids: rules.filter((x) => x.id.startsWith(`rule-${r.id}-`)).map((x) => x.id),
  }));
}

// Rebuilds from the full event + transcript history each time (callers pass everything so far).
// Rules from `previous` that are confirmed are kept; everything else is re-derived from the expert's words.
export async function buildWorkMap(input: BuildWorkMapInput): Promise<WorkMapWithRecords> {
  const job = loadJob(input.job_id);
  const prevRecords = ((input.previous as WorkMapWithRecords | undefined)?.records ?? []);
  const confirmedIds = new Set(prevRecords.filter((r) => r.status !== "unconfirmed").map((r) => r.id));

  const records = captureDecisions({
    events: job ? canonicalEvents(job, input.events) : input.events, transcript: input.transcript,
    piiNames: piiValues(job), escalateTo: job?.job.escalate_to,
  }).map((r) => {
    const prev = prevRecords.find((p) => p.id === r.id);
    return prev && confirmedIds.has(r.id) ? { ...r, status: prev.status } : r;
  });

  const keep = (input.previous?.rules ?? []).filter((r) => r.confirmed);
  const fresh = await extractRules(records, job);
  const rules = [...keep, ...fresh.filter((f) => !keep.some((k) => k.id === f.id))];

  return {
    ...(input.previous ?? emptyWorkMap(input.job_id, input.expert)),
    job_id: input.job_id,
    expert: input.expert,
    steps: stepsFrom(records, rules),
    rules,
    open_gaps: recordsToGaps(records),
    records,
  };
}

// Teach-back confirmed: mark every grounded record and rule confirmed.
export function confirmWorkMap(map: WorkMapWithRecords, at = new Date().toISOString()): WorkMapWithRecords {
  return {
    ...map,
    rules: map.rules.map((r) => ({ ...r, confirmed: true })),
    records: map.records.map((r) => (r.why !== null ? { ...r, status: "confirmed" as const } : r)),
    confirmed_at: at,
  };
}
