// brain server entry. Only import from app API routes: uses ANTHROPIC_API_KEY and LLM_MODEL, never sent to the browser.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  JobProfile, Rule, ScreenEvent, TranscriptLine, Value, WorkMap, WorkMapStep,
} from "@understudy/shared";
import { canonicalEvents, emptyWorkMap, onRecordOnly } from "./index";
import {
  applyCorrections, applyLinks, captureDecisions, linksToCorrections, recordsToGaps, unlinkedExpertLines, validateLinks,
  type DecisionRecord, type LineLink, type WorkMapWithRecords,
} from "./records";
import {
  OPS, RULE_TYPES, expertCases, validateCandidates,
  type Rejection, type RuleCandidate, type RuleEvidence,
} from "./validate";

export type { WorkMapWithRecords } from "./records";

export interface BuildWorkMapInput {
  job_id: string;
  expert: string;
  events: ScreenEvent[];
  transcript: TranscriptLine[];
  previous?: WorkMap;
}

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
export function screenValues(job: JobProfile | null, recordId: string | undefined): Record<string, Value> | null {
  if (!job || !recordId) return null;
  const pii = new Set(job.screen.fields.filter((f) => f.pii).map((f) => f.key));
  const recs = (job.records as { expert?: Record<string, unknown>[]; new_hire?: Record<string, unknown>[] } | undefined) ?? {};
  const hit = [...(recs.expert ?? []), ...(recs.new_hire ?? [])].find((r) => Object.values(r).includes(recordId));
  return hit ? Object.fromEntries(Object.entries(hit).filter(([k]) => !pii.has(k))) as Record<string, Value> : null;
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

// ---------- Model extraction: records -> candidate rules -> validated Rules ----------
const SCALAR = { type: ["string", "number", "null"] };
const PAIR = { type: "object", properties: { field: { type: "string" }, value: SCALAR }, required: ["field", "value"], additionalProperties: false };

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
                evidence: { type: "string" },
              },
              required: ["field", "op", "value", "evidence"],
              additionalProperties: false,
            },
          },
          must: { type: "array", items: PAIR },
          must_not: { type: "array", items: PAIR },
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

const SYSTEM = `You turn an expert's spoken explanations into checkable work rules.
Strict grounding:
- Use ONLY what the expert said in the decision records' quotes. Never add rules from general knowledge or the written policy alone.
- reason_quote must be copied verbatim (a contiguous substring) from one of that record's quotes, and stay inside ONE sentence.
- Every condition needs "evidence": the exact words inside reason_quote that state it (e.g. "over a hundred dollars" for price gt 100, "access codes" for the item condition). A condition whose words are not in reason_quote is not allowed, even if the expert said them in another sentence.
- If a record's why is null, produce no rule for it.
- Conditions use only the listed screen field keys; actions use only the listed action keys; select values only from the field's options.
- A rule with no conditions applies to every case, so only emit when=[] if the expert said "always" or "never".
- Use op "missing" for "no receipt"-style statements, numeric ops with a plain number for amount limits.
- Scope conditions to the quote, not the case. Add a condition only for something the expert's words state or directly imply ("over a hundred dollars" -> price gt 100; "no receipt" -> receipt_no missing). Never copy other facts of the case the expert happened to be on: a general statement made during a no-receipt case is still general.
- screen_values shows what was on screen for that case. Use it only to find the exact field and value for something the expert named (e.g. "access codes" -> item eq the on-screen access-code product). Use eq or in with the exact on-screen value(s).
- Outcomes: must / must_not are field values after the action; must_not_action lists actions to block; escalate_to blocks every action except handing off. Prefer must_not_action when the expert only restricts some actions (e.g. "I call the manager before refunding" -> must_not_action [refund], escalate_to manager).
- When one answer states several independent rules, emit them as separate rules.
- status "corrected": the expert replaced their earlier reasoning (replaced_reasoning, context only, never quote it). Emit every rule the corrected quotes state, including changed limits ("the shift manager limit is two hundred dollars, not a hundred" -> price gt 200, escalate to the shift manager, blocking the actions the replaced rule blocked). Use the replaced reasoning only to understand what the limit or rule applies to. Quote and evidence must come from the corrected quotes.
Return {"rules": []} if nothing is grounded.`;

export interface ExtractResult {
  rules: Rule[];
  evidence: Record<string, RuleEvidence>;
  rejected: Rejection[];
  model?: string;
  calls: number;
  ok: boolean;          // the model answered and its output was validated (false = retry on next build)
}

async function callModel(client: Anthropic, model: string, user: unknown): Promise<RuleCandidate[] | null> {
  const res = await client.messages.create({
    model,
    max_tokens: 16000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: RULES_SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(user) }],
  });
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") {
    console.error(`[brain] rule extraction stopped: ${res.stop_reason}`);
    return null;
  }
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return (JSON.parse(text) as { rules: RuleCandidate[] }).rules;
}

// Asks the model for rules, validates every one, and gives rejected rules one repair round.
export async function extractRules(records: DecisionRecord[], job: JobProfile, cases: ReturnType<typeof expertCases> = []): Promise<ExtractResult> {
  const grounded = records.filter((r) => r.why !== null);
  const empty: ExtractResult = { rules: [], evidence: {}, rejected: [], calls: 0, ok: false };
  if (!grounded.length || !process.env.ANTHROPIC_API_KEY) return empty;
  const client = new Anthropic();
  const model = process.env.LLM_MODEL || "claude-opus-5-5";
  const payload = {
    job: agentSafeJob(job),
    records: grounded.map((r) => ({
      record_id: r.id, record: r.record, status: r.status, screen_values: screenValues(job, r.record), what: r.what, how: r.how, why: r.why,
      exceptions: r.exceptions, guardrails: r.guardrails, escalate_to: r.escalate_to ?? null, quotes: r.quotes,
      // Context only: what the correction replaced. Never quote it; reason_quote must come from `quotes`.
      replaced_reasoning: r.superseded ? r.superseded.quotes : undefined,
    })),
  };
  try {
    const first = await callModel(client, model, payload);
    if (!first) return { ...empty, model, calls: 1 };
    const v1 = validateCandidates(first, { job, records, cases });
    if (!v1.rejected.length) return { ...v1, model, calls: 1, ok: true };

    // One repair round: show the model exactly why each rule failed. It may fix or drop them.
    const repair = await callModel(client, model, {
      ...payload,
      repair: "These rules failed validation. Return corrected versions of them, or omit any that cannot be grounded and scoped correctly. Return only rules for the listed failures.",
      rejected: v1.rejected.map((r) => ({ rule: r.candidate, reason: r.reason })),
    });
    const v2 = validateCandidates(repair ?? [], { job, records, cases });
    const rules = [...v1.rules, ...v2.rules.filter((r) => !v1.rules.some((x) => x.id === r.id))];
    return {
      rules,
      evidence: { ...v1.evidence, ...v2.evidence },
      rejected: [...v1.rejected.map((r) => ({ ...r, reason: `${r.reason} (sent for repair)` })), ...v2.rejected],
      model, calls: 2, ok: true,
    };
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error(`[brain] rule extraction failed: ${err.status} ${err.message}`);
    else console.error("[brain] rule extraction failed:", err);
    return { ...empty, model, calls: 1 };   // Work Map still has records + gaps; rules arrive on the next build
  }
}

// ---------- Late links: debrief answers and teach-back corrections ----------
const LINKS_SCHEMA = {
  type: "object",
  properties: {
    links: {
      type: "array",
      items: {
        type: "object",
        properties: {
          line_t: { type: "number" },
          record_id: { type: "string" },
          kind: { type: "string", enum: ["why", "exception", "guardrail", "correction"] },
          text: { type: "string" },
        },
        required: ["line_t", "record_id", "kind", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["links"],
  additionalProperties: false,
} as const;

const LINK_SYSTEM = `You connect an expert's later remarks (debrief answers, teach-back corrections) to the decisions they explain.
For each expert line, decide if it is about one of the listed decisions. If it is, return a link:
- kind "why": it explains a decision whose why is null or adds a reason.
- kind "exception": what would make them decide differently.
- kind "guardrail": when they would stop, escalate, or never do something.
- kind "correction": it changes or contradicts reasoning already recorded for that decision ("no, it's two hundred, not a hundred").
- text: copy the relevant words verbatim from the line. Never paraphrase.
Skip lines that are small talk, confirmations ("yes, that's right"), or not about a listed decision. Return {"links": []} if none apply.`;

// Asks the model to link expert lines no question captured. Returns validated links, or null if the call failed.
export async function linkLines(records: DecisionRecord[], lines: TranscriptLine[], transcript: TranscriptLine[]): Promise<LineLink[] | null> {
  if (!lines.length || !records.length || !process.env.ANTHROPIC_API_KEY) return lines.length ? null : [];
  const client = new Anthropic();
  const before = (t: number) => [...transcript].reverse().find((l) => l.t < t && l.speaker === "agent" && !l.off_record)?.text ?? null;
  try {
    const res = await client.messages.create({
      model: process.env.LLM_MODEL || "claude-opus-5-5",
      max_tokens: 8000,
      output_config: { effort: "low", format: { type: "json_schema", schema: LINKS_SCHEMA } },
      system: LINK_SYSTEM,
      messages: [{ role: "user", content: JSON.stringify({
        decisions: records.map((r) => ({ record_id: r.id, record: r.record, what: r.what, how: r.how, why: r.why, quotes: r.quotes })),
        expert_lines: lines.map((l) => ({ line_t: l.t, agent_asked: before(l.t), text: l.text })),
      }) }],
    });
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return validateLinks((JSON.parse(text) as { links: LineLink[] }).links, records, lines);
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error(`[brain] line linking failed: ${err.status} ${err.message}`);
    else console.error("[brain] line linking failed:", err);
    return null;
  }
}

// ---------- buildWorkMap ----------
function stepsFrom(records: DecisionRecord[], rules: Rule[], evidence: Record<string, RuleEvidence>): WorkMapStep[] {
  return records.map((r, i) => ({
    n: i + 1,
    title: r.what,
    screen_moment: r.sources.screen_moment,
    decision: r.how ?? r.what,
    rule_ids: rules.filter((x) => evidence[x.id]?.record_id === r.id).map((x) => x.id),
  }));
}

const signature = (r: DecisionRecord) => JSON.stringify(r.quotes);

// Rebuilds from the full event + transcript history each time (callers pass everything so far).
// A record whose quotes are unchanged keeps its previous rules (and their confirmation) without a model call.
// A record whose quotes changed (new answer or a correction) loses its old rules, which are re-extracted unconfirmed.
export async function buildWorkMap(input: BuildWorkMapInput): Promise<WorkMapWithRecords> {
  const job = loadJob(input.job_id);
  if (!job) throw new Error(`[brain] unknown job ${input.job_id}`);
  const prev = input.previous as WorkMapWithRecords | undefined;
  const corrections = prev?.corrections ?? [];
  const pii = piiValues(job);
  const events = canonicalEvents(job, input.events);

  let records = captureDecisions({ events, transcript: input.transcript, piiNames: pii, escalateTo: job.job.escalate_to });

  // Late links: expert lines no question captured (debrief answers, spoken corrections). Each line is sent to the model once.
  const links: Record<string, LineLink | null> = { ...(prev?.links ?? {}) };
  const fresh = unlinkedExpertLines(records, input.transcript).filter((l) => !(String(l.t) in links));
  const found = await linkLines(records, fresh, input.transcript);
  if (found) {
    for (const l of fresh) links[String(l.t)] = null;
    for (const k of found) links[String(k.line_t)] = k;
  }
  const valid = validateLinks(Object.values(links).filter((k): k is LineLink => !!k), records, input.transcript.filter((l) => !l.off_record));
  records = applyLinks(records, valid, pii);
  const allCorrections = [...corrections, ...linksToCorrections(valid).filter((c) => !corrections.some((x) => x.t === c.t))];
  records = applyCorrections(records, allCorrections, pii);

  const prevRecords = new Map((prev?.records ?? []).map((r) => [r.id, r]));
  const prevEvidence = prev?.rule_sources ?? {};
  const unchanged = new Set(records.filter((r) => prev?.extracted?.[r.id] === signature(r)).map((r) => r.id));
  records = records.map((r) => {
    const p = prevRecords.get(r.id);
    return unchanged.has(r.id) && p && p.status === "confirmed" ? { ...r, status: "confirmed" as const } : r;
  });

  // Keep rules only for unchanged records; everything from changed records is obsolete.
  const kept = (prev?.rules ?? []).filter((x) => unchanged.has(prevEvidence[x.id]?.record_id ?? ""));
  const todo = records.filter((r) => !unchanged.has(r.id));
  const cases = expertCases(job, onRecordOnly(events, input.transcript).events, (rec) => screenValues(job, rec));
  const extractedNow = await extractRules(todo, job, cases);

  const rules = [...kept, ...extractedNow.rules];
  const rule_sources: Record<string, RuleEvidence> = {};
  for (const x of kept) rule_sources[x.id] = prevEvidence[x.id];
  Object.assign(rule_sources, extractedNow.evidence);

  // Remember what rules were built from, so unchanged records skip the model next time.
  const extracted: Record<string, string> = {};
  for (const r of records) {
    if (unchanged.has(r.id)) extracted[r.id] = prev!.extracted![r.id];
    else if (extractedNow.ok && r.why !== null) extracted[r.id] = signature(r);
  }

  return {
    ...(prev ?? emptyWorkMap(input.job_id, input.expert)),
    job_id: input.job_id,
    expert: input.expert,
    steps: stepsFrom(records, rules, rule_sources),
    rules,
    open_gaps: recordsToGaps(records),
    records,
    rule_sources,
    corrections,
    links,
    extracted,
    rejected_rules: extractedNow.rejected.map((r) => ({ record_id: r.candidate.record_id, text: r.candidate.text, reason: r.reason })),
  };
}

// Teach-back confirmed: mark every grounded record and every rule confirmed. Only confirmed rules enforce in checkAction.
export function confirmWorkMap(map: WorkMapWithRecords, at = new Date().toISOString()): WorkMapWithRecords {
  return {
    ...map,
    rules: map.rules.map((r) => ({ ...r, confirmed: true })),
    records: map.records.map((r) => (r.why !== null ? { ...r, status: "confirmed" as const } : r)),
    confirmed_at: at,
  };
}
