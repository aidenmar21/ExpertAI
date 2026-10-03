"use client";

import type { Rule, WorkMap } from "@understudy/shared";

/**
 * Client side of the audit log. One session id per browser session (sessionStorage), sent as the
 * `x-expertai-session` header on every API call so the server can chain entries to this session.
 */
export const SESSION_HEADER = "x-expertai-session";
const KEY = "expertai:session-id";

export type AuditActor = "expert" | "new_hire" | "expertai" | "system";

function newSessionId(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let rand = "";
  const bytes = new Uint8Array(6);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 256);
  for (const b of bytes) rand += alphabet[b % alphabet.length];
  return `s_${ymd}_${rand}`;
}

/** The current browser session's audit id (created on first use, kept in sessionStorage). */
export function auditSessionId(): string {
  if (typeof window === "undefined") return "unattributed";
  try {
    const cur = sessionStorage.getItem(KEY);
    if (cur) return cur;
    const id = newSessionId();
    sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    return "unattributed";
  }
}

/** Start a new audit session (a fresh chain). Returns the new id. */
export function resetAuditSession(): string {
  const id = newSessionId();
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable */
  }
  return id;
}

/** Headers to spread into any fetch() so the server attributes the call to this session. */
export function auditHeaders(): Record<string, string> {
  return { [SESSION_HEADER]: auditSessionId() };
}

/**
 * Append an entry from the browser. Fire-and-forget: never throws, never blocks the UI.
 * Payloads must already be free of raw frames and PII (the server redacts strings as a last line of defence).
 */
export function logAudit(type: string, payload: Record<string, unknown> = {}, actor: AuditActor = "system"): void {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/audit", {
      method: "POST",
      headers: { "content-type": "application/json", ...auditHeaders() },
      body: JSON.stringify({ type, payload, actor }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

export interface Provenance {
  session_id: string;
  event_ids: string[];
  transcript_t: number | null;
  clip_id?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  source: Rule["source"];
}

interface MapWithRecords extends WorkMap {
  records?: { id: string; sources?: { event_ids?: string[]; transcript_t?: number[] } }[];
  rule_sources?: Record<string, { record_id: string; quote_t: number | null; event_ids: string[] }>;
}

/** "Why do we believe this?": where a rule came from, for a link into the audit log. */
export function provenanceFor(rule: Rule, map: WorkMap): Provenance {
  const m = map as MapWithRecords;
  const ev = m.rule_sources?.[rule.id];
  const rec = ev ? m.records?.find((r) => r.id === ev.record_id) : undefined;
  const ids = new Set<string>([...(ev?.event_ids ?? []), ...(rec?.sources?.event_ids ?? [])]);
  if (rule.screen_moment?.record) ids.add(rule.screen_moment.record);
  const t = ev?.quote_t ?? rec?.sources?.transcript_t?.[0] ?? (rule.screen_moment?.t || null);
  return {
    session_id: auditSessionId(),
    event_ids: [...ids],
    transcript_t: t,
    ...(rule.clip_id ? { clip_id: rule.clip_id } : {}),
    ...(rule.confirmed_by ? { confirmed_by: rule.confirmed_by } : rule.confirmed && map.expert ? { confirmed_by: map.expert } : {}),
    ...(map.confirmed_at ? { confirmed_at: map.confirmed_at } : {}),
    source: rule.source,
  };
}

/** URL of the audit page filtered to this session (append &type=... to narrow). */
export function auditUrl(sessionId = auditSessionId()): string {
  return `/audit?session=${encodeURIComponent(sessionId)}`;
}
