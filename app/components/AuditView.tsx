"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auditSessionId } from "@/lib/audit";

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

const actorTone: Record<string, string> = {
  expert: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  new_hire: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300",
  expertai: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300",
  system: "bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300",
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

  const select = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-500 dark:focus:ring-sky-500/30";
  const btn = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">ExpertAI</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Audit log</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Every question, answer, rule, model call, and intervention, in order, hash-chained so nothing can be
            changed or removed without showing. No screen frames, no personal data.
          </p>
        </div>
        <ChainBadge verify={verify} count={entries.length} />
      </header>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span>Session</span>
            <select className={select} value={session} onChange={(e) => setSession(e.target.value)}>
              {!sessions.some((s) => s.id === session) && session ? <option value={session}>{session}</option> : null}
              {sessions.length === 0 && !session ? <option value="">No sessions yet</option> : null}
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} · {s.entries} entries · {fmtWhen(s.last_ts)}{s.ok ? "" : " · BROKEN"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span>Actor</span>
            <select className={select} value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="all">All ({entries.length})</option>
              {ACTORS.map((a) => (
                <option key={a} value={a}>{a.replace("_", " ")} ({counts[a] ?? 0})</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span>Type</span>
            <select className={select} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className={btn} onClick={() => { void loadSessions(); loadEntries(session); }}>
              Refresh
            </button>
            <a className={btn} href={session ? `/api/audit/export?session=${encodeURIComponent(session)}&format=jsonl` : undefined} aria-disabled={!session} download>
              Export JSONL
            </a>
            <a className={btn} href={session ? `/api/audit/export?session=${encodeURIComponent(session)}&format=csv` : undefined} aria-disabled={!session} download>
              Export CSV
            </a>
          </div>
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>
      ) : null}

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {session && loadedFor !== session && entries.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            {session ? "Nothing matches these filters." : "Start a session in Expert mode and entries will appear here."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">What happened</th>
                  <th className="px-4 py-3 font-medium">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
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

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Stored at <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">data/audit/{session || "<session>"}.jsonl</code>.
        Each line&apos;s hash covers its content and the previous hash; verification recomputes the whole chain on every load.
      </p>
    </main>
  );
}

function Row({ entry: e, broken, open, onToggle }: { entry: Entry; broken: boolean; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer align-top transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${broken ? "bg-rose-50/70 dark:bg-rose-950/30" : ""}`}
      >
        <td className="px-4 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">{e.seq}</td>
        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{fmtTime(e.ts)}</td>
        <td className="px-4 py-2.5">
          <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-medium ${actorTone[e.actor] ?? actorTone.system}`}>{e.actor.replace("_", " ")}</span>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-300">{e.type}</td>
        <td className="max-w-[28rem] truncate px-4 py-2.5 text-slate-800 dark:text-slate-200" title={summarize(e)}>{summarize(e)}</td>
        <td className="px-4 py-2.5 font-mono text-xs text-slate-400 dark:text-slate-500">{e.hash.slice(0, 10)}</td>
      </tr>
      {open ? (
        <tr className="bg-slate-50/80 dark:bg-slate-950/50">
          <td colSpan={6} className="px-4 py-3">
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
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
    return <span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">No session loaded</span>;
  }
  return verify.ok ? (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-300">
      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
      Chain intact · {count} {count === 1 ? "entry" : "entries"}
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 dark:border-rose-700/60 dark:bg-rose-950/40 dark:text-rose-300">
      <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />
      Broken at #{verify.broken_at}
    </span>
  );
}
