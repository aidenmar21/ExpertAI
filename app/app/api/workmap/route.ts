import type { Rule, ScreenEvent, TranscriptLine } from "@understudy/shared";
import { appendAudit, buildWorkMap, confirmWorkMap, logModelCall, sessionFromHeaders, type AuditType, type WorkMapWithRecords } from "@understudy/brain/server";
import { listJobIds } from "@/lib/job";

interface WorkMapRequest {
  job_id: string;
  expert: string;
  events: ScreenEvent[];
  transcript: TranscriptLine[];
  previous?: WorkMapWithRecords;
  confirm?: boolean; // expert said yes to the teach-back
}

// Callers send the FULL event + transcript history every time (brain rebuilds from scratch).
// Audit: the model-call ledger entry plus one entry per rule that appeared, changed, got confirmed, or got overridden.
// Payloads carry rule text (already redacted by brain) and ids, never the transcript.
function auditDiff(session: string, latency_ms: number, before: Rule[], after: Rule[], ctx: { expert: string; confirm: boolean; confirmed_at?: string }) {
  try {
    logModelCall(session, { model: process.env.LLM_MODEL, prompt_version: "workmap-v1", latency_ms, redacted: true, purpose: "workmap" });
    const prev = new Map(before.map((r) => [r.id, r]));
    const log = (type: AuditType, r: Rule, extra: Record<string, unknown> = {}) =>
      appendAudit(session, { actor: ctx.confirm || type.endsWith("confirmed") || type.endsWith("overridden") ? "expert" : "expertai", type, payload: { rule_id: r.id, source: r.source, type: r.type, text: r.text, ...extra } });
    for (const r of after) {
      const p = prev.get(r.id);
      const baseline = r.source === "baseline";
      if (!p) {
        if (baseline) {
          if (r.overridden_by) log("baseline_overridden", r, { overridden_by: r.overridden_by, override_quote: r.override_quote ?? null, who: ctx.expert });
          else if (r.confirmed || r.confirmed_by) log("baseline_confirmed", r, { confirmed_by: r.confirmed_by ?? null, who: ctx.expert });
        } else log("rule_created", r, { quote: r.reason_quote, who: ctx.expert });
        continue;
      }
      const changed = p.text !== r.text || JSON.stringify(p.when) !== JSON.stringify(r.when) || JSON.stringify(p.then) !== JSON.stringify(r.then);
      if (changed) log("rule_updated", r, { before: p.text, after: r.text, source: r.source, who: ctx.expert });
      if (!p.confirmed && r.confirmed) log(baseline ? "baseline_confirmed" : "rule_confirmed", r, { confirmed_by: r.confirmed_by ?? ctx.expert, confirmed_at: ctx.confirmed_at ?? null, who: ctx.expert });
      else if (baseline && !p.confirmed_by && r.confirmed_by) log("baseline_confirmed", r, { confirmed_by: r.confirmed_by, who: ctx.expert });
      if (!p.overridden_by && r.overridden_by) log(baseline ? "baseline_overridden" : "rule_overridden", r, { before: p.text, after: r.text, overridden_by: r.overridden_by, override_quote: r.override_quote ?? null, who: ctx.expert });
    }
  } catch (err) {
    console.error("[api/workmap] audit", err);
  }
}

export async function POST(request: Request) {
  let body: WorkMapRequest;
  try {
    body = (await request.json()) as WorkMapRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!listJobIds().includes(body?.job_id) || !Array.isArray(body.events) || !Array.isArray(body.transcript)) {
    return Response.json({ error: "expected { job_id, expert, events, transcript, previous?, confirm? }" }, { status: 400 });
  }
  const session = sessionFromHeaders(request.headers);
  const started = Date.now();
  try {
    const { confirm, ...input } = body;
    const built = await buildWorkMap({ ...input, expert: input.expert || "Expert" });
    const map = confirm ? confirmWorkMap(built) : built;
    auditDiff(session, Date.now() - started, body.previous?.rules ?? [], map.rules, { expert: map.expert, confirm: !!confirm, confirmed_at: map.confirmed_at });
    return Response.json(map);
  } catch (err) {
    console.error("[api/workmap]", err);
    return Response.json({ error: "work map build failed" }, { status: 500 });
  }
}
