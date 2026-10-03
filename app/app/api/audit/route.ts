import {
  AUDIT_ACTORS, AUDIT_TYPES, appendAudit, listSessions, safeSessionId, sessionFromHeaders, verifyAudit,
  type AuditActor, type AuditType,
} from "@understudy/brain/server";

/**
 * GET ?session=<id> -> { entries, verify: { ok, broken_at? } }
 * GET              -> { sessions: [{ id, entries, last_ts, ok }] }
 */
export async function GET(request: Request) {
  const session = new URL(request.url).searchParams.get("session");
  if (!session) return Response.json({ sessions: listSessions() });
  const v = verifyAudit(safeSessionId(session));
  return Response.json({ entries: v.entries, verify: { ok: v.ok, ...(v.broken_at != null ? { broken_at: v.broken_at } : {}) } });
}

/** POST { type, payload, actor }: appends one entry to the session named by the header. */
export async function POST(request: Request) {
  let body: { type?: string; payload?: unknown; actor?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body?.type || !(AUDIT_TYPES as readonly string[]).includes(body.type)) {
    return Response.json({ error: `expected { type: one of ${AUDIT_TYPES.join("|")}, payload, actor }` }, { status: 400 });
  }
  const actor = (AUDIT_ACTORS as readonly string[]).includes(body.actor ?? "") ? (body.actor as AuditActor) : "system";
  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? (body.payload as Record<string, unknown>) : {};
  try {
    const entry = appendAudit(sessionFromHeaders(request.headers), { actor, type: body.type as AuditType, payload });
    return Response.json({ ok: true, seq: entry.seq, hash: entry.hash, session_id: entry.session_id });
  } catch (err) {
    console.error("[api/audit]", err);
    return Response.json({ error: "could not append" }, { status: 500 });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
