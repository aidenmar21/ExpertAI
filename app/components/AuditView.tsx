"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auditSessionId } from "@/lib/audit";
import { banner, btn, card, eyebrow, field, page, pill } from "@/components/ui/styles";

interface Entry {
  seq: number;
  ts: string;
  session_id: string;
  actor: string;
  type: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
}
interface SessionRow { id: string; entries: number; last_ts: string | null; ok: boolean }
interface Verify { ok: boolean; broken_at?: number }

const ACTORS = ["expert", "new_hire", "expertai", "system"] as const;

/** Actor chips: who did it, as text with a semantic tint (never colour alone). */
const actorTone: Record<string, string> = {
  expert: pill.info,
  new_hire: pill.success,
  expertai: pill.selected,
  system: pill.neutral,
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};
const fmtWhen = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const str = (v: unknown, max = 90) => {
  const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

/** One line that says what happened, per entry type. Falls back to compact key=value pairs. */
function summarize(e: Entry): string {
  const p = e.payload ?? {};
  switch (e.type) {
    case "screen_event":
      return [p.type, p.field, p.from != null || p.to != null ? `${str(p.from, 30) || "∅"} -> ${str(p.to, 30) || "∅"}` : null, p.record ? `on ${str(p.record, 30)}` : null].filter(Boolean).join(" · ");
    case "model_call":
      return `${str(p.purpose)} · ${str(p.model)} · ${p.latency_ms} ms${p.redacted ? " · redacted" : ""}`;
    case "question_asked":
      return `${p.kind ? `[${str(p.kind)}] ` : ""}${str(p.question, 120)}${p.reason ? ` (${str(p.reason, 60)})` : ""}`;
    case "expert_answer":
      return `t=${str(p.t)} · ${str(p.text, 120)}`;
    case "rule_created":
    case "rule_confirmed":
    case "baseline_confirmed":
      return `${str(p.rule_id, 40)} · ${str(p.text, 110)}`;
    case "rule_updated":
      return `${str(p.rule_id, 40)} · ${str(p.before, 50)} -> ${str(p.after, 60)}`;
    case "rule_overridden":
    case "baseline_overridden":
      return `${str(p.rule_id, 40)} · overridden by ${str(p.overridden_by, 40)}${p.override_quote ? ` · "${str(p.override_quote, 60)}"` : ""}`;
    case "policy_parsed":
      return `${p.n_rules} rules from ${p.text_length} chars`;
    case "discovery":
      return `${str(p.record_type)} · ${p.n_fields} fields, ${p.n_actions} actions`;
    case "scoreboard":
      return `rules ${p.rules_learned}/${p.rules_total} · vision ${Math.round(Number(p.vision_accuracy ?? 0) * 100)}% · catches ${p.tutor_catches}/${p.tutor_traps} · false alarms ${p.false_alarms}`;
    case "tutor_intervention":
      return `${str(p.action)} blocked by ${str(p.rule_id, 40)} · ${str(p.said, 90)}`;
    case "stuck":
      return `${p.probability != null ? `p=${str(p.probability)}` : p.score != null ? `score=${str(p.score)}` : ""} · ${str(p.hint, 90)}`;
    case "stuck_feedback":
      return `label: ${str(p.label)}`;
    case "session_start":
      return `${str(p.job_id)}${p.briefing_words ? ` · briefing ${p.briefing_words} words` : ""}${p.kb_synced ? " · kb synced" : ""}`;
    default:
      return Object.entries(p).map(([k, v]) => `${k}=${str(v, 40)}`).join("  ").slice(0, 160) || "—";
  }
}

export default function AuditView() {
  const params = useSearchParams();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [session, setSession] = useState<string>(params.get("session") ?? "");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [verify, setVerify] = useState<Verify | null>(null);
  const [actor, setActor] = useState<string>("all");
  const [type, setType] = useState<string>(params.get("type") ?? "all");
  const [loadedFor, setLoadedFor] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/audit", { cache: "no-store" });
      const data = (await res.json()) as { sessions: SessionRow[] };
      setSessions(data.sessions ?? []);
      return data.sessions ?? [];
    } catch {
      setError("Could not list sessions.");
      return [];
    }
  }, []);

  // All setState calls happen in promise callbacks, never synchronously inside the effect body.
  const loadEntries = useCallback((id: string, isLive: () => boolean = () => true) => {
    if (!id) return;
    fetch(`/api/audit?session=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((res) => res.json() as Promise<{ entries: Entry[]; verify: Verify }>)
      .then((data) => {
        if (!isLive()) return;
        setEntries(data.entries ?? []);
        setVerify(data.verify ?? null);
        setError(null);
        setLoadedFor(id);
      })
      .catch(() => {
        if (isLive()) setError("Could not load this session.");
      });
  }, []);

  useEffect(() => {
    void (async () => {
      const list = await loadSessions();
      if (!session) {
        const mine = auditSessionId();
        const pick = list.find((s) => s.id === mine)?.id ?? list[0]?.id ?? "";
        if (pick) setSession(pick);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let live = true;
    loadEntries(session, () => live);
    return () => {
      live = false;
    };
  }, [session, loadEntries]);

  useEffect(() => {
    if (typeof window === "undefined" || !session) return;
    const url = new URL(window.location.href);
    url.searchParams.set("session", session);
    window.history.replaceState(null, "", url.toString());
  }, [session]);

  const types = useMemo(() => [...new Set(entries.map((e) => e.type))].sort(), [entries]);
  const shown = useMemo(
    () => entries.filter((e) => (actor === "all" || e.actor === actor) && (type === "all" || e.type === type)),
    [entries, actor, type],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of entries) c[e.actor] = (c[e.actor] ?? 0) + 1;
    return c;
  }, [entries]);

  const loading = !!session && loadedFor !== session && entries.length === 0 && !error;
  const filtered = actor !== "all" || type !== "all";
  const exportDisabled = !session;
  const exportBtn = `${btn.secondary} ${btn.compact} no-underline ${exportDisabled ? "pointer-events-none opacity-50" : ""}`;

  return (
    <main className={`${page} max-w-[90rem] pb-16 pt-8`}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className={eyebrow}>ExpertAI</p>
          <h1 className="mt-1 text-page text-ink">Audit log</h1>
          <p className="mt-2 max-w-[65ch] text-reading text-ink-secondary">
            Every question, answer, rule, model call, and intervention, in order, hash-chained so nothing can be
            changed or removed without showing. No screen frames, no personal data.
          </p>
        </div>
        <ChainBadge verify={verify} count={entries.length} />
      </header>

      {/* toolbar (11.1): filters near the data, utilities at the trailing edge */}
      <section aria-label="Filters" className={`${card} mt-6 p-4`}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <label htmlFor="audit-session" className="block text-meta font-medium text-ink">Session</label>
            <select id="audit-session" className={`${field} mt-1.5`} value={session} onChange={(e) => setSession(e.target.value)}>
              {!sessions.some((s) => s.id === session) && session ? <option value={session}>{session}</option> : null}
              {sessions.length === 0 && !session ? <option value="">No sessions yet</option> : null}
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} · {s.entries} entries · {fmtWhen(s.last_ts)}{s.ok ? "" : " · BROKEN"}
                </option>
              ))}
            </select>
          </div>
          <div className="basis-40">
            <label htmlFor="audit-actor" className="block text-meta font-medium text-ink">Actor</label>
            <select id="audit-actor" className={`${field} mt-1.5`} value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="all">All ({entries.length})</option>
              {ACTORS.map((a) => (
                <option key={a} value={a}>{a.replace("_", " ")} ({counts[a] ?? 0})</option>
              ))}
            </select>
          </div>
          <div className="basis-48">
            <label htmlFor="audit-type" className="block text-meta font-medium text-ink">Type</label>
            <select id="audit-type" className={`${field} mt-1.5`} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" className={`${btn.secondary} ${btn.compact}`} onClick={() => { void loadSessions(); loadEntries(session); }}>
              Refresh
            </button>
            <a className={exportBtn} href={session ? `/api/audit/export?session=${encodeURIComponent(session)}&format=jsonl` : undefined} aria-disabled={exportDisabled} download>
              Export JSONL
            </a>
            <a className={exportBtn} href={session ? `/api/audit/export?session=${encodeURIComponent(session)}&format=csv` : undefined} aria-disabled={exportDisabled} download>
              Export CSV
            </a>
          </div>
        </div>
      </section>

      {error ? (
        <div role="alert" className={`${banner.danger} mt-4`}>
          <div>
            <p className="font-medium">{error}</p>
            <p className="mt-1 text-meta">Nothing was changed. Choose Refresh to try again.</p>
          </div>
        </div>
      ) : null}

      <section aria-label="Entries" className={`${card} mt-4 overflow-hidden`}>
        {loading ? (
          <p className="px-5 py-12 text-center text-body text-ink-secondary" role="status">Loading entries…</p>
        ) : shown.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sub text-ink">{!session ? "No sessions yet" : filtered ? "No matches" : "No entries in this session"}</p>
            <p className="mx-auto mt-2 max-w-[48ch] text-body text-ink-secondary">
              {!session
                ? "Start a session in Expert mode and entries appear here."
                : filtered
                  ? "Nothing matches these filters."
                  : "Entries are appended as the session runs."}
            </p>
            {filtered && (
              <button
                type="button"
                className={`${btn.secondary} ${btn.compact} mt-4`}
                onClick={() => {
                  setActor("all");
                  setType("all");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-body">
              <caption className="sr-only">Audit entries, {shown.length} shown of {entries.length}</caption>
              <thead className="bg-surface-subtle text-note font-medium uppercase tracking-wider text-ink-secondary">
                <tr>
                  <th scope="col" className="h-11 px-4 text-right">#</th>
                  <th scope="col" className="h-11 px-4">Time</th>
                  <th scope="col" className="h-11 px-4">Actor</th>
                  <th scope="col" className="h-11 px-4">Type</th>
                  <th scope="col" className="h-11 px-4">What happened</th>
                  <th scope="col" className="h-11 px-4">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((e) => {
                  const broken = verify && !verify.ok && verify.broken_at != null && e.seq >= verify.broken_at;
                  return (
                    <Row key={e.seq} entry={e} broken={!!broken} open={open === e.seq} onToggle={() => setOpen(open === e.seq ? null : e.seq)} />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-4 text-meta text-ink-secondary">
        Stored at <code className="rounded-xs bg-surface-subtle px-1 py-0.5 font-mono text-code">data/audit/{session || "<session>"}.jsonl</code>.
        Each line&apos;s hash covers its content and the previous hash; verification recomputes the whole chain on every load.
      </p>
    </main>
  );
}

function Row({ entry: e, broken, open, onToggle }: { entry: Entry; broken: boolean; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className={`align-top ${broken ? "bg-danger-surface/60" : ""}`}>
        <td className="px-4 py-2.5 text-right tabular-nums text-ink-secondary">{e.seq}</td>
        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-ink-secondary">{fmtTime(e.ts)}</td>
        <td className="px-4 py-2.5">
          <span className={actorTone[e.actor] ?? actorTone.system}>{e.actor.replace("_", " ")}</span>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-code text-ink">{e.type}</td>
        <td className="max-w-[28rem] px-4 py-2.5 text-ink">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            title={summarize(e)}
            className="block w-full truncate rounded-xs text-left hover:text-link"
          >
            {summarize(e)}
          </button>
        </td>
        <td className="px-4 py-2.5 font-mono text-code text-ink-tertiary">{e.hash.slice(0, 10)}</td>
      </tr>
      {open ? (
        <tr className="bg-surface-subtle">
          <td colSpan={6} className="px-4 py-3">
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md border border-line bg-surface p-3 font-mono text-code text-ink">
              {JSON.stringify({ payload: e.payload, prev_hash: e.prev_hash, hash: e.hash }, null, 2)}
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ChainBadge({ verify, count }: { verify: Verify | null; count: number }) {
  if (!verify) {
    return <span className={pill.outline}>No session loaded</span>;
  }
  return verify.ok ? (
    <span className={pill.success}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      Chain intact · {count} {count === 1 ? "entry" : "entries"}
    </span>
  ) : (
    <span className={pill.danger}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      Chain broken at #{verify.broken_at}
    </span>
  );
}
