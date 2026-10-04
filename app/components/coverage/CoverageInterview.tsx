"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Rule } from "@understudy/shared";
import { ApprenticeVoiceProvider, useApprenticeAgent } from "@understudy/voice";
import { useWorkMap, workMaps } from "@/lib/workmap";
import { auditHeaders, logAudit } from "@/lib/audit";
import { banner, btn, card, emptyBox, eyebrow, field, help, inset, link, page, pill } from "@/components/ui/styles";

/**
 * Coverage interview: ExpertAI walks the expert through every industry-standard rule nobody has confirmed yet,
 * and the expert says how it works at their company. Confirmed rules come only from the expert's own words.
 */
interface Props { jobId: string; jobName: string; rolePlural: string; escalateTo: string }

type Verdict = "same" | "different" | "not_applicable" | "unclear";
interface CoverageResponse { verdict: Verdict; quote: string; rule?: Rule }
interface Answered { id: string; text: string; verdict: Exclude<Verdict, "unclear"> | "skipped"; quote: string; newRule?: string }
interface NotApplicable { id: string; text: string; quote: string }

const isOpenBaseline = (r: Rule) => r.source === "baseline" && !r.confirmed && !r.overridden_by;
const GUARDRAIL_TYPES: Rule["type"][] = ["guardrail", "limit", "stop_and_ask"];
const ASK_DELAY_MS = 900;

export default function CoverageInterview(props: Props) {
  return (
    <ApprenticeVoiceProvider>
      <Interview {...props} />
    </ApprenticeVoiceProvider>
  );
}

function Interview({ jobId, jobName, rolePlural, escalateTo }: Props) {
  const map = useWorkMap(jobId);
  const expert = map?.expert ?? "Expert";
  const briefing = useBriefing(jobId);
  const notApplicable = useNotApplicable(jobId);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interviewing, setInterviewing] = useState(false);
  const [text, setText] = useState("");

  const agent = useApprenticeAgent("interviewer", { expert, escalateTo, workMap: map, briefing, onError: setError });

  const open = useMemo(() => map?.rules.filter(isOpenBaseline) ?? [], [map]);
  const pending = open.filter((r) => !skipped.includes(r.id));
  const current = pending[0] ?? null;
  const confirmed = map?.rules.filter((r) => r.confirmed).length ?? 0;
  const denom = confirmed + open.length;
  const coverage = denom ? Math.round((confirmed / denom) * 100) : 0;
  const connected = agent.status === "connected";

  const question = (r: Rule, n: number) =>
    n === 0
      ? `Most ${rolePlural}: ${r.text} Is it the same at your company, different, or does it not apply?`
      : `Sorry, I did not catch that. "${r.text}" Same at your company, different, or does it not apply?`;

  // Voice: one question per rule (and one retry when the answer was unclear). Remember where the transcript was.
  const asked = useRef<{ key: string; from: number } | null>(null);
  const askKey = current ? `${current.id}:${attempt}` : "";
  async function submit(rule: Rule, answer: string) {
    const said = answer.trim();
    if (!said || busy) return;
    if (asked.current?.key === askKey) asked.current = { key: askKey, from: Number.POSITIVE_INFINITY };
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/coverage", {
        method: "POST",
        headers: { "content-type": "application/json", ...auditHeaders() },
        body: JSON.stringify({ job_id: jobId, rule, answer: said }),
      });
      if (!res.ok) throw new Error(`coverage ${res.status}`);
      const out = (await res.json()) as CoverageResponse;
      apply(rule, out);
      setText("");
    } catch {
      setError("Could not record that answer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function apply(rule: Rule, { verdict, quote, rule: companyRule }: CoverageResponse) {
    if (verdict === "unclear") {
      if (attempt === 0) {
        setAttempt(1);
        setNotice("Not sure which that was. Same, different, or does it not apply?");
      } else {
        setSkipped((s) => [...s, rule.id]);
        setAttempt(0);
        setAnswered((a) => [...a, { id: rule.id, text: rule.text, verdict: "skipped", quote }]);
        setNotice("Skipped for now. It stays on the list for next time.");
      }
      return;
    }
    setAttempt(0);
    if (verdict === "same") {
      workMaps.update(jobId, (m) => ({
        ...m,
        rules: m.rules.map((r) =>
          r.id === rule.id
            ? { ...r, confirmed: true, confirmed_by: undefined, reason_quote: quote, overridden_by: undefined, override_quote: undefined }
            : r,
        ),
      }));
      logAudit("baseline_confirmed", { rule_id: rule.id, text: rule.text, quote, confirmed_by: "coverage interview" }, "expert");
      setAnswered((a) => [...a, { id: rule.id, text: rule.text, verdict, quote }]);
    } else if (verdict === "different") {
      const created = companyRule ? { ...companyRule, source: "debrief" as const, confirmed: true, reason_quote: quote } : null;
      const overriddenBy = created?.id ?? `coverage-${rule.id}`;
      workMaps.update(jobId, (m) => ({
        ...m,
        rules: m.rules.map((r) => (r.id === rule.id ? { ...r, confirmed: false, confirmed_by: undefined, overridden_by: overriddenBy, override_quote: quote } : r)),
      }));
      if (created) workMaps.addRules(jobId, [created]);
      logAudit("baseline_overridden", { rule_id: rule.id, text: rule.text, overridden_by: overriddenBy, override_quote: quote, via: "coverage interview" }, "expert");
      if (created) logAudit("rule_created", { rule_id: created.id, text: created.text, quote, source: "debrief", via: "coverage interview" }, "expert");
      setAnswered((a) => [...a, { id: rule.id, text: rule.text, verdict, quote, newRule: created?.text }]);
    } else {
      workMaps.removeRule(jobId, rule.id);
      notApplicableStore.add(jobId, { id: rule.id, text: rule.text, quote });
      logAudit("baseline_overridden", { rule_id: rule.id, text: rule.text, overridden_by: "not_applicable", override_quote: quote, via: "coverage interview" }, "expert");
      setAnswered((a) => [...a, { id: rule.id, text: rule.text, verdict, quote }]);
    }
    const saved = workMaps.get(jobId);
    if (saved) {
      void fetch("/api/coverage", {
        method: "POST",
        headers: { "content-type": "application/json", ...auditHeaders() },
        body: JSON.stringify({ job_id: jobId, save_map: saved }),
      }).catch(() => undefined);
    }
  }

  useEffect(() => {
    if (!interviewing || !connected || !current || busy || asked.current?.key === askKey) return;
    const timer = setTimeout(() => {
      asked.current = { key: askKey, from: agent.transcript.length };
      agent.sendContext({
        kind: "ask_now",
        pick: {
          question: `Coverage check. ${question(current, attempt)}`,
          about_event_id: current.id,
          is_guardrail: GUARDRAIL_TYPES.includes(current.type),
          kind: "confirmation",
          reason: `coverage interview: baseline ${current.id}`,
          rule_id: current.id,
        },
      });
    }, ASK_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewing, connected, askKey, busy]);

  // The expert's next final line after the question is their answer.
  useEffect(() => {
    const a = asked.current;
    if (!a || busy || !current || a.key !== askKey) return;
    const line = agent.transcript.slice(a.from).find((l) => l.speaker === "expert" && !l.off_record && l.text.trim());
    if (!line) return;
    asked.current = { key: a.key, from: Number.POSITIVE_INFINITY }; // consumed
    const timer = setTimeout(() => void submit(current, line.text), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.transcript, askKey, busy]);

  function startInterview() {
    setError(null);
    setInterviewing(true);
    asked.current = null;
    void agent.start();
  }

  function stopInterview() {
    setInterviewing(false);
    asked.current = null;
    agent.stop();
  }

  function skip() {
    if (!current) return;
    setSkipped((s) => [...s, current.id]);
    setAttempt(0);
    setNotice(null);
  }

  const problem = error || agent.error;
  const statusText = !interviewing
    ? "Voice off. Answer with the buttons or type."
    : agent.status === "connecting"
      ? "Connecting…"
      : connected
        ? busy ? "Recording your answer…" : agent.isAgentSpeaking ? "Asking…" : "Listening"
        : "Voice disconnected";

  return (
    <main className={`${page} pb-16 pt-8`}>
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-[65ch]">
          <p className={eyebrow}>{jobName}</p>
          <h1 className="mt-1 text-page text-ink">Coverage interview</h1>
          <p className="mt-2 text-reading text-ink-secondary">
            ExpertAI already knows how this job is usually done. Go through each industry-standard rule and say how it works at your
            company. Only your answers become company rules; nothing is filled in for you.
          </p>
        </div>
        <CoverageRing pct={coverage} confirmed={confirmed} open={open.length} />
      </header>

      {problem && <p className={`${banner.danger} mt-6`} role="alert">{problem}</p>}

      {!map ? (
        <div className={`${emptyBox} mt-8`}>
          <p className="text-body text-ink-secondary">Loading the Work Map…</p>
        </div>
      ) : !current ? (
        <section className={`${card} mt-8 p-6`}>
          <p className="text-sub text-ink">{open.length ? "That's every rule for this round." : "Every industry-standard rule is covered."}</p>
          <p className="mt-2 text-body text-ink-secondary">
            {open.length
              ? `${open.length} rule${open.length === 1 ? " was" : "s were"} skipped and stay${open.length === 1 ? "s" : ""} open for next time.`
              : "Each one is confirmed, replaced by your company's rule, or marked as not applying here."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/workmap?job=${jobId}`} className={`${btn.primary} no-underline`}>Open Work Map</Link>
            {skipped.length > 0 && (
              <button type="button" onClick={() => setSkipped([])} className={btn.secondary}>Go through skipped rules</button>
            )}
            {interviewing && <button type="button" onClick={stopInterview} className={btn.secondary}>End interview</button>}
          </div>
        </section>
      ) : (
        <section aria-label="Current question" className={`${card} mt-8 p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-meta text-ink-secondary" aria-live="polite">
              Rule {confirmedCount(answered) + 1} · {pending.length} to go · {statusText}
            </p>
            {interviewing ? (
              <button type="button" onClick={stopInterview} className={`${btn.secondary} ${btn.compact}`}>End interview</button>
            ) : (
              <button type="button" onClick={startInterview} className={`${btn.primary} ${btn.compact}`}>Start coverage interview</button>
            )}
          </div>

          <div className={`${inset} mt-4 p-4`}>
            <p className="flex flex-wrap items-center gap-2 text-note">
              <span className={pill.outline}>Industry standard</span>
              <span className={pill.neutral}>{current.type.replace(/_/g, " ")}</span>
            </p>
            <p className="mt-2 text-body font-medium text-ink">{question(current, attempt)}</p>
            <p className={help}>{current.reason_quote}</p>
          </div>

          {notice && <p className={`${banner.info} mt-4`} role="status">{notice}</p>}

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => void submit(current, "Same here.")} className={btn.secondary}>Same</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => document.getElementById("coverage-answer")?.focus()}
              className={btn.secondary}
            >
              Different
            </button>
            <button type="button" disabled={busy} onClick={() => void submit(current, "That doesn't apply here.")} className={btn.secondary}>
              Doesn&apos;t apply
            </button>
            <button type="button" disabled={busy} onClick={skip} className={btn.tertiary}>Skip for now</button>
          </div>

          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(current, text);
            }}
          >
            <label htmlFor="coverage-answer" className="sr-only">How does it work at your company?</label>
            <div className="flex items-end gap-2">
              <input
                id="coverage-answer"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="How does it work at your company? (type instead of talking)"
                autoComplete="off"
                className={`${field} min-w-0 flex-1`}
              />
              <button type="submit" className={btn.primary} disabled={busy || !text.trim()} aria-busy={busy}>
                {busy ? "Saving…" : "Answer"}
              </button>
            </div>
            <p className={help}>If it differs, say how in your own words. That sentence becomes the company rule.</p>
          </form>
        </section>
      )}

      {answered.length > 0 && (
        <section className="mt-10">
          <h2 className={eyebrow}>Answered in this interview</h2>
          <ul className="mt-3 space-y-3">
            {[...answered].reverse().map((a, i) => (
              <li key={`${a.id}-${i}`} className={`${card} p-4`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={VERDICT_PILL[a.verdict]}>{VERDICT_LABEL[a.verdict]}</span>
                  <span className="text-body text-ink-secondary">{a.text}</span>
                </div>
                <p className="mt-2 text-body text-ink">&ldquo;{a.quote}&rdquo;</p>
                {a.newRule && <p className="mt-1 text-meta text-ink-secondary">Company rule: {a.newRule}</p>}
                {a.verdict === "different" && !a.newRule && (
                  <p className="mt-1 text-meta text-ink-secondary">Recorded as different here. No checkable rule came from that answer yet.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {map && pending.length > 1 && (
        <section className="mt-10">
          <h2 className={eyebrow}>Still to cover</h2>
          <ul className="mt-3 space-y-2">
            {pending.slice(1).map((r) => (
              <li key={r.id} className={`${inset} px-4 py-3 text-body text-ink`}>{r.text}</li>
            ))}
          </ul>
        </section>
      )}

      {notApplicable.length > 0 && (
        <section className="mt-10">
          <h2 className={eyebrow}>Not applicable here</h2>
          <ul className="mt-3 space-y-2">
            {notApplicable.map((r) => (
              <li key={r.id} className={`${inset} px-4 py-3`}>
                <p className="text-body text-ink-secondary line-through decoration-ink-tertiary">{r.text}</p>
                <p className="mt-1 text-meta text-ink">&ldquo;{r.quote}&rdquo;</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-meta text-ink-secondary">
        Coverage = confirmed rules / (confirmed + open industry-standard rules).{" "}
        <Link href={`/workmap?job=${jobId}`} className={link}>See the Work Map</Link>
      </p>
    </main>
  );
}

const confirmedCount = (a: Answered[]) => a.filter((x) => x.verdict !== "skipped").length;

const VERDICT_LABEL: Record<Answered["verdict"], string> = {
  same: "Same here",
  different: "Different here",
  not_applicable: "Doesn't apply",
  skipped: "Skipped",
};
const VERDICT_PILL: Record<Answered["verdict"], string> = {
  same: pill.success,
  different: pill.info,
  not_applicable: pill.neutral,
  skipped: pill.warning,
};

function CoverageRing({ pct, confirmed, open }: { pct: number; confirmed: number; open: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`Coverage ${pct} percent`}>
        <circle cx="44" cy="44" r={r} fill="none" strokeWidth="8" className="stroke-line" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 44 44)"
          className="stroke-action transition-[stroke-dashoffset] duration-300 ease-ui"
        />
        <text x="44" y="49" textAnchor="middle" className="fill-ink text-card tabular-nums">{pct}%</text>
      </svg>
      <div className="text-meta text-ink-secondary">
        <p className="font-medium text-ink">Coverage</p>
        <p className="tabular-nums">{confirmed} confirmed</p>
        <p className="tabular-nums">{open} open</p>
      </div>
    </div>
  );
}

/** The role briefing for this job, fetched once (same as the expert panel). */
function useBriefing(jobId: string): string | null {
  const [briefing, setBriefing] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/briefing", { method: "POST", headers: { "content-type": "application/json", ...auditHeaders() }, body: JSON.stringify({ job_id: jobId }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { briefing?: string } | null) => {
        if (!cancelled && b?.briefing) setBriefing(b.briefing);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [jobId]);
  return briefing;
}

// ---- "Not applicable here": rules the expert said never come up at their company (kept in this browser) ----
const NA_KEY = (jobId: string) => `expertai:coverage-na:${jobId}`;
const naSubs = new Set<() => void>();
const naCache = new Map<string, NotApplicable[]>();
const NONE: NotApplicable[] = [];

const notApplicableStore = {
  get(jobId: string): NotApplicable[] {
    if (!naCache.has(jobId)) {
      let list: NotApplicable[] = NONE;
      try {
        const raw = localStorage.getItem(NA_KEY(jobId));
        if (raw) list = JSON.parse(raw) as NotApplicable[];
      } catch {
        /* storage unavailable */
      }
      naCache.set(jobId, list);
    }
    return naCache.get(jobId) ?? NONE;
  },
  add(jobId: string, item: NotApplicable) {
    const next = [...notApplicableStore.get(jobId).filter((x) => x.id !== item.id), item];
    naCache.set(jobId, next);
    try {
      localStorage.setItem(NA_KEY(jobId), JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
    naSubs.forEach((s) => s());
  },
  subscribe(fn: () => void) {
    naSubs.add(fn);
    return () => {
      naSubs.delete(fn);
    };
  },
};

function useNotApplicable(jobId: string): NotApplicable[] {
  return useSyncExternalStore(notApplicableStore.subscribe, () => notApplicableStore.get(jobId), () => NONE);
}
