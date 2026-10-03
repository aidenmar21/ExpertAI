"use client";

import { useState, useSyncExternalStore } from "react";
import type { Rule } from "@understudy/shared";
import { workMaps } from "@/lib/workmap";

const TEXT_KEY = (jobId: string) => `expertai:policy:${jobId}`;
const noop = () => () => {};

/**
 * Company knowledge for one job. On save, brain's parsePolicy turns the text into proposed rules
 * (source "policy", unconfirmed); the expert accepts, edits, or deletes each one. Accepted rules join
 * the Work Map as confirmed, with a "written" badge instead of a voice clip.
 */
export default function KnowledgeBox({ jobId }: { jobId: string }) {
  const stored = useSyncExternalStore(noop, () => read(jobId), () => "");
  const [text, setText] = useState<string | null>(null);
  const [proposed, setProposed] = useState<Rule[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = text ?? stored;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      localStorage.setItem(TEXT_KEY(jobId), value);
    } catch {
      /* storage unavailable */
    }
    try {
      const res = await fetch("/api/policy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: jobId, text: value }),
      });
      if (!res.ok) throw new Error("could not read the policy");
      const { rules } = (await res.json()) as { rules: Rule[] };
      setProposed(rules);
      if (rules.length === 0) setError("No rules found in that text. Try concrete sentences: limits, exceptions, who to escalate to.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function accept(r: Rule) {
    workMaps.addRules(jobId, [{ ...r, source: "policy", confirmed: true }]);
    setProposed((p) => p.filter((x) => x.id !== r.id));
  }
  const edit = (r: Rule, textValue: string) => setProposed((p) => p.map((x) => (x.id === r.id ? { ...x, text: textValue } : x)));
  const drop = (r: Rule) => setProposed((p) => p.filter((x) => x.id !== r.id));

  return (
    <section className="mt-10">
      <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">Company knowledge</h2>
      <p className="mt-1 text-sm text-slate-500">
        What your company does, this job&rsquo;s goals, the steps done right, who to escalate to. ExpertAI turns it into rules you confirm.
      </p>
      <textarea
        value={value}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="e.g. We are a campus bookstore. Returns within 30 days with a receipt go back to the card. Without a receipt we only give store credit. Anything over $100 needs the shift manager…"
        className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy || !value.trim()}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Reading…" : "Save and extract rules"}
        </button>
        {error && <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
      </div>

      {proposed.length > 0 && (
        <ul className="mt-4 space-y-3">
          {proposed.map((r) => (
            <li key={r.id} className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <p className="text-xs font-medium uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Proposed · {r.type.replace(/_/g, " ")}</p>
              <input
                value={r.text}
                onChange={(e) => edit(r, e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <p className="mt-2 text-xs italic text-slate-500">from: &ldquo;{r.reason_quote}&rdquo;</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => accept(r)} className="rounded-xl bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-500">
                  Accept
                </button>
                <button onClick={() => drop(r)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function read(jobId: string): string {
  try {
    return localStorage.getItem(TEXT_KEY(jobId)) ?? "";
  } catch {
    return "";
  }
}
