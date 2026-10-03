"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Rule } from "@understudy/shared";
import { seedWorkMap, workMaps } from "@/lib/workmap";

export interface KnowledgeRole {
  id: string;
  name: string;
  category: string;
  summary: string;
  software: string[];
  record_type: string;
  escalate_to: string;
}
export interface KnowledgeSoftware {
  id: string;
  name: string;
  kind: string;
  used_by: string[];
}
export interface KnowledgeIndex {
  roles: KnowledgeRole[];
  software: KnowledgeSoftware[];
}

const STEPS = ["Role", "Software", "Name", "Knowledge"] as const;

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

const todayISO = () => new Date().toISOString().slice(0, 10);

const card = "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";
const input =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50";
const label = "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const primaryBtn =
  "rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800";
const pick = (on: boolean) =>
  `${card} w-full p-4 text-left transition ${
    on ? "border-sky-500 ring-2 ring-sky-500/30 dark:border-sky-400" : "hover:border-slate-300 dark:hover:border-slate-700"
  }`;

/** Four steps on one page: role, software, name, pasted company knowledge. Everything comes from knowledge/index.json. */
export default function NewJobWizard({ knowledge }: { knowledge: KnowledgeIndex }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [roleId, setRoleId] = useState<string | null | undefined>(undefined); // undefined: nothing chosen; null: blank
  const [softwareIds, setSoftwareIds] = useState<string[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [name, setName] = useState("");
  const [escalateTo, setEscalateTo] = useState("");
  const [category, setCategory] = useState("");
  const [businessDate, setBusinessDate] = useState(todayISO);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const role = useMemo(() => knowledge.roles.find((r) => r.id === roleId) ?? null, [knowledge.roles, roleId]);
  const roleSoftware = useMemo(
    () => (role ? role.software.map((id) => knowledge.software.find((s) => s.id === id)).filter((s): s is KnowledgeSoftware => !!s) : []),
    [role, knowledge.software],
  );
  const moreSoftware = knowledge.software.filter((s) => !roleSoftware.some((r) => r.id === s.id));
  const id = slugify(name);

  const chooseRole = (r: KnowledgeRole | null) => {
    setRoleId(r ? r.id : null);
    setSoftwareIds(r ? r.software : []);
    setEscalateTo(r?.escalate_to ?? "");
    setCategory(r?.category ?? "");
    setShowMore(!r);
    setError(null);
  };
  const toggleSoftware = (sid: string) => setSoftwareIds((cur) => (cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid]));

  const canNext = [roleId !== undefined, true, name.trim().length > 0 && id.length > 0, true][step];

  async function finish() {
    setBusy("Creating the job");
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role_id: role?.id ?? null,
          software_ids: softwareIds,
          written_policy: text,
          escalate_to: escalateTo.trim() || undefined,
          category: category.trim() || undefined,
          business_date: businessDate,
        }),
      });
      const body = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !body.id) throw new Error(body.error ?? "could not create the job");
      const jobId = body.id;

      if (text.trim()) {
        setBusy("Reading your company knowledge");
        await seedWorkMap(jobId, "Expert");
        try {
          const pr = await fetch("/api/policy", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ job_id: jobId, text }),
          });
          if (pr.ok) {
            const { rules } = (await pr.json()) as { rules: Rule[] };
            if (rules?.length) workMaps.addRules(jobId, rules);
          }
        } catch {
          /* the text is saved on the job; rules can be parsed again from the Work Map page */
        }
      }
      router.push(`/?job=${encodeURIComponent(jobId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 pb-16 pt-6">
      <Link href="/jobs" className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-300">
        ← All jobs
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">New job</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Start from a role ExpertAI already knows. The expert&apos;s own words always win over the standard.
      </p>

      <Stepper step={step} />

      <section className="mt-6">
        {step === 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Which role is this?</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pre-loaded roles come with standard rules the expert confirms or corrects.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {knowledge.roles.map((r) => (
                <button key={r.id} type="button" onClick={() => chooseRole(r)} className={pick(roleId === r.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-slate-900 dark:text-slate-50">{r.name}</p>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {r.category}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{r.summary}</p>
                </button>
              ))}
              <button type="button" onClick={() => chooseRole(null)} className={`${pick(roleId === null)} border-dashed`}>
                <p className="font-medium text-slate-900 dark:text-slate-50">Start blank</p>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                  No standard rules. The apprentice learns everything from the expert.
                </p>
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Which software is the job done in?</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pick everything the expert will have on screen.</p>
            {roleSoftware.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {roleSoftware.map((s) => (
                  <SoftwareCard key={s.id} s={s} on={softwareIds.includes(s.id)} onToggle={() => toggleSoftware(s.id)} />
                ))}
              </div>
            )}
            {moreSoftware.length > 0 && (
              <div className="mt-4">
                {roleSoftware.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowMore((v) => !v)}
                    className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-300"
                  >
                    {showMore ? "Hide other software" : `More software (${moreSoftware.length})`}
                  </button>
                )}
                {(showMore || roleSoftware.length === 0) && (
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {moreSoftware.map((s) => (
                      <SoftwareCard key={s.id} s={s} on={softwareIds.includes(s.id)} onToggle={() => toggleSoftware(s.id)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className={`${card} p-6`}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Name the job</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={label} htmlFor="job-name">
                  Job name
                </label>
                <input
                  id="job-name"
                  className={`${input} mt-1`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={role ? `${role.name.split(",")[0]} at our company` : "e.g. Front desk, Riverside Hotel"}
                  autoFocus
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Saved as <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">shared/jobs/{id || "…"}.json</code>
                </p>
              </div>
              <div>
                <label className={label} htmlFor="job-escalate">
                  Escalate to
                </label>
                <input id="job-escalate" className={`${input} mt-1`} value={escalateTo} onChange={(e) => setEscalateTo(e.target.value)} placeholder="Manager" />
              </div>
              <div>
                <label className={label} htmlFor="job-category">
                  Category
                </label>
                <input id="job-category" className={`${input} mt-1`} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="General" />
              </div>
              <div>
                <label className={label} htmlFor="job-date">
                  Business date
                </label>
                <input id="job-date" type="date" className={`${input} mt-1`} value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={`${card} p-6`}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Paste company knowledge</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Optional. Policies, SOPs, a handbook page. ExpertAI turns it into draft rules the expert confirms on the Work Map.
            </p>
            <textarea
              className={`${input} mt-4 min-h-[14rem] resize-y font-mono text-xs leading-relaxed`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Refunds over $100 need a manager. Guests without a card on file cannot check in. ..."
            />
            <Summary role={role} software={knowledge.software.filter((s) => softwareIds.includes(s.id))} name={name} id={id} escalateTo={escalateTo} />
          </div>
        )}
      </section>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      <footer className="mt-8 flex items-center justify-between gap-3">
        <button type="button" className={ghostBtn} onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || !!busy}>
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className={primaryBtn} onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Continue
          </button>
        ) : (
          <button type="button" className={primaryBtn} onClick={finish} disabled={!!busy || !canNext}>
            {busy ? `${busy}…` : "Create job"}
          </button>
        )}
      </footer>
    </main>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mt-6 flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < step;
        const on = i === step;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                on
                  ? "bg-sky-600 text-white"
                  : done
                    ? "bg-teal-500/15 text-teal-700 dark:text-teal-300"
                    : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-sm ${on ? "font-medium text-slate-900 dark:text-slate-50" : "text-slate-500 dark:text-slate-400"}`}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-slate-300 dark:bg-slate-700" />}
          </li>
        );
      })}
    </ol>
  );
}

function SoftwareCard({ s, on, onToggle }: { s: KnowledgeSoftware; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className={pick(on)} aria-pressed={on}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900 dark:text-slate-50">{s.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{s.kind}</p>
        </div>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] ${
            on ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 dark:border-slate-600"
          }`}
        >
          {on ? "✓" : ""}
        </span>
      </div>
    </button>
  );
}

function Summary({
  role,
  software,
  name,
  id,
  escalateTo,
}: {
  role: KnowledgeRole | null;
  software: KnowledgeSoftware[];
  name: string;
  id: string;
  escalateTo: string;
}) {
  return (
    <dl className="mt-5 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-950/60 md:grid-cols-2">
      <Row k="Job" v={`${name} (${id})`} />
      <Row k="Role" v={role?.name ?? "Blank start"} />
      <Row k="Software" v={software.length ? software.map((s) => s.name).join(", ") : "None"} />
      <Row k="Escalate to" v={escalateTo || role?.escalate_to || "Manager"} />
    </dl>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{k}</dt>
      <dd className="mt-0.5 text-slate-800 dark:text-slate-100">{v}</dd>
    </div>
  );
}
