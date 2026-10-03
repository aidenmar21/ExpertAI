"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Rule } from "@understudy/shared";
import { seedWorkMap, workMaps } from "@/lib/workmap";
import { PageChrome } from "@/components/JobsDashboard";
import { banner, btn, card, eyebrow, field, help, label as labelCls, link, page, pill } from "@/components/ui/styles";
import { auditHeaders } from "@/lib/audit";

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

/** Selectable option card (13.2 pattern as a pressed button; whole card is the target). */
const pick = (on: boolean) =>
  `${card} w-full min-h-11 p-4 text-left transition-[border-color,background-color] duration-150 ease-ui ${
    on ? "border-action bg-surface-selected ring-1 ring-action" : "hover:border-line-control hover:bg-surface-hover/40"
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
        headers: { "content-type": "application/json", ...auditHeaders() },
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
            headers: { "content-type": "application/json", ...auditHeaders() },
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

  const nextHint = ["Choose a role to continue", "", "Enter a job name to continue", ""][step];

  return (
    <div className="flex min-h-screen flex-col">
      <PageChrome />
      <main className={`${page} max-w-[52rem] pb-16 pt-8`}>
        <Link href="/jobs" className={`${link} text-meta font-medium`}>
          ← All jobs
        </Link>
        <h1 className="mt-3 text-page text-ink">New job</h1>
        <p className="mt-2 max-w-[65ch] text-reading text-ink-secondary">
          Start from a role ExpertAI already knows. The expert&apos;s own words always win over the standard.
        </p>

        <Stepper step={step} />

        <section className="mt-6" aria-live="polite">
          {step === 0 && (
            <fieldset>
              <legend className="text-sub text-ink">Which role is this?</legend>
              <p className="mt-1 text-body text-ink-secondary">Pre-loaded roles come with standard rules the expert confirms or corrects.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" role="radiogroup" aria-label="Role">
                {knowledge.roles.map((r) => (
                  <button key={r.id} type="button" role="radio" aria-checked={roleId === r.id} onClick={() => chooseRole(r)} className={pick(roleId === r.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-body font-medium text-ink">{r.name}</p>
                      <span className={`${pill.neutral} shrink-0`}>{r.category}</span>
                    </div>
                    <p className="mt-1.5 text-meta text-ink-secondary">{r.summary}</p>
                  </button>
                ))}
                <button type="button" role="radio" aria-checked={roleId === null} onClick={() => chooseRole(null)} className={`${pick(roleId === null)} border-dashed`}>
                  <p className="text-body font-medium text-ink">Start blank</p>
                  <p className="mt-1.5 text-meta text-ink-secondary">No standard rules. The apprentice learns everything from the expert.</p>
                </button>
              </div>
            </fieldset>
          )}

          {step === 1 && (
            <fieldset>
              <legend className="text-sub text-ink">Which software is the job done in?</legend>
              <p className="mt-1 text-body text-ink-secondary">Pick everything the expert will have on screen.</p>
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
                    <button type="button" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} className={`${btn.tertiary} ${btn.compact} -ml-3`}>
                      {showMore ? "Hide other software" : `Show more software (${moreSoftware.length})`}
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
            </fieldset>
          )}

          {step === 2 && (
            <div className={`${card} p-5 md:p-6`}>
              <h2 className="text-sub text-ink">Name the job</h2>
              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={labelCls} htmlFor="job-name">
                    Job name
                  </label>
                  <input
                    id="job-name"
                    className={`${field} mt-1.5`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={role ? `${role.name.split(",")[0]} at our company` : "e.g. Front desk, Riverside Hotel"}
                    autoComplete="off"
                    aria-describedby="job-name-help"
                    autoFocus
                  />
                  <p id="job-name-help" className={help}>
                    Saved as <code className="rounded-xs bg-surface-subtle px-1 py-0.5 font-mono text-code">shared/jobs/{id || "…"}.json</code>
                  </p>
                </div>
                <div>
                  <label className={labelCls} htmlFor="job-escalate">
                    Escalate to
                  </label>
                  <input id="job-escalate" className={`${field} mt-1.5`} value={escalateTo} onChange={(e) => setEscalateTo(e.target.value)} placeholder="Manager" autoComplete="off" />
                </div>
                <div>
                  <label className={labelCls} htmlFor="job-category">
                    Category
                  </label>
                  <input id="job-category" className={`${field} mt-1.5`} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="General" autoComplete="off" />
                </div>
                <div>
                  <label className={labelCls} htmlFor="job-date">
                    Business date
                  </label>
                  <input id="job-date" type="date" className={`${field} mt-1.5`} value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className={`${card} p-5 md:p-6`}>
              <h2 className="text-sub text-ink">Paste company knowledge</h2>
              <p className="mt-1 text-body text-ink-secondary">
                Optional. Policies, SOPs, a handbook page. ExpertAI turns it into draft rules the expert confirms on the Work Map.
              </p>
              <label className={`${labelCls} mt-5`} htmlFor="job-knowledge">
                Company knowledge <span className="font-normal text-ink-tertiary">(optional)</span>
              </label>
              <textarea
                id="job-knowledge"
                className={`${field} mt-1.5 min-h-[14rem] resize-y font-mono text-code leading-5`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Refunds over $100 need a manager. Guests without a card on file cannot check in. ..."
              />
              <Summary role={role} software={knowledge.software.filter((s) => softwareIds.includes(s.id))} name={name} id={id} escalateTo={escalateTo} />
            </div>
          )}
        </section>

        {error && (
          <div role="alert" className={`${banner.danger} mt-4`}>
            <div>
              <p className="font-medium">The job was not created</p>
              <p className="mt-1 text-meta">{error} Your entries are still here; try again.</p>
            </div>
          </div>
        )}

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className={btn.secondary} onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || !!busy}>
            Back
          </button>
          <div className="flex items-center gap-3">
            {!canNext && nextHint && <span className="text-meta text-ink-secondary">{nextHint}</span>}
            {step < STEPS.length - 1 ? (
              <button type="button" className={btn.primary} onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                Continue to {STEPS[step + 1].toLowerCase()}
              </button>
            ) : (
              <button type="button" className={btn.primary} onClick={finish} disabled={!!busy || !canNext} aria-busy={!!busy}>
                {busy ? `${busy}…` : "Create job"}
              </button>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mt-6 flex flex-wrap items-center gap-2" aria-label="Steps">
      {STEPS.map((s, i) => {
        const done = i < step;
        const on = i === step;
        return (
          <li key={s} className="flex items-center gap-2" aria-current={on ? "step" : undefined}>
            <span
              className={`flex size-7 items-center justify-center rounded-full text-note font-semibold ${
                on ? "bg-action text-on-action" : done ? "bg-success-surface text-success-ink" : "bg-surface-subtle text-ink-secondary"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`text-meta ${on ? "font-medium text-ink" : "text-ink-secondary"}`}>
              {s}
              {done && <span className="sr-only"> (done)</span>}
            </span>
            {i < STEPS.length - 1 && <span aria-hidden className="mx-1 h-px w-6 bg-line" />}
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
          <p className="truncate text-body font-medium text-ink">{s.name}</p>
          <p className="text-meta text-ink-secondary">{s.kind}</p>
        </div>
        <span
          aria-hidden
          className={`flex size-5 shrink-0 items-center justify-center rounded-xs border text-note ${
            on ? "border-action bg-action text-on-action" : "border-line-control"
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
    <dl className="mt-5 grid grid-cols-1 gap-3 rounded-md bg-surface-subtle p-4 text-body md:grid-cols-2">
      <p className={`${eyebrow} md:col-span-2`}>Summary</p>
      <Row k="Job" v={`${name} (${id})`} />
      <Row k="Role" v={role?.name ?? "Blank start"} />
      <Row k="Software" v={software.length ? software.map((s) => s.name).join(", ") : "None"} />
      <Row k="Escalate to" v={escalateTo || role?.escalate_to || "Manager"} />
    </dl>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-note text-ink-secondary">{k}</dt>
      <dd className="mt-0.5 break-words text-ink">{v}</dd>
    </div>
  );
}
