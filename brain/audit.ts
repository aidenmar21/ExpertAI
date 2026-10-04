// Auditable, tamper-evident session log. Server only (node:fs, node:crypto): import via "@understudy/brain/server".
// One append-only JSONL file per session at <repo>/data/audit/<session_id>.jsonl. Each entry is hash-chained to the
// previous one, so an edited, removed, or reordered line breaks the chain and verifyAudit() reports where.
// No raw frames and no PII ever go in: every string in a payload passes through redact() before it is written.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { redact } from "./index";

export type AuditActor = "expert" | "new_hire" | "expertai" | "system";

export type AuditType =
  | "screen_event" | "gate_open" | "question_asked" | "expert_answer"
  | "rule_created" | "rule_updated" | "rule_confirmed" | "rule_overridden"
  | "baseline_confirmed" | "baseline_overridden"
  | "policy_parsed" | "discovery"
  | "off_record_start" | "off_record_end"
  | "tutor_intervention" | "stuck" | "stuck_feedback"
  | "scoreboard" | "model_call" | "session_start" | "session_end";

export const AUDIT_ACTORS: readonly AuditActor[] = ["expert", "new_hire", "expertai", "system"];
export const AUDIT_TYPES: readonly AuditType[] = [
  "screen_event", "gate_open", "question_asked", "expert_answer",
  "rule_created", "rule_updated", "rule_confirmed", "rule_overridden",
  "baseline_confirmed", "baseline_overridden",
  "policy_parsed", "discovery",
  "off_record_start", "off_record_end",
  "tutor_intervention", "stuck", "stuck_feedback",
  "scoreboard", "model_call", "session_start", "session_end",
];

export interface AuditEntry {
  seq: number;
  ts: string;                 // ISO
  session_id: string;
  actor: AuditActor;
  type: AuditType;
  payload: Record<string, unknown>;
  prev_hash: string;          // "genesis" for the first entry
  hash: string;               // sha256(prev_hash + JSON.stringify(entry without hash))
}

export interface AuditInput { actor: AuditActor; type: AuditType; payload?: Record<string, unknown> }

export interface ModelCallInput {
  model: string | undefined;
  prompt_version: string;
  latency_ms: number;
  tokens_in?: number;
  tokens_out?: number;
  redacted: boolean;
  purpose: string;
}

export interface VerifyResult { ok: boolean; entries: AuditEntry[]; broken_at?: number }

export interface AuditSessionSummary { id: string; entries: number; last_ts: string | null; ok: boolean }

export const UNATTRIBUTED_SESSION = "unattributed";

// ---------- Storage ----------
// The app runs with cwd app/ (data lives at ../data) and brain tests run with cwd brain/ or the repo root.
function repoRoot(): string {
  const cwd = process.cwd();
  if (process.env.EXPERTAI_DATA_DIR) return process.env.EXPERTAI_DATA_DIR;
  if (existsSync(join(cwd, "shared", "jobs"))) return join(cwd, "data");
  if (existsSync(join(cwd, "..", "shared", "jobs"))) return join(cwd, "..", "data");
  return join(cwd, "data");
}

export function auditDir(): string {
  return join(repoRoot(), "audit");
}

const SESSION_ID = /^[A-Za-z0-9_-]{1,80}$/;

/** Session ids are file names: only [A-Za-z0-9_-]; anything else is logged as "unattributed". */
export function safeSessionId(id: string | null | undefined): string {
  return id && SESSION_ID.test(id) ? id : UNATTRIBUTED_SESSION;
}

export const SESSION_HEADER = "x-expertai-session";

/** The session an HTTP request belongs to: header x-expertai-session, else "unattributed". */
export function sessionFromHeaders(h: { get(name: string): string | null } | null | undefined): string {
  return safeSessionId(h?.get(SESSION_HEADER));
}

function fileFor(sessionId: string): string {
  return join(auditDir(), `${safeSessionId(sessionId)}.jsonl`);
}

// ---------- Hashing ----------
export function hashEntry(entry: Omit<AuditEntry, "hash">): string {
  return createHash("sha256").update(entry.prev_hash + JSON.stringify(entry)).digest("hex");
}

// ---------- Payload hygiene ----------
const FRAME_KEYS = /frame_jpeg_base64|jpeg|base64|image/i;
const LONG_BASE64 = /^[A-Za-z0-9+/=\s]{512,}$/;

/** Every string redacted; frame-like keys and base64-looking blobs replaced by a marker. Never throws on cycles. */
export function sanitizePayload(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[depth]";
  if (typeof value === "string") {
    if (value.length >= 512 && LONG_BASE64.test(value)) return "[frame omitted]";
    return redact(value.length > 4000 ? `${value.slice(0, 4000)}…` : value);
  }
  if (Array.isArray(value)) return value.slice(0, 500).map((v) => sanitizePayload(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = FRAME_KEYS.test(k) && typeof v === "string" ? "[frame omitted]" : sanitizePayload(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  return value === undefined ? undefined : String(value);
}

// ---------- Read ----------
function parseLines(raw: string): AuditEntry[] {
  const out: AuditEntry[] = [];
  for (const line of raw.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s) as AuditEntry);
    } catch {
      // An unparseable line is itself a chain break: keep a stub so verify() reports the position.
      out.push({ seq: out.length + 1, ts: "", session_id: "", actor: "system", type: "session_end", payload: { corrupt_line: true }, prev_hash: "", hash: "" });
    }
  }
  return out;
}

export function readAudit(sessionId: string): AuditEntry[] {
  const f = fileFor(sessionId);
  if (!existsSync(f)) return [];
  return parseLines(readFileSync(f, "utf8"));
}

function lastEntry(sessionId: string): AuditEntry | null {
  const f = fileFor(sessionId);
  if (!existsSync(f)) return null;
  const raw = readFileSync(f, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim());
  if (!lines.length) return null;
  try {
    return JSON.parse(lines[lines.length - 1]) as AuditEntry;
  } catch {
    return { seq: lines.length, hash: "", prev_hash: "", ts: "", session_id: sessionId, actor: "system", type: "session_end", payload: {} };
  }
}

// ---------- Append ----------
// Atomic mkdir serializes the entire read/hash/append operation across processes, not just calls
// in one JS event loop. Never steal a lock: a slow writer must not lose ownership mid-append.
function lockSession(file: string): () => void {
  const lock = `${file}.lock`;
  const deadline = Date.now() + 5000;
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    try {
      mkdirSync(lock);
      return () => rmdirSync(lock);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      if (Date.now() >= deadline) throw new Error(`Timed out acquiring audit lock: ${lock}`);
      Atomics.wait(sleeper, 0, 0, 10);
    }
  }
}

/** Appends one entry (redacted, hash-chained) and returns it. One line per call via appendFileSync. */
export function appendAudit(sessionId: string, input: AuditInput): AuditEntry {
  const sid = safeSessionId(sessionId);
  mkdirSync(auditDir(), { recursive: true });
  const release = lockSession(fileFor(sid));
  try {
    const prev = lastEntry(sid);
    const base: Omit<AuditEntry, "hash"> = {
      seq: (prev?.seq ?? 0) + 1,
      ts: new Date().toISOString(),
      session_id: sid,
      actor: AUDIT_ACTORS.includes(input.actor) ? input.actor : "system",
      type: input.type,
      payload: (sanitizePayload(input.payload ?? {}) as Record<string, unknown>) ?? {},
      prev_hash: prev?.hash || "genesis",
    };
    const entry: AuditEntry = { ...base, hash: hashEntry(base) };
    appendFileSync(fileFor(sid), JSON.stringify(entry) + "\n", { encoding: "utf8", flag: "a" });
    return entry;
  } finally {
    release();
  }
}

/** Model-call ledger: which model, which prompt, how long, and whether the input was redacted. Never the prompt itself. */
export function logModelCall(sessionId: string, call: ModelCallInput): AuditEntry {
  return appendAudit(sessionId, {
    actor: "expertai",
    type: "model_call",
    payload: {
      model: call.model ?? "unset",
      prompt_version: call.prompt_version,
      latency_ms: Math.round(call.latency_ms),
      ...(call.tokens_in != null ? { tokens_in: call.tokens_in } : {}),
      ...(call.tokens_out != null ? { tokens_out: call.tokens_out } : {}),
      redacted: call.redacted,
      purpose: call.purpose,
    },
  });
}

// ---------- Verify ----------
/** Recomputes every hash. ok=false with broken_at = seq of the first entry whose chain link or hash does not match. */
export function verifyEntries(entries: AuditEntry[]): VerifyResult {
  let prev = "genesis";
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e || typeof e !== "object") return { ok: false, entries, broken_at: i + 1 };
    const seqOk = e.seq === i + 1;
    const linkOk = e.prev_hash === prev;
    let hashOk = false;
    if (seqOk && linkOk && e.hash) {
      // Recompute from the entry's own fields, in the same key order appendAudit wrote them.
      const base: Omit<AuditEntry, "hash"> = { seq: e.seq, ts: e.ts, session_id: e.session_id, actor: e.actor, type: e.type, payload: e.payload, prev_hash: e.prev_hash };
      hashOk = hashEntry(base) === e.hash;
    }
    if (!seqOk || !linkOk || !hashOk) return { ok: false, entries, broken_at: i + 1 };
    prev = e.hash;
  }
  return { ok: true, entries };
}

export function verifyAudit(sessionId: string): VerifyResult {
  return verifyEntries(readAudit(sessionId));
}

// ---------- List ----------
export function listSessions(): AuditSessionSummary[] {
  const dir = auditDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => {
      const id = f.slice(0, -".jsonl".length);
      const v = verifyAudit(id);
      const last = v.entries[v.entries.length - 1];
      return { id, entries: v.entries.length, last_ts: last?.ts || new Date(statSync(join(dir, f)).mtimeMs).toISOString(), ok: v.ok };
    })
    .sort((a, b) => (b.last_ts ?? "").localeCompare(a.last_ts ?? ""));
}

// ---------- Export ----------
const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`;

export function auditToCsv(entries: AuditEntry[]): string {
  const rows = [["seq", "ts", "actor", "type", "payload", "hash"].join(",")];
  for (const e of entries) rows.push([String(e.seq), csvCell(e.ts), csvCell(e.actor), csvCell(e.type), csvCell(JSON.stringify(e.payload)), csvCell(e.hash)].join(","));
  return rows.join("\n") + "\n";
}

export function auditToJsonl(entries: AuditEntry[]): string {
  return entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length ? "\n" : "");
}
