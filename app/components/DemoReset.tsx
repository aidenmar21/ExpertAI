"use client";

import Link from "next/link";
import { useState } from "react";
import type { WorkMap } from "@understudy/shared";
import { workMaps } from "@/lib/workmap";
import { banner, btn, card, eyebrow, h1, h3, help, inset, label, field, pill } from "@/components/ui/styles";

const STORAGE_PREFIXES = ["understudy:", "expertai:"];
const DATABASES = ["expertai-frames", "expertai-stuck"];

type Result = { tone: "success" | "danger" | "info"; title: string; lines: string[] };

function deleteDb(name: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve(`IndexedDB "${name}" deleted`);
      req.onerror = () => resolve(`IndexedDB "${name}" could not be deleted`);
      req.onblocked = () => resolve(`IndexedDB "${name}" is open in another tab; deleted once that tab closes`);
    } catch {
      resolve(`IndexedDB "${name}" unavailable`);
    }
  });
}

/** Clears every piece of browser state ExpertAI keeps. Returns a human-readable report. */
async function resetDemoState(jobIds: string[]): Promise<string[]> {
  const lines: string[] = [];
  const removed: string[] = [];
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && STORAGE_PREFIXES.some((p) => k.startsWith(p))) removed.push(k);
    }
    removed.forEach((k) => localStorage.removeItem(k));
    lines.push(removed.length ? `localStorage: ${removed.length} key${removed.length === 1 ? "" : "s"} removed (${removed.join(", ")})` : "localStorage: nothing to remove");
  } catch {
    lines.push("localStorage: unavailable");
  }
  try {
    const n = sessionStorage.length;
    sessionStorage.clear();
    lines.push(`sessionStorage: ${n} key${n === 1 ? "" : "s"} cleared`);
  } catch {
    lines.push("sessionStorage: unavailable");
  }
  lines.push(...(await Promise.all(DATABASES.map(deleteDb))));
  // Drop the in-memory Work Map cache too, so open views re-read the empty store.
  jobIds.forEach((id) => workMaps.set(id, null));
  return lines;
}

const ROUTES = (jobId: string) => [
  { href: `/?job=${jobId}`, text: "Expert mode", note: "Start watching, questions, Finish and debrief" },
  { href: `/?job=${jobId}&mode=tutor`, text: "New hire mode", note: "Start shift, paused before saving" },
  { href: `/workmap?job=${jobId}`, text: "Work Map", note: "Company rules, industry standard, timeline" },
  { href: "/jobs", text: "Jobs dashboard", note: "Coverage, open gaps" },
  { href: "/jobs/new", text: "New job wizard", note: "Second role, standard rules pre-loaded" },
  { href: "/audit", text: "Audit log", note: "Hash-chained entries, chain verification" },
];

export default function DemoReset({ jobs }: { jobs: { id: string; name: string }[] }) {
  const [jobId, setJobId] = useState(jobs.some((j) => j.id === "returns-desk") ? "returns-desk" : (jobs[0]?.id ?? ""));
  const [busy, setBusy] = useState<"reset" | "seed" | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function onReset() {
    if (!window.confirm("Reset demo state? This clears every Work Map, session, stored frame, and stuck-detector feedback in this browser.")) return;
    setBusy("reset");
    try {
      const lines = await resetDemoState(jobs.map((j) => j.id));
      setResult({ tone: "success", title: "Demo state cleared. Reload any other open ExpertAI tabs.", lines });
    } finally {
      setBusy(null);
    }
  }

  async function onSeed() {
    setBusy("seed");
    setResult({ tone: "info", title: "Building the Work Map from the scripted session (calls the model, about 10 to 30 seconds)…", lines: [] });
    try {
      const res = await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job_id: jobId }) });
      const data = (await res.json()) as WorkMap & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      workMaps.set(jobId, data);
      const taught = data.rules.filter((r) => r.confirmed && r.source !== "baseline");
      setResult({
        tone: "success",
        title: `Seeded for demo: ${taught.length} confirmed rule${taught.length === 1 ? "" : "s"} from ${data.expert}`,
        lines: taught.map((r) => `"${r.reason_quote}"`),
      });
    } catch (err) {
      setResult({ tone: "danger", title: "Seeding failed. Nothing was changed.", lines: [err instanceof Error ? err.message : String(err)] });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className={eyebrow}>Operator</p>
        <h1 className={`${h1} mt-1`}>Demo controls</h1>
        <p className="mt-2 text-body text-ink-secondary">Reset before every run. Seed a confirmed Work Map if the live expert session goes wrong, so the new-hire part still works.</p>
      </header>

      <section className={`${card} space-y-5 p-6`} aria-label="Demo state">
        <div>
          <label htmlFor="demo-job" className={label}>Job</label>
          <select id="demo-job" className={`${field} mt-1.5`} value={jobId} onChange={(e) => setJobId(e.target.value)}>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.name} ({j.id})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onReset} disabled={busy !== null} aria-busy={busy === "reset"} className={btn.dangerQuiet}>
            {busy === "reset" ? "Clearing…" : "Reset demo state"}
          </button>
          <button type="button" onClick={onSeed} disabled={busy !== null || !jobId} aria-busy={busy === "seed"} className={btn.primary}>
            {busy === "seed" ? "Seeding…" : "Seed confirmed Work Map"}
          </button>
        </div>
        <p className={help}>
          Reset clears localStorage keys starting with <code>understudy:</code> and <code>expertai:</code>, sessionStorage, and the
          IndexedDB stores for frames and stuck-detector feedback. Seeding runs the real Work Map builder on a scripted returns-desk
          session and marks it <span className={pill.warning}>Seeded for demo</span> (expert &ldquo;Aarav (seeded)&rdquo;).
        </p>

        {result && (
          <div role="status" className={banner[result.tone]}>
            <div className="min-w-0">
              <p className="font-medium">{result.title}</p>
              {result.lines.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-meta">
                  {result.lines.map((l, i) => (
                    <li key={i} className="break-words">{l}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section className={`${card} p-6`} aria-label="Routes">
        <h2 className={h3}>Routes</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {ROUTES(jobId).map((r) => (
            <li key={r.href}>
              <Link href={r.href} className={`${inset} block px-4 py-3 no-underline hover:bg-surface-hover`}>
                <span className="block text-label text-link">{r.text}</span>
                <span className="block text-meta text-ink-secondary">{r.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
