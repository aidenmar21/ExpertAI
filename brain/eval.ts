// Scoring against the answer key (hidden_rules + new-hire expectations). Pure code, but it reads the answer key,
// so call it from the server (scoreSession in server.ts). Never ship hidden_rules or expectations to the browser or agent.
import type { JobProfile, QuestionPick, Scoreboard, ScreenEvent, Value, WorkMap } from "@understudy/shared";
import { canonicalEvents, checkAction } from "./index";

type Rec = Record<string, Value>;
interface Step { action: string; set?: Rec }
interface Probe extends Step { from: string }
interface HiddenRule { id: string; rule: string; type: string; probes?: Probe[] }
interface Case { case: string; expected?: { wrong: Step | null; right: Step } }

export interface GroundTruthChange { t: number; field: string; from: Value; to: Value; record?: string }

// The on-screen record for a case id (X2, N1, 4490 ...), from records.expert / records.new_hire by position.
export function caseRecord(job: JobProfile, id: string): Rec | null {
  const recs = (job.records ?? {}) as { expert?: Rec[]; new_hire?: Rec[] };
  for (const [cases, list] of [[job.expert_session_cases, recs.expert], [job.new_hire_test_cases, recs.new_hire]] as const) {
    const i = ((cases as Case[] | undefined) ?? []).findIndex((c) => c.case === id);
    if (i >= 0 && list?.[i]) return { ...list[i] };
  }
  return null;
}

const blocked = (job: JobProfile, map: WorkMap, record: Rec, s: Step) =>
  !checkAction({ action: s.action, record: { ...record, ...(s.set ?? {}) } }, map, { job }).ok;

export interface TutorCaseResult {
  case: string;
  trap: boolean;                // the case has a wrong move to catch
  caught: boolean | null;       // wrong move blocked (null if no trap)
  false_alarm: boolean;         // the right move was blocked
  rule_id?: string;             // rule that caught the wrong move
}

// Runs every new-hire case through checkAction with the (confirmed) Work Map.
export function runTutorCases(job: JobProfile, map: WorkMap): TutorCaseResult[] {
  return ((job.new_hire_test_cases as Case[] | undefined) ?? []).filter((c) => c.expected).map((c) => {
    const rec = caseRecord(job, c.case)!;
    const exp = c.expected!;
    const wrong = exp.wrong ? checkAction({ action: exp.wrong.action, record: { ...rec, ...(exp.wrong.set ?? {}) } }, map, { job }) : null;
    return {
      case: c.case,
      trap: !!exp.wrong,
      caught: wrong ? !wrong.ok : null,
      false_alarm: blocked(job, map, rec, exp.right),
      rule_id: wrong && !wrong.ok ? wrong.rule?.id : undefined,
    };
  });
}

// A hidden rule counts as learned when the confirmed Work Map blocks every one of its probes.
export function rulesLearned(job: JobProfile, map: WorkMap): { id: string; learned: boolean }[] {
  return ((job.hidden_rules as HiddenRule[] | undefined) ?? []).map((h) => {
    const probes = (h.probes ?? []).map((p) => ({ rec: caseRecord(job, p.from), p })).filter((x) => x.rec);
    return { id: h.id, learned: probes.length > 0 && probes.every(({ rec, p }) => blocked(job, map, rec!, p)) };
  });
}

export function visionAccuracy(job: JobProfile, groundTruth: GroundTruthChange[], events: ScreenEvent[], windowMs = 10_000): number {
  if (!groundTruth.length) return 0;
  const evs = canonicalEvents(job, events).filter((e) => e.field);
  const eq = (a: Value | undefined, b: Value | undefined) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
  const hit = groundTruth.filter((g) => evs.some((e) => e.field === g.field && eq(e.to, g.to) && Math.abs(e.t - g.t) < windowMs)).length;
  return hit / groundTruth.length;
}

export interface ScoreInput {
  job: JobProfile;
  map: WorkMap;                 // the confirmed Work Map (only confirmed rules enforce)
  groundTruth?: GroundTruthChange[];
  events?: ScreenEvent[];
  questions?: QuestionPick[] | { live: number; guardrail: number };   // picks sent as ask_now, or counts
}

export function score(s: ScoreInput): Scoreboard {
  const learned = rulesLearned(s.job, s.map);
  const tutor = runTutorCases(s.job, s.map);
  const q = Array.isArray(s.questions)
    ? { live: s.questions.length, guardrail: s.questions.filter((x) => x.is_guardrail).length }
    : s.questions ?? { live: 0, guardrail: 0 };
  return {
    rules_learned: learned.filter((x) => x.learned).length,
    rules_total: learned.length,
    vision_accuracy: visionAccuracy(s.job, s.groundTruth ?? [], s.events ?? []),
    tutor_catches: tutor.filter((x) => x.caught).length,
    tutor_traps: tutor.filter((x) => x.trap).length,
    false_alarms: tutor.filter((x) => x.false_alarm).length,
    live_questions: q.live,
    guardrail_questions: q.guardrail,
  };
}
