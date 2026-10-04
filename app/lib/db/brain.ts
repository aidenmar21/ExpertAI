import "server-only";
// Tenant adapter for brain's orchestration. Keep in sync until brain accepts an explicit JobProfile.
// Reuses extraction/validation primitives; never writes a tenant profile to shared/jobs.
import type { Rule, WorkMapStep } from "@understudy/shared";
import { canonicalEvents, deriveFields, emptyWorkMap, onRecordOnly, overrideByDecisions, reconcileBaseline, redact, redactDeep } from "@understudy/brain";
import { baselineRulesFor, buildWorkMap as buildFileMap, extractRules, linkLines, piiValues, screenValues, type BuildWorkMapInput } from "@understudy/brain/server";
import { applyCorrections, applyLinks, captureDecisions, linksToCorrections, recordsToGaps, unlinkedExpertLines, validateLinks, type DecisionRecord, type LineLink, type WorkMapWithRecords } from "../../../../brain/records";
import { expertCases, type RuleEvidence } from "../../../../brain/validate";
import { score, runTutorCases, rulesLearned, type ScoreInput } from "../../../../brain/eval";
import { loadJob } from "./jobs";
import { supabaseConfigured } from "./config";
export async function buildWorkMap(input: BuildWorkMapInput) {
  return supabaseConfigured() ? buildTenantMap(input) : buildFileMap(input);
}
export async function scoreSession(input: Omit<ScoreInput, "job"> & { job_id: string }) {
  const job = await loadJob(input.job_id);
  return { scoreboard: score({ ...input, job }), tutor: runTutorCases(job, input.map), rules: rulesLearned(job, input.map) };
}
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
async function buildTenantMap(input: BuildWorkMapInput): Promise<WorkMapWithRecords> {
  const job = await loadJob(input.job_id);
  if (!job) throw new Error(`[brain] unknown job ${input.job_id}`);
  const prev = input.previous as WorkMapWithRecords | undefined;
  const corrections = prev?.corrections ?? [];
  const pii = piiValues(job);
  const events = canonicalEvents(job, input.events);
  // Redact once up front: every later step (capture, model calls, link validation) only sees redacted text.
  const transcript = input.transcript.map((l) => ({ ...l, text: redact(l.text, pii) }));

  let records = captureDecisions({ events, transcript: transcript, piiNames: pii, escalateTo: job.job.escalate_to });

  // Late links: expert lines no question captured (debrief answers, spoken corrections). Each line is sent to the model once.
  const links: Record<string, LineLink | null> = { ...(prev?.links ?? {}) };
  const fresh = unlinkedExpertLines(records, transcript).filter((l) => !(String(l.t) in links));
  const found = await linkLines(records, fresh, transcript);
  if (found) {
    for (const l of fresh) links[String(l.t)] = null;
    for (const k of found) links[String(k.line_t)] = k;
  }
  const valid = validateLinks(Object.values(links).filter((k): k is LineLink => !!k), records, transcript.filter((l) => !l.off_record));
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
  const cases = expertCases(job, onRecordOnly(events, transcript).events, (rec) => screenValues(job, rec));
  const extractedNow = await extractRules(todo, job, cases);

  // Baseline (industry standard) and written policy rules are not built from the transcript: they carry over as-is,
  // then each baseline rule is confirmed or overridden by the expert's own rules.
  const carried = (prev?.rules ?? []).filter((x) => x.source === "baseline" || x.source === "policy");
  const learned = [...kept, ...extractedNow.rules];
  const decisions = records.map((r) => {
    const e = events.find((x) => x.id === r.sources.event_ids[0]);
    return { id: r.id, record: r.record, why: r.why, quotes: r.quotes, event: { field: e?.field, to: e?.to } };
  });
  const baselineRules = overrideByDecisions(reconcileBaseline(carried, learned), decisions, (rec) => {
    const v = screenValues(job, rec);
    return v ? deriveFields(job, v) : null;
  });
  const rules = [...baselineRules, ...learned];
  const rule_sources: Record<string, RuleEvidence> = {};
  for (const x of kept) rule_sources[x.id] = prevEvidence[x.id];
  Object.assign(rule_sources, extractedNow.evidence);

  // Remember what rules were built from, so unchanged records skip the model next time.
  const extracted: Record<string, string> = {};
  for (const r of records) {
    if (unchanged.has(r.id)) extracted[r.id] = prev!.extracted![r.id];
    else if (extractedNow.ok && r.why !== null) extracted[r.id] = signature(r);
  }

  // Last pass: no PII in any string of the map, including model-written rule text.
  // reason_quote is redacted the same way its source quote already was, so evidence still matches.
  return redactDeep({
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
  }, pii);
}

/** A fresh Work Map for a job: no steps yet, seeded with the role's baseline rules as unconfirmed industry standard. */
export async function seedWorkMap(job_id: string, expert: string): WorkMapWithRecords {
  const job = await loadJob(job_id);
  return { ...emptyWorkMap(job_id, expert), rules: baselineRulesFor(job?.job.role_id), records: [] };
}

