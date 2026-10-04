import { appendAudit } from "@/lib/db/audit";
import type { CheckResult, Value, WorkMap } from "@understudy/shared";
import { canonicalField, checkAction } from "@understudy/brain";
import { sessionFromHeaders } from "@understudy/brain/server";
import { listJobIds, loadJob } from "@/lib/db/jobs";
import { getMap } from "@/lib/db/workMaps";
import { supabaseConfigured } from "@/lib/db/config";

interface CheckBody { job_id?: string; action?: string; record?: Record<string, Value>; map?: WorkMap }

/**
 * POST { job_id, action, record, map } -> CheckResult. Checks a proposed action against the Work Map the caller
 * holds (the browser extension keeps its own copy). No map: nothing to enforce, so { ok: true }.
 * CORS comes from next.config.ts headers() for /api/*.
 */
export async function POST(request: Request) {
  let body: CheckBody;
  try {
    body = (await request.json()) as CheckBody;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const id = body.job_id ?? "";
  if (!(await listJobIds()).includes(id) || typeof body.action !== "string" || !body.action) {
    return Response.json({ error: "expected { job_id, action, record, map? }" }, { status: 400 });
  }
  // The caller's map wins; otherwise the job's latest map saved by /api/workmap (the extension has no browser copy).
  const map = supabaseConfigured() ? (await getMap(id)).map : body.map && Array.isArray(body.map.rules) ? body.map : (await getMap(id)).map;
  if (!map || !Array.isArray(map.rules)) return Response.json({ ok: true } satisfies CheckResult);

  const job = (await loadJob(id));
  // Field names from a third-party page are its labels (refund_to); map them onto the job's keys (refund_method).
  const raw = body.record && typeof body.record === "object" ? body.record : {};
  const record: Record<string, Value> = {};
  for (const [k, v] of Object.entries(raw)) record[canonicalField(job, k) ?? k] = v;
  let check: CheckResult;
  try {
    check = checkAction({ action: body.action, record }, map, { job });
  } catch (err) {
    console.error("[api/check]", err);
    return Response.json({ error: "could not check this action" }, { status: 500 });
  }

  if (!check.ok) {
    try {
      await appendAudit(sessionFromHeaders(request.headers), {
        actor: "expertai",
        type: "tutor_intervention",
        payload: {
          job_id: id, rule_id: check.rule?.id ?? null, action_blocked: body.action,
          standard: !!check.standard, said: check.explanation ?? null, via: "api/check",
        },
      });
    } catch (err) {
      console.error("[api/check] audit", err);
    }
  }
  return Response.json(check);
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
