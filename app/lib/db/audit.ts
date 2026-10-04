import "server-only";
import * as file from "@understudy/brain/server";
import { supabaseConfigured } from "./config";
import { dbError, tenant, RepositoryError } from "./server";
import { endSession, ensureSession, saveStuckFeedback, sessionIdentity } from "./sessions";

/** JSONB does not retain object order. Sort recursively on both write and read before hashing. */
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, canonical(v)]));
  return value;
}
function entry(row: file.AuditEntry): file.AuditEntry {
  return { seq: row.seq, ts: row.ts, session_id: row.session_id, actor: row.actor, type: row.type, payload: canonical(row.payload) as Record<string, unknown>, prev_hash: row.prev_hash, hash: row.hash };
}
export async function appendAudit(externalId: string, input: file.AuditInput): Promise<file.AuditEntry> {
  if (!supabaseConfigured()) return file.appendAudit(externalId, input);
  const { db, orgId } = await sessionIdentity(externalId);
  const jobId = typeof input.payload?.job_id === "string" ? input.payload.job_id : undefined;
  const sessionId = await ensureSession(externalId, jobId);
  const payload = canonical(file.sanitizePayload(input.payload ?? {})) as Record<string, unknown>;
  // The unique(session_id,seq) constraint elects one writer. Losers re-read the winning hash.
  for (let attempt = 0; attempt < 12; attempt++) {
    const { data: last, error } = await db.from("audit_entries").select("seq,hash").eq("org_id", orgId).eq("session_id", sessionId).order("seq", { ascending: false }).limit(1).maybeSingle();
    dbError(error);
    const base: Omit<file.AuditEntry, "hash"> = { seq: (last?.seq ?? 0) + 1, ts: new Date().toISOString(), session_id: sessionId, actor: input.actor, type: input.type, payload, prev_hash: last?.hash ?? "genesis" };
    const next = { ...base, hash: file.hashEntry(base) };
    const inserted = await db.from("audit_entries").insert({ org_id: orgId, ...next });
    if (inserted.error?.code === "23505") continue;
    dbError(inserted.error);
    if (input.type === "session_end") await endSession(externalId);
    if (input.type === "stuck_feedback" && jobId && typeof payload.label === "boolean") await saveStuckFeedback(jobId, payload.signals ?? {}, payload.label);
    return next;
  }
  throw new RepositoryError("audit is busy; retry append", 409);
}
export async function readAudit(id: string): Promise<file.AuditEntry[]> {
  if (!supabaseConfigured()) return file.readAudit(id);
  const { db, orgId } = await tenant();
  // Audit links may use either a browser id or the canonical id returned by POST/list.
  const canonicalId = /^[a-f0-9]{24}_/.test(id) ? file.safeSessionId(id) : (await sessionIdentity(id)).sessionId;
  const entries: file.AuditEntry[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("audit_entries").select("seq,ts,session_id,actor,type,payload,prev_hash,hash").eq("org_id", orgId).eq("session_id", canonicalId).order("seq").range(offset, offset + 999);
    dbError(error);
    entries.push(...(data ?? []).map((r) => entry(r as file.AuditEntry)));
    if ((data?.length ?? 0) < 1000) break;
  }
  return entries;
}
export async function verifyAudit(id: string) { return file.verifyEntries(await readAudit(id)); }
export async function listSessions(): Promise<file.AuditSessionSummary[]> {
  if (!supabaseConfigured()) return file.listSessions();
  const { db, orgId } = await tenant();
  const { data, error } = await db.from("sessions").select("id").eq("org_id", orgId).order("started_at", { ascending: false }).limit(100);
  dbError(error);
  return Promise.all((data ?? []).map(async ({ id }) => {
    const v = await verifyAudit(id);
    return { id, entries: v.entries.length, last_ts: v.entries.at(-1)?.ts ?? null, ok: v.ok };
  }));
}
export async function logModelCall(id: string, call: file.ModelCallInput) {
  return appendAudit(id, { actor: "expertai", type: "model_call", payload: { ...call, model: call.model ?? "unset", latency_ms: Math.round(call.latency_ms) } });
}
