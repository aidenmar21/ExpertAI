"use client";

import { useRef, useState } from "react";
import type { JobField, Value } from "@understudy/shared";
import type { ClientJob, JobRecord } from "@/lib/job";
import { groundTruth, sessionT } from "@/lib/session";

type Mode = "expert" | "new_hire";

/** Renders any job profile from its fields and actions. No per-job code. */
export default function FakeApp({ profile, mode = "expert" }: { profile: ClientJob; mode?: Mode }) {
  const { job, screen } = profile;
  const [records, setRecords] = useState<JobRecord[]>(() => profile.records[mode].map((r) => ({ ...r })));
  const [current, setCurrent] = useState(0);
  const idField = screen.fields[0]?.key;
  const statusField = screen.fields.find((f) => f.type === "status");
  const rec = records[current];

  const recordId = (r: JobRecord | undefined, i: number) =>
    r && idField && r[idField] != null ? String(r[idField]) : `No ${labelOf(screen.fields[0])} #${i + 1}`;

  function commit(changes: JobRecord) {
    const before = records[current];
    const t = sessionT();
    for (const [field, to] of Object.entries(changes)) {
      const from = before[field] ?? null;
      if (from === to) continue;
      groundTruth.push({ t, field, from, to, record: idField ? (before[idField] as string | null) ?? null : null });
    }
    setRecords((rs) => rs.map((r, i) => (i === current ? { ...r, ...changes } : r)));
  }

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-sky-600 dark:text-sky-400">{job.category}</p>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{job.name}</h1>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Business date {job.business_date}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="w-52 shrink-0 overflow-y-auto border-r border-slate-200 p-3 dark:border-slate-800">
          <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            {capitalize(screen.record_type)} queue
          </p>
          <ul className="space-y-1">
            {records.map((r, i) => (
              <li key={i}>
                <button
                  onClick={() => setCurrent(i)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                    i === current
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="block font-medium">{recordId(r, i)}</span>
                  {statusField && <span className="block text-xs text-slate-500">{String(r[statusField.key] ?? "")}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {rec ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-6 pt-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                {capitalize(screen.record_type)} {recordId(rec, current)}
              </h2>
              {statusField && <StatusBadge value={rec[statusField.key]} />}
            </div>

            <form
              key={current}
              onSubmit={(e) => e.preventDefault()}
              className="grid flex-1 grid-cols-1 content-start gap-x-6 gap-y-5 overflow-y-auto px-6 py-5 sm:grid-cols-2"
            >
              {screen.fields
                .filter((f) => f.type !== "status")
                .map((f) => (
                  <Field key={f.key} field={f} value={rec[f.key] ?? null} onCommit={(v) => commit({ [f.key]: v })} />
                ))}
            </form>

            <footer className="flex flex-wrap gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              {screen.actions.map((a, i) => (
                <button
                  key={a.key}
                  onClick={() => commit(a.sets)}
                  className={
                    i === 0
                      ? "rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
                      : "rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  }
                >
                  {a.label}
                </button>
              ))}
            </footer>
          </div>
        ) : (
          <p className="m-auto text-sm text-slate-500">No records in this job profile.</p>
        )}
      </div>
    </section>
  );
}

function Field({ field, value, onCommit }: { field: JobField; value: Value; onCommit: (v: Value) => void }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const focusValue = useRef(draft);
  const input =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

  const parse = (s: string): Value => (s === "" ? null : field.type === "money" ? Number(s) : s);

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">{field.label}</span>
      {field.type === "select" ? (
        <select
          className={input}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onCommit(parse(e.target.value));
          }}
        >
          <option value="">Select…</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={input}
          type={field.type === "money" ? "number" : field.type === "date" ? "date" : "text"}
          step={field.type === "money" ? "0.01" : undefined}
          value={draft}
          onFocus={() => (focusValue.current = draft)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== focusValue.current && onCommit(parse(draft))}
        />
      )}
    </label>
  );
}

function StatusBadge({ value }: { value: Value }) {
  return (
    <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 ring-1 ring-teal-600/20 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-400/30">
      {value ?? "—"}
    </span>
  );
}

const labelOf = (f?: JobField) => f?.label ?? "id";
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
