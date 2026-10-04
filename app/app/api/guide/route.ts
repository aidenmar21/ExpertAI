import type { StuckSignals, Value } from "@understudy/shared";
import { nextStepFor } from "@understudy/brain/server";
import { detectStuck } from "@understudy/engine";
import { listJobIds, loadJob } from "@/lib/db/jobs";

interface GuideRequest {
  job_id?: string;
  record?: Record<string, Value>;
  action?: string;
  signals?: Partial<StuckSignals>;
}

/**
 * POST { job_id, record, action?, signals? } -> { hint, step, judgment?, guardrail?, speak }.
 * Proactive guidance for a stuck new hire from the pre-loaded role knowledge: no expert session needed.
 * `speak` is what the tutor should say; `hint` names the stuck signal (from `signals`, when given).
 */
export async function POST(request: Request) {
  let body: GuideRequest;
  try {
    body = (await request.json()) as GuideRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const id = body.job_id ?? "";
  if (!(await listJobIds()).includes(id)) return Response.json({ error: "unknown job" }, { status: 404 });
  const job = (await loadJob(id));
  const record = isRecord(body.record) ? body.record : {};
  const action = typeof body.action === "string" && body.action ? body.action : undefined;

  const hint = body.signals
    ? detectStuck({
        msIdleWithRecordOpen: num(body.signals.msIdleWithRecordOpen),
        backAndForthCount: num(body.signals.backAndForthCount),
        msHoveringAction: body.signals.msHoveringAction,
        hesitationWords: num(body.signals.hesitationWords),
      }).hint
    : "";

  const next = nextStepFor(job, record, action);
  const actionLabel = action ? (job.screen.actions.find((a) => a.key === action)?.label ?? action.replace(/_/g, " ")) : "";
  const speak = buildSpeak({ ...next, recordType: job.screen.record_type, actionLabel });
  return Response.json({ hint, ...next, speak });
}

/**
 * What the tutor says: where they seem to be, the usual next step (the judgment call's answer when one
 * matches, since it is the more specific advice; else the workflow step, plus the guardrail), and an offer.
 */
function buildSpeak(g: { step: string; judgment?: string; guardrail?: string; recordType: string; actionLabel: string }): string {
  const parts: string[] = [];
  const [situation, answer] = g.judgment ? g.judgment.split(". The usual answer: ") : [];
  if (situation) parts.push(`Looks like you're deciding on a "${lower(situation)}" case.`);
  else if (g.actionLabel) parts.push(`Looks like you're deciding whether to ${lower(g.actionLabel)} this ${g.recordType}.`);
  else parts.push(`Looks like you're working out this ${g.recordType}.`);
  if (answer) parts.push(`The usual next step is: ${answer}`);
  else {
    if (g.step) parts.push(`The usual next step is: ${lower(g.step)}`);
    if (g.guardrail) parts.push(`Keep in mind: ${lower(g.guardrail)}`);
  }
  parts.push("Want me to walk you through it?");
  return parts.map((p) => (/[.!?]$/.test(p) ? p : `${p}.`)).join(" ");
}

const lower = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const isRecord = (v: unknown): v is Record<string, Value> =>
  !!v && typeof v === "object" && !Array.isArray(v) &&
  Object.values(v as Record<string, unknown>).every((x) => x === null || typeof x === "string" || typeof x === "number");
