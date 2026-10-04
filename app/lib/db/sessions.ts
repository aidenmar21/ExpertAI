import "server-only";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ScreenEvent, TranscriptLine } from "@understudy/shared";
import { sanitizePayload, safeSessionId, piiValues } from "@understudy/brain/server";
import { onRecordOnly, redactTranscript } from "@understudy/brain";
import { supabaseConfigured } from "./config";
import { dbError, tenant } from "./server";
import { jobRow, loadJob } from "./jobs";
/** Hash the user and org into the external browser session id: never share an unattributed chain. */
export async function sessionIdentity(externalId: string) {
  const ctx = await tenant();
  const prefix = createHash("sha256").update(`${ctx.orgId}:${ctx.user.id}`).digest("hex").slice(0, 24);
  return { ...ctx, sessionId: `${prefix}_${safeSessionId(externalId).slice(0, 54)}` };
}
export async function ensureSession(externalId: string, jobId?: string, kind?: "expert" | "new_hire") {
  if (!supabaseConfigured()) return safeSessionId(externalId);
  const { db, orgId, user, role, sessionId } = await sessionIdentity(externalId);
  const job = jobId ? await jobRow(jobId) : null;
  const { error } = await db.from("sessions").upsert({ id: sessionId, org_id: orgId, user_id: user.id, kind: kind ?? (role === "new_hire" ? "new_hire" : "expert"), job_id: job?.id ?? null }, { onConflict: "id", ignoreDuplicates: true });
  dbError(error);
  if (job) {
    const { error: e } = await db.from("sessions").update({ job_id: job.id }).eq("id", sessionId).eq("org_id", orgId).eq("user_id", user.id).is("job_id", null);
    dbError(e);
  }
  return sessionId;
}
export async function endSession(externalId: string) {
  if (!supabaseConfigured()) return; // Existing demo session lifecycle is browser-only.
  const { db, orgId, user, sessionId } = await sessionIdentity(externalId);
  dbError((await db.from("sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionId).eq("org_id", orgId).eq("user_id", user.id)).error);
}
/** Persist only on-record events and redacted transcript. Full histories replace their previous snapshot. */
export async function saveSessionHistory(externalId: string, jobId: string, events: ScreenEvent[], transcript: TranscriptLine[]) {
  if (!supabaseConfigured()) return; // Original demo retains these in localStorage, not server files.
  const { db, orgId } = await tenant();
  const sessionId = await ensureSession(externalId, jobId);
  const clean = onRecordOnly(events, transcript);
  const lines = redactTranscript(clean.transcript, piiValues(await loadJob(jobId)));
  dbError((await db.rpc("save_session_history", { sid: sessionId, oid: orgId, events: sanitizePayload(clean.events), transcript: lines })).error);
}
export async function saveStuckFeedback(jobId: string, signals: unknown, label: boolean) {
  const cleaned = sanitizePayload(signals);
  if (!supabaseConfigured()) {
    const dir = path.join(process.cwd(), "..", "data");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "stuck-feedback.jsonl"), JSON.stringify({ job_id: jobId, signals: cleaned, label }) + "\n");
    return;
  }
  const { db, orgId, id } = await jobRow(jobId);
  dbError((await db.from("stuck_feedback").insert({ org_id: orgId, job_id: id, signals: cleaned, label })).error);
}
