"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { JobField, Value } from "@understudy/shared";
import type { ClientJob, JobRecord } from "@/lib/job";
import { activity, groundTruth, sessionT } from "@/lib/session";
import { demoRecorder, keyTrace, recording, teachMode } from "@/lib/keytrace";
import KeyCast from "@/components/KeyCast";
import MouseTrail from "@/components/MouseTrail";

type Mode = "expert" | "new_hire";

interface FakeAppProps {
  profile: ClientJob;
  mode?: Mode;
  /** Tutor mode: runs before an action saves. Return false to block the save. */
  beforeAction?: (action: string, record: JobRecord, caseIndex: number) => boolean;
  /** Shown above the action bar, e.g. the tutor's guardrail notice. */
  notice?: ReactNode;
  /** Drawn over the app, e.g. the tutor's show-me pointer. Targets carry data-guide="field:<key>" / "action:<key>". */
  overlay?: ReactNode;
  /** Called with the open record (as entered so far) and the case in front of the worker, whenever either changes. */
  onRecord?: (record: JobRecord, index: number, expected: JobRecord, onScreen: JobRecord) => void;
}

/*
 * The simulated job app is deliberately NOT in the ExpertAI style: it stands in for the customer's own
 * boring internal tool. Neutral zinc palette, thin dark header bar, denser rows, standard inputs.
 * Field anatomy still follows spec 12 (persistent labels, 16px input text, 44px targets on touch).
 */
const tool = {
  frame: "flex h-full flex-col overflow-hidden rounded-md border border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
  header: "flex min-h-10 items-center justify-between gap-3 bg-zinc-800 px-4 text-[13px] text-zinc-100 dark:bg-zinc-950",
  nav: "w-full shrink-0 overflow-y-auto border-b border-zinc-200 bg-zinc-50 p-2 sm:w-48 sm:border-r sm:border-b-0 dark:border-zinc-700 dark:bg-zinc-900",
  row: "block w-full rounded-sm px-2.5 py-1.5 text-left text-[13px] leading-5 transition-colors duration-150",
  rowOn: "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50",
  rowOff: "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
  label: "mb-1 block text-[13px] font-medium leading-4 text-zinc-700 dark:text-zinc-300",
  input:
    "block w-full min-h-11 rounded-sm border border-zinc-400 bg-white px-2.5 py-1.5 text-base leading-6 text-zinc-900 outline-none transition-[border-color,box-shadow] duration-150 focus:border-zinc-700 focus:ring-2 focus:ring-zinc-400/40 pointer-fine:min-h-9 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300",
  readonly: "block min-h-11 rounded-sm border border-zinc-200 bg-zinc-100 px-2.5 py-1.5 text-base leading-6 text-zinc-700 pointer-fine:min-h-9 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  btn: "inline-flex min-h-11 items-center justify-center rounded-sm border px-3.5 text-[13px] font-medium transition-colors duration-150 pointer-fine:min-h-9",
  btnPrimary: "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-700 dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white",
  btnPlain: "border-zinc-400 bg-white text-zinc-800 hover:bg-zinc-100 active:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
  status: "inline-flex items-center rounded-sm border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[12px] font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
};

/** Renders any job profile from its fields and actions. No per-job code. */
export default function FakeApp({ profile, mode = "expert", beforeAction, notice, overlay, onRecord }: FakeAppProps) {
  const { job, screen } = profile;
  const idField = screen.fields[0]?.key;
  const statusField = screen.fields.find((f) => f.type === "status");
  // The cases are what each customer hands over (shown on the slip). The form starts blank and the worker keys
  // them in; only the id field starts with its prefix (e.g. "R-") and read-only data stays filled.
  const cases = profile.records[mode];
  const idPrefix = (() => {
    const v = cases.map((c) => (idField ? c[idField] : null)).find((x) => typeof x === "string");
    return typeof v === "string" ? /^[A-Za-z]+-/.exec(v)?.[0] ?? null : null;
  })();
  const [records, setRecords] = useState<JobRecord[]>(() =>
    cases.map((c) =>
      Object.fromEntries(
        screen.fields.map((f) => [f.key, f.type === "status" || f.readonly ? c[f.key] ?? null : f.key === idField ? idPrefix : null]),
      ),
    ),
  );
  const [current, setCurrent] = useState(0);
  const rec = records[current];
  /** A record as the rules should see it: the bare id prefix counts as not entered. */
  const clean = (r: JobRecord): JobRecord => (idField && idPrefix && r[idField] === idPrefix ? { ...r, [idField]: null } : r);
  // Queue and demo ids come from the case, so they stay put while the worker types.
  const recordId = (_r: JobRecord | undefined, i: number) => {
    const c = cases[i];
    return c && idField && c[idField] != null ? String(c[idField]) : `No ${labelOf(screen.fields[0])} #${i + 1}`;
  };

  const teaching = useSyncExternalStore(teachMode.subscribe, teachMode.get, () => true);
  const recordingSince = useSyncExternalStore(recording.subscribe, recording.get, () => null);
  const tracing = mode === "expert" && (teaching || recordingSince !== null);
  const pii = useRef(new Set(screen.fields.filter((f) => f.pii).map((f) => f.key)));
  const recorder = useRef(demoRecorder());
  const keystrokes = useSyncExternalStore(keyTrace.subscribe, () => keyTrace.all().filter((e) => e.kind === "key").length, () => 0);
  const clicks = useSyncExternalStore(keyTrace.subscribe, () => keyTrace.all().filter((e) => e.kind === "click").length, () => 0);

  // Expert mode: note the record as it was opened, so the demo starts from what the expert saw.
  useEffect(() => {
    if (tracing && records[current]) recorder.current.open(recordId(records[current], current), records[current], sessionT(), pii.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, tracing]);

  // Record task: start learning fresh when recording starts; keep a half-done case when it stops.
  const wasRecording = useRef(false);
  useEffect(() => {
    const now = recordingSince !== null;
    if (now && !wasRecording.current) recorder.current.restart();
    if (!now && wasRecording.current) recorder.current.flush(taskTitle());
    wasRecording.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingSince]);

  useEffect(() => {
    if (rec) onRecord?.(clean(rec), current, cases[current], rec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec, current, onRecord]);

  // Expert mode: follow the mouse over the app (0..1 of the frame) so the walkthrough can move the same way.
  function rel(e: React.PointerEvent) {
    const o = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - o.left) / o.width, (e.clientY - o.top) / o.height] as const;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (tracing) recorder.current.move(...rel(e));
  }
  function onPointerDown(e: React.PointerEvent) {
    // Clicks on controls drawn over the app (toolbars, the guide) are not part of the task.
    if (!tracing || (e.target as HTMLElement).closest("[data-guide-ignore]")) return;
    const target = (e.target as HTMLElement).closest("[data-guide]")?.getAttribute("data-guide") ?? null;
    recorder.current.click(...rel(e), target, sessionT());
  }

  /** A learned task's name, e.g. "R-88101 · Novel: The Lighthouse Keeper → Refund". */
  function taskTitle(action?: string) {
    const c = cases[current];
    const what = c ? screen.fields.filter((f) => f.type === "text" && !f.pii && f.key !== idField).map((f) => c[f.key]).find(Boolean) : null;
    const act = action ? screen.actions.find((a) => a.key === action)?.label : null;
    return [recordId(rec, current), what ? String(what) : null].filter(Boolean).join(" · ") + (act ? ` → ${act}` : " (partial)");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!tracing || ["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) return;
    const field = (e.target as HTMLElement).closest("[data-guide^='field:']")?.getAttribute("data-guide")?.slice(6);
    if (field) recorder.current.key(field, e.key, sessionT(), pii.current.has(field));
  }

  function runAction(key: string, sets: JobRecord) {
    activity.hover(null);
    if (beforeAction && !beforeAction(key, clean(records[current]), current)) return;
    if (tracing) recorder.current.action(key, sessionT(), taskTitle(key));
    commit(sets, true);
  }

  function commit(changes: JobRecord, byAction = false) {
    const before = records[current];
    const t = sessionT();
    for (const [field, to] of Object.entries(changes)) {
      const from = before[field] ?? null;
      if (from === to) continue;
      const record = recordId(before, current);
      groundTruth.push({ t, field, from, to, record });
      if (tracing && !byAction) recorder.current.change(field, t, to, pii.current.has(field));
      activity.fieldChanged({ t, field, record });
    }
    setRecords((rs) => rs.map((r, i) => (i === current ? { ...r, ...changes } : r)));
  }

  return (
    <section
      aria-label={`${job.name} (simulated app)`}
      data-guide-root
      className={`relative ${tool.frame}`}
      onKeyDownCapture={onKeyDown}
      onPointerMove={onPointerMove}
      onPointerDownCapture={onPointerDown}
    >
      <header className={tool.header}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate font-semibold">{job.name}</span>
          <span className="hidden text-zinc-400 sm:inline">{job.category}</span>
        </div>
        <span className="flex shrink-0 items-center gap-3 text-zinc-300">
          {tracing && (
            <span className="inline-flex items-center gap-1.5 text-[12px]" title="Keystrokes, clicks, and mouse movement in this app are recorded so the tutor can show new hires the same steps.">
              <span aria-hidden className={`size-2 animate-pulse rounded-full ${recordingSince !== null ? "bg-red-500" : "bg-sky-400"}`} />
              {recordingSince !== null ? "REC" : "Following"} · {keystrokes} keys · {clicks} clicks · mouse
            </span>
          )}
          Business date {job.business_date}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <nav aria-label={`${capitalize(screen.record_type)} queue`} className={`${tool.nav} max-h-40 sm:max-h-none sm:w-48`}>
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {capitalize(screen.record_type)} queue ({records.length})
          </p>
          <ul className="space-y-0.5">
            {records.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  aria-current={i === current ? "true" : undefined}
                  onClick={() => {
                    setCurrent(i);
                    activity.recordOpened(sessionT());
                  }}
                  className={`${tool.row} ${i === current ? tool.rowOn : tool.rowOff}`}
                >
                  <span className="block font-medium">{recordId(r, i)}</span>
                  {statusField && <span className="block text-[12px] text-zinc-500 dark:text-zinc-400">{String(r[statusField.key] ?? "")}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {rec ? (
          <div className="@container flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-700">
              <h2 className="text-[15px] font-semibold leading-5">
                {capitalize(screen.record_type)} {recordId(rec, current)}
              </h2>
              {statusField && <StatusBadge value={rec[statusField.key]} />}
            </div>

            <CaseSlip fields={screen.fields} data={cases[current]} prefix={idPrefix} />
            <form
              key={current}
              onSubmit={(e) => e.preventDefault()}
              className="grid flex-1 grid-cols-1 content-start gap-x-4 gap-y-3 overflow-y-auto px-4 py-3 @lg:grid-cols-2"
            >
              {screen.fields
                .filter((f) => f.type !== "status")
                .map((f) => (
                  <Field key={f.key} field={f} value={rec[f.key] ?? null} onCommit={(v) => commit({ [f.key]: v })} />
                ))}
            </form>

            {tracing && (
              <KeyCast
                fieldLabel={(k) => screen.fields.find((f) => f.key === k)?.label ?? k}
                actionLabel={(k) => screen.actions.find((a) => a.key === k)?.label ?? k}
              />
            )}
            {notice}
            <footer className="flex flex-wrap gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-2.5 dark:border-zinc-700 dark:bg-zinc-900">
              {screen.actions.map((a, i) => (
                <button
                  key={a.key}
                  type="button"
                  data-guide={`action:${a.key}`}
                  onClick={() => runAction(a.key, a.sets)}
                  onPointerEnter={() => activity.hover(a.key)}
                  onPointerLeave={() => activity.hover(null)}
                  className={`${tool.btn} ${i === 0 ? tool.btnPrimary : tool.btnPlain}`}
                >
                  {a.label}
                </button>
              ))}
            </footer>
          </div>
        ) : (
          <div className="m-auto px-6 py-10 text-center">
            <p className="text-[15px] font-medium">No records in this queue</p>
            <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">This job profile has no sample records for this mode.</p>
          </div>
        )}
      </div>
      {tracing && <MouseTrail />}
      {overlay}
    </section>
  );
}

function Field({ field, value, onCommit }: { field: JobField; value: Value; onCommit: (v: Value) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const readonly = (field as JobField & { readonly?: boolean }).readonly === true;
  const focusValue = useRef(draft);

  const parse = (s: string): Value => (s === "" ? null : field.type === "money" ? Number(s) : s);

  return (
    <div data-guide={`field:${field.key}`}>
      <label htmlFor={id} className={tool.label}>
        {field.label}
        {readonly && <span className="ml-1 font-normal text-zinc-500">(read only)</span>}
      </label>
      {readonly ? (
        <p id={id} className={tool.readonly}>
          {value == null || value === "" ? "—" : String(value)}
        </p>
      ) : field.type === "select" ? (
        <select
          id={id}
          className={tool.input}
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
          id={id}
          className={tool.input}
          type={field.type === "money" ? "number" : field.type === "date" ? "date" : "text"}
          inputMode={field.type === "money" ? "decimal" : undefined}
          step={field.type === "money" ? "0.01" : undefined}
          autoComplete="off"
          value={draft}
          onFocus={() => (focusValue.current = draft)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== focusValue.current && onCommit(parse(draft))}
        />
      )}
    </div>
  );
}

function StatusBadge({ value }: { value: Value }) {
  return <span className={tool.status}>{value ?? "—"}</span>;
}

const labelOf = (f?: JobField) => f?.label ?? "id";
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the customer handed over for this case, to key into the blank form. Looks like a printed slip. */
function CaseSlip({ fields, data, prefix }: { fields: JobField[]; data: JobRecord | undefined; prefix: string | null }) {
  if (!data) return null;
  const shown = fields.filter((f) => f.type !== "status" && !f.readonly);
  const fmt = (f: JobField, v: Value) =>
    v == null || v === "" ? (f.key === fields[0]?.key ? `No ${f.label.toLowerCase().replace(/\.$/, "")}` : "—") : f.type === "money" ? `$${Number(v).toFixed(2)}` : String(v);
  return (
    <div className="mx-4 mt-3 rounded-sm border border-dashed border-zinc-400 bg-amber-50/70 px-3 py-2 font-mono text-[12px] leading-5 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-200">
      <p className="mb-1 font-sans text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        At the counter · key these in{prefix ? ` (receipt numbers start with ${prefix})` : ""}
      </p>
      <dl className="grid grid-cols-1 gap-x-4 @md:grid-cols-2">
        {shown.map((f) => (
          <div key={f.key} className="flex min-w-0 gap-2">
            <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">{f.label}</dt>
            <dd className="truncate font-semibold">{fmt(f, data[f.key] ?? null)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
