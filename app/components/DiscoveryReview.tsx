"use client";

import { useState } from "react";

export interface Discovered {
  record_type: string;
  fields: { key: string; label: string; type: string; options?: string[]; known: boolean }[];
  actions: { key: string; label: string; sets: Record<string, string | number | null>; known: boolean }[];
  software: string[];
}

/** "ExpertAI learned this app": the discovered fields and actions, editable, saved into the job profile. */
export default function DiscoveryReview({ jobId, found, onDone }: { jobId: string; found: Discovered; onDone: () => void }) {
  const [fields, setFields] = useState(found.fields);
  const [actions, setActions] = useState(found.actions);
  const [saving, setSaving] = useState(false);
  const known = fields.filter((f) => f.known).length;

  async function save() {
    setSaving(true);
    await fetch(`/api/jobs/${encodeURIComponent(jobId)}/screen`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        record_type: found.record_type,
        fields: fields.map(({ key, label, type, options }) => ({ key, label, type, ...(options ? { options } : {}) })),
        actions: actions.map(({ key, label, sets }) => ({ key, label, sets })),
      }),
    }).catch(() => undefined);
    setSaving(false);
    onDone();
  }

  const input = "w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

  return (
    <section className="mb-6 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-500/30 dark:bg-sky-500/10">
      <p className="text-xs font-medium uppercase tracking-wider text-sky-700 dark:text-sky-300">ExpertAI learned this app</p>
      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
        {fields.length} fields, {actions.length} actions
        {found.software.length > 0 && <span className="font-normal text-slate-500"> · {known} match what {found.software.join(" / ")} normally shows</span>}
      </p>
      <p className="mt-1 text-xs text-slate-500">Fix anything it got wrong, then save. This becomes the job&rsquo;s screen map.</p>

      <ul className="mt-3 space-y-1.5">
        {fields.map((f, i) => (
          <li key={i} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
            <input className={input} value={f.label} onChange={(e) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, label: e.target.value, key: snake(e.target.value) } : x)))} />
            <select className={input} value={f.type} onChange={(e) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>
              {["text", "money", "date", "select", "status"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <button onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))} className="text-xs text-slate-500 hover:text-rose-600">remove</button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-500">Actions</p>
      <ul className="mt-1.5 space-y-1.5">
        {actions.map((a, i) => (
          <li key={i} className="grid grid-cols-[1fr_auto] items-center gap-2">
            <input className={input} value={a.label} onChange={(e) => setActions((as) => as.map((x, j) => (j === i ? { ...x, label: e.target.value, key: snake(e.target.value) } : x)))} />
            <button onClick={() => setActions((as) => as.filter((_, j) => j !== i))} className="text-xs text-slate-500 hover:text-rose-600">remove</button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2">
        <button onClick={save} disabled={saving || fields.length === 0} className="rounded-xl bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
          {saving ? "Saving…" : "Save screen map"}
        </button>
        <button onClick={onDone} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          Not now
        </button>
      </div>
    </section>
  );
}

const snake = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
