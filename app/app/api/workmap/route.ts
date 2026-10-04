import { buildWorkMap } from "@/lib/db/brain";
import { appendAudit, logModelCall } from "@/lib/db/audit";
import type { Rule, ScreenEvent, TranscriptLine } from "@understudy/shared";
import { confirmWorkMap, sessionFromHeaders, type AuditType, type WorkMapWithRecords } from "@understudy/brain/server";
import { listJobIds } from "@/lib/db/jobs";
import { getMap, saveMap } from "@/lib/db/workMaps";
import { supabaseConfigured } from "@/lib/db/config";
import { requireRole, errorResponse } from "@/lib/db/server";
import { saveSessionHistory } from "@/lib/db/sessions";
import type { WorkMap } from "@understudy/shared";

interface WorkMapRequest {
  job_id: string;
  expert: string;
  events: ScreenEvent[];
  transcript: TranscriptLine[];
  previous?: WorkMapWithRecords;
  version?: number;
  confirm?: boolean; // expert said yes to the teach-back
}

// Callers send the FULL event + transcript history every time (brain rebuilds from scratch).
// Audit: the model-call ledger entry plus one entry per rule that appeared, changed, got confirmed, or got overridden.
// Payloads carry rule text (already redacted by brain) and ids, never the transcript.
async function auditDiff(session: string, latency_ms: number, before: Rule[], after: Rule[], ctx: { expert: string; confirm: boolean; confirmed_at?: string }) {
  try {
    await logModelCall(session, { model: process.env.LLM_MODEL, prompt_version: "workmap-v1", latency_ms, redacted: true, purpose: "workmap" });
    const prev = new Map(before.map((r) => [r.id, r]));
    const log = async (type: AuditType, r: Rule, extra: Record<string, unknown> = {}) =>
      await appendAudit(session, { actor: ctx.confirm || type.endsWith("confirmed") || type.endsWith("overridden") ? "expert" : "expertai", type, payload: { rule_id: r.id, source: r.source, type: r.type, text: r.text, ...extra } });
    for (const r of after) {
      const p = prev.get(r.id);
      const baseline = r.source === "baseline";
      if (!p) {
        if (baseline) {
          if (r.overridden_by) await log("baseline_overridden", r, { overridden_by: r.overridden_by, override_quote: r.override_quote ?? null, who: ctx.expert });
          else if (r.confirmed || r.confirmed_by) await log("baseline_confirmed", r, { confirmed_by: r.confirmed_by ?? null, who: ctx.expert });
        } else await log("rule_created", r, { quote: r.reason_quote, who: ctx.expert });
        continue;
      }
      const changed = p.text !== r.text || JSON.stringify(p.when) !== JSON.stringify(r.when) || JSON.stringify(p.then) !== JSON.stringify(r.then);
      if (changed) await log("rule_updated", r, { before: p.text, after: r.text, source: r.source, who: ctx.expert });
      if (!p.confirmed && r.confirmed) await log(baseline ? "baseline_confirmed" : "rule_confirmed", r, { confirmed_by: r.confirmed_by ?? ctx.expert, confirmed_at: ctx.confirmed_at ?? null, who: ctx.expert });
      else if (baseline && !p.confirmed_by && r.confirmed_by) await log("baseline_confirmed", r, { confirmed_by: r.confirmed_by, who: ctx.expert });
      if (!p.overridden_by && r.overridden_by) await log(baseline ? "baseline_overridden" : "rule_overridden", r, { before: p.text, after: r.text, overridden_by: r.overridden_by, override_quote: r.override_quote ?? null, who: ctx.expert });
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
  if (!(await listJobIds()).includes(body?.job_id) || !Array.isArray(body.events) || !Array.isArray(body.transcript)) {
    return Response.json({ error: "expected { job_id, expert, events, transcript, previous?, confirm? }" }, { status: 400 });
  }
  const session = sessionFromHeaders(request.headers);
  const started = Date.now();
  try {
    if (supabaseConfigured()) await requireRole(["owner", "manager", "expert"]);
    const current = await getMap(body.job_id);
    const expected = body.version ?? current.version;
    const { confirm, ...input } = body;
    if (supabaseConfigured()) input.previous = current.map as WorkMapWithRecords ?? undefined;
    const built = await buildWorkMap({ ...input, expert: input.expert || "Expert" });
    const map = confirm ? confirmWorkMap(built) : built;
    await auditDiff(session, Date.now() - started, body.previous?.rules ?? [], map.rules, { expert: map.expert, confirm: !!confirm, confirmed_at: map.confirmed_at });
    const version = await saveMap(body.job_id, map, expected);
    await saveSessionHistory(session, body.job_id, body.events, body.transcript);
    return Response.json(map, { headers: { "x-workmap-version": String(version) } });
  } catch (err) {
    if (supabaseConfigured()) return errorResponse(err);
    console.error("[api/workmap]", err);
    return Response.json({ error: "work map build failed" }, { status: 500 });
  }
}

/** GET keeps the original WorkMap shape; version is an HTTP header. */
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("job") ?? "";
    if (!(await listJobIds()).includes(id)) return Response.json({ error: "unknown job" }, { status: 404 });
    const { map, version } = await getMap(id);
    return Response.json(map, { headers: { "x-workmap-version": String(version), "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
/** PUT saves local edits with compare-and-swap; never silently overwrites another expert. */
export async function PUT(request: Request) {
  let body: { job_id?: string; map?: WorkMap; version?: number };
  try { body = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
  if (!body.job_id || !body.map || !Array.isArray(body.map.rules) || !Array.isArray(body.map.steps) || !Array.isArray(body.map.open_gaps) || !Number.isInteger(body.version)) return Response.json({ error: "expected { job_id, map, version }" }, { status: 400 });
  try {
    if (!(await listJobIds()).includes(body.job_id)) return Response.json({ error: "unknown job" }, { status: 404 });
    const version = await saveMap(body.job_id, body.map, body.version!);
    return Response.json(body.map, { headers: { "x-workmap-version": String(version) } });
  } catch (error) { return errorResponse(error); }
}
