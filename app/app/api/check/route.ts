import type { CheckResult, Value, WorkMap } from "@understudy/shared";
import { checkAction } from "@understudy/brain";
import { appendAudit, sessionFromHeaders } from "@understudy/brain/server";
import { listJobIds, loadJob } from "@/lib/job";

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
  if (!listJobIds().includes(id) || typeof body.action !== "string" || !body.action) {
    return Response.json({ error: "expected { job_id, action, record, map? }" }, { status: 400 });
  }
  const map = body.map;
  if (!map || !Array.isArray(map.rules)) return Response.json({ ok: true } satisfies CheckResult);

  const record = body.record && typeof body.record === "object" ? body.record : {};
  const job = loadJob(id);
  let check: CheckResult;
  try {
    check = checkAction({ action: body.action, record }, map, { job });
  } catch (err) {
    console.error("[api/check]", err);
    return Response.json({ error: "could not check this action" }, { status: 500 });
  }

  if (!check.ok) {
    try {
      appendAudit(sessionFromHeaders(request.headers), {
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
