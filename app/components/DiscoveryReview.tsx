"use client";

import { useState } from "react";
import { btn, eyebrow, fieldCompact } from "@/components/ui/styles";
import { auditHeaders } from "@/lib/audit";

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
      headers: { "content-type": "application/json", ...auditHeaders() },
      body: JSON.stringify({
        record_type: found.record_type,
        fields: fields.map(({ key, label, type, options }) => ({ key, label, type, ...(options ? { options } : {}) })),
        actions: actions.map(({ key, label, sets }) => ({ key, label, sets })),
      }),
    }).catch(() => undefined);
    setSaving(false);
    onDone();
  }

  return (
    <section aria-labelledby="discovery-title" className="mb-6 rounded-lg border border-line bg-info-surface/60 p-4">
      <p className={`${eyebrow} text-info-ink`}>Generated screen map · review before saving</p>
      <h3 id="discovery-title" className="mt-1 text-body font-medium text-ink">
        {fields.length} fields, {actions.length} actions
        {found.software.length > 0 && (
          <span className="font-normal text-ink-secondary"> · {known} match what {found.software.join(" / ")} normally shows</span>
        )}
      </h3>
      <p className="mt-1 text-meta text-ink-secondary">Fix anything it got wrong, then save. This becomes the job&rsquo;s screen map.</p>

      <p className={`${eyebrow} mt-4`}>Fields</p>
      <ul className="mt-1.5 space-y-1.5">
        {fields.map((f, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-center gap-2">
            <label className="sr-only" htmlFor={`disc-field-${i}`}>Field {i + 1} label</label>
            <input
              id={`disc-field-${i}`}
              className={fieldCompact}
              value={f.label}
              onChange={(e) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, label: e.target.value, key: snake(e.target.value) } : x)))}
            />
            <label className="sr-only" htmlFor={`disc-type-${i}`}>Field {i + 1} type</label>
            <select
              id={`disc-type-${i}`}
              className={fieldCompact}
              value={f.type}
              onChange={(e) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}
            >
              {["text", "money", "date", "select", "status"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}
              aria-label={`Remove field ${f.label || i + 1}`}
              className={`${btn.tertiary} ${btn.compact} text-danger-ink`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <p className={`${eyebrow} mt-4`}>Actions</p>
      <ul className="mt-1.5 space-y-1.5">
        {actions.map((a, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <label className="sr-only" htmlFor={`disc-action-${i}`}>Action {i + 1} label</label>
            <input
              id={`disc-action-${i}`}
              className={fieldCompact}
              value={a.label}
              onChange={(e) => setActions((as) => as.map((x, j) => (j === i ? { ...x, label: e.target.value, key: snake(e.target.value) } : x)))}
            />
            <button
              type="button"
              onClick={() => setActions((as) => as.filter((_, j) => j !== i))}
              aria-label={`Remove action ${a.label || i + 1}`}
              className={`${btn.tertiary} ${btn.compact} text-danger-ink`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={saving || fields.length === 0} aria-busy={saving} className={`${btn.primary} ${btn.compact}`}>
          {saving ? "Saving screen map…" : "Save screen map"}
        </button>
        <button type="button" onClick={onDone} className={`${btn.secondary} ${btn.compact}`}>
          Not now
        </button>
      </div>
    </section>
  );
}

const snake = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
