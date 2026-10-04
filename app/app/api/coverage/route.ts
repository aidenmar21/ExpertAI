import type { Rule, WorkMap } from "@understudy/shared";
import { redact } from "@understudy/brain";
import { parsePolicy, piiValues, sessionFromHeaders } from "@understudy/brain/server";
import { logModelCall } from "@/lib/db/audit";
import { listJobIds, loadJob } from "@/lib/db/jobs";
import { saveMap } from "@/lib/db/workMaps";
import { errorResponse } from "@/lib/db/server";

/**
 * Coverage interview: the expert says how one industry-standard (baseline) rule works at their company.
 *
 * POST { job_id, rule, answer } -> { verdict, quote, rule? }
 *   verdict: same | different | not_applicable | unclear (classified by the LLM from the expert's words only).
 *   quote:   the expert's exact words, redacted.
 *   rule:    for "different", a company rule parsed from the expert's words (source "debrief", confirmed).
 * POST { job_id, save_map } -> { ok }: writes the updated Work Map through the repository (data/workmaps file, or
 *   Postgres with a new version when Supabase is on; last write wins, an identical map is a no-op).
 *
 * Nothing is invented: a company rule only exists when the expert's own sentence grounds it.
 */

export type CoverageVerdict = "same" | "different" | "not_applicable" | "unclear";
const VERDICTS: CoverageVerdict[] = ["same", "different", "not_applicable", "unclear"];

const SYSTEM = `You compare an industry-standard rule for a job with what an expert says about their own company.
Classify the expert's answer:
- "same": it works the same way at their company (agreement, "yes", "we do that too", "always").
- "different": their company does it differently (a different limit, method, person, or no restriction).
- "not_applicable": the situation never comes up at their company (e.g. they do not sell that item, no such case).
- "unclear": the answer does not say which (small talk, a question back, "hmm", unrelated, or cut off).
Use only what the expert actually said. Never guess. If in doubt, answer "unclear".`;

const SCHEMA = {
  type: "object",
  properties: { verdict: { type: "string", enum: VERDICTS } },
  required: ["verdict"],
  additionalProperties: false,
};

async function classify(ruleText: string, answer: string): Promise<{ verdict: CoverageVerdict; by: "model" | "fallback" }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: process.env.LLM_MODEL || "claude-opus-5-5",
          max_tokens: 200,
          output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
          system: SYSTEM,
          messages: [{ role: "user", content: JSON.stringify({ industry_standard_rule: ruleText, expert_answer: answer }) }],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
        const text = (data.content ?? []).flatMap((b) => (b.type === "text" && b.text ? [b.text] : [])).join("");
        const verdict = (JSON.parse(text) as { verdict?: string }).verdict as CoverageVerdict;
        if (VERDICTS.includes(verdict)) return { verdict, by: "model" };
      } else {
        console.error(`[api/coverage] classify ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
    } catch (err) {
      console.error("[api/coverage] classify", err);
    }
  }
  return { verdict: fallbackVerdict(answer), by: "fallback" };
}

/** Keyword fallback when the model is unavailable. Conservative: anything ambiguous is "unclear". */
function fallbackVerdict(answer: string): CoverageVerdict {
  const a = answer.toLowerCase();
  if (/\b(doesn'?t|does not|won'?t) apply\b|\bnot applicable\b|\bn\/a\b|\bwe don'?t (sell|have|do|carry|take)\b|\bnever comes up\b/.test(a)) return "not_applicable";
  if (/\bdifferent\b|\binstead\b|\bhere we\b|^\s*no\b|\bnot here\b/.test(a)) return "different";
  if (/^\s*(yes|yeah|yep|same|exactly|correct|right)\b|\bsame here\b|\bwe (always|do that)\b/.test(a)) return "same";
  return "unclear";
}

function isRule(x: unknown): x is Rule {
  const r = x as Rule;
  return !!r && typeof r.id === "string" && typeof r.text === "string" && Array.isArray(r.when) && typeof r.then === "object";
}

function isMap(x: unknown, jobId: string): x is WorkMap {
  const m = x as WorkMap;
  return !!m && m.job_id === jobId && Array.isArray(m.rules) && Array.isArray(m.steps) && Array.isArray(m.open_gaps);
}

export async function POST(request: Request) {
  let body: { job_id?: string; rule?: unknown; answer?: unknown; save_map?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const id = body.job_id ?? "";
  if (!(await listJobIds()).includes(id)) return Response.json({ error: "unknown job" }, { status: 404 });

  if (body.save_map !== undefined) {
    if (!isMap(body.save_map, id)) return Response.json({ error: "expected { job_id, save_map: WorkMap }" }, { status: 400 });
    try {
      await saveMap(id, body.save_map, "latest");
    } catch (err) {
      return errorResponse(err);
    }
    return Response.json({ ok: true });
  }

  if (!isRule(body.rule) || typeof body.answer !== "string" || !body.answer.trim()) {
    return Response.json({ error: "expected { job_id, rule, answer }" }, { status: 400 });
  }
  const job = await loadJob(id);
  const baseline = body.rule;
  const quote = redact(body.answer.trim().replace(/\s+/g, " "), piiValues(job));
  const session = sessionFromHeaders(request.headers);
  const started = Date.now();

  const { verdict, by } = await classify(baseline.text, quote);
  let rule: Rule | undefined;
  if (verdict === "different") {
    try {
      const parsed = await parsePolicy(quote, job);
      const first = parsed[0];
      if (first) {
        rule = {
          ...first,
          id: `cov-${baseline.id}-${Date.now().toString(36)}`,
          source: "debrief",
          confirmed: true,
          reason_quote: quote,
        };
      }
    } catch (err) {
      console.error("[api/coverage] parsePolicy", err);
    }
  }
  try {
    await logModelCall(session, { model: process.env.LLM_MODEL, prompt_version: "coverage-v1", latency_ms: Date.now() - started, redacted: true, purpose: "coverage" });
  } catch (err) {
    console.error("[api/coverage] audit", err);
  }
  return Response.json({ verdict, quote, classified_by: by, ...(rule ? { rule } : {}) });
}
