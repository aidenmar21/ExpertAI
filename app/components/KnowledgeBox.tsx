"use client";

import { useState, useSyncExternalStore } from "react";
import type { Rule } from "@understudy/shared";
import { workMaps } from "@/lib/workmap";
import { btn, errorText, eyebrow, field, help, label as labelCls, pill } from "@/components/ui/styles";
import { auditHeaders } from "@/lib/audit";

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
        headers: { "content-type": "application/json", ...auditHeaders() },
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
    <section aria-labelledby="knowledge-title" className="mt-10 border-t border-line pt-8">
      <p className={eyebrow}>Company knowledge</p>
      <h2 id="knowledge-title" className="mt-1 text-sub text-ink">Write what the company does differently</h2>
      <p className="mt-2 max-w-[65ch] text-body text-ink-secondary">
        What your company does, this job&rsquo;s goals, the steps done right, who to escalate to. ExpertAI turns it into draft rules you confirm.
      </p>
      <div className="mt-5">
        <label htmlFor="knowledge-text" className={labelCls}>
          Company policy text
        </label>
        <textarea
          id="knowledge-text"
          value={value}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          aria-describedby="knowledge-help"
          aria-invalid={error ? true : undefined}
          placeholder="e.g. We are a campus bookstore. Returns within 30 days with a receipt go back to the card. Without a receipt we only give store credit. Anything over $100 needs the shift manager…"
          className={`${field} mt-1.5 min-h-[9rem] resize-y`}
        />
        <p id="knowledge-help" className={help}>Plain sentences work best: limits, exceptions, and who decides.</p>
        {error && <p role="alert" className={errorText}>{error}</p>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy || !value.trim()} aria-busy={busy} className={btn.primary}>
          {busy ? "Extracting rules…" : "Save and extract rules"}
        </button>
      </div>

      {proposed.length > 0 && (
        <ul className="mt-6 space-y-3" aria-label="Proposed rules">
          {proposed.map((r) => (
            <li key={r.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={pill.info}>Draft · {r.type.replace(/_/g, " ")}</span>
                <span className="text-note text-ink-tertiary">generated from your text; edit before accepting</span>
              </div>
              <label htmlFor={`proposed-${r.id}`} className="sr-only">
                Rule text
              </label>
              <input id={`proposed-${r.id}`} value={r.text} onChange={(e) => edit(r, e.target.value)} className={`${field} mt-3`} />
              <p className="mt-2 text-meta text-ink-secondary">from: &ldquo;{r.reason_quote}&rdquo;</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => accept(r)} className={`${btn.primary} ${btn.compact}`}>
                  Accept rule
                </button>
                <button type="button" onClick={() => drop(r)} className={`${btn.dangerQuiet} ${btn.compact}`}>
                  Delete draft
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
