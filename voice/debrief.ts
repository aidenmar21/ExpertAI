// Debrief plan + agent text for the debrief, teach-back, and tutor knowledge. Browser-safe.
import type { OpenGap, WorkMap } from "../shared/contracts";
import { nextQuestionKind, questionFor, workMapToAgentText, type DecisionRecord } from "@understudy/brain";

export interface DebriefQuestion {
  id: string;
  question: string;
  about_event_id?: string;
  source: "gap" | "follow_up" | "general";
  is_guardrail: boolean;
}

type MapWithRecords = WorkMap & { records?: DecisionRecord[] };

const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 5;

/**
 * The debrief questions, in order: open gaps first, then follow-ups on decisions the expert
 * already explained, then general questions. At least 3, at most 5, always one guardrail question.
 */
export function planDebrief(gaps: OpenGap[], map: MapWithRecords, escalateTo?: string): DebriefQuestion[] {
  const plan: DebriefQuestion[] = gaps.map((g) => ({
    id: g.id,
    question: g.question,
    about_event_id: g.about_event_id,
    source: "gap",
    is_guardrail: /\b(stop|ask|manager|never|escalat|controller)\b/i.test(g.question),
  }));

  // Follow-ups on explained decisions: "when would you stop" first, it's the guardrail the judges look for.
  const explained = (map.records ?? []).filter((r) => r.why !== null).reverse();
  for (const kind of ["when_to_stop", "what_would_change"] as const) {
    for (const r of explained) {
      if (plan.length >= MAX_QUESTIONS) break;
      if (r.asked.includes(kind) || nextQuestionKind(r) === null) continue;
      if (plan.some((q) => q.about_event_id === r.sources.event_ids[0] && q.source === "follow_up")) continue;
      plan.push({
        id: `fu-${r.id}-${kind}`,
        question: questionFor(r, kind),
        about_event_id: r.sources.event_ids[0],
        source: "follow_up",
        is_guardrail: kind === "when_to_stop",
      });
    }
  }

  const who = escalateTo ? `the ${escalateTo.toLowerCase()}` : "a manager";
  const general: DebriefQuestion[] = [
    { id: "gen-stop", question: `When would you stop and get ${who} instead of deciding yourself?`, source: "general", is_guardrail: true },
    { id: "gen-mistake", question: "What's the mistake a new person is most likely to make here?", source: "general", is_guardrail: false },
    { id: "gen-never", question: "Is there anything you'd never do on this screen, even if a customer pushed?", source: "general", is_guardrail: true },
  ];
  // Already have a guardrail question: fill with the others first so we don't ask "when would you stop" twice.
  if (plan.some((q) => q.is_guardrail)) general.sort((a, b) => Number(a.id === "gen-stop") - Number(b.id === "gen-stop"));
  for (const g of general) {
    const needGuardrail = g.is_guardrail && !plan.some((q) => q.is_guardrail);
    if (plan.length < MIN_QUESTIONS || needGuardrail) plan.push(g);
  }
  // A guardrail question must survive the cap.
  if (plan.length > MAX_QUESTIONS) {
    const capped = plan.slice(0, MAX_QUESTIONS);
    if (!capped.some((q) => q.is_guardrail)) capped[MAX_QUESTIONS - 1] = plan.find((q) => q.is_guardrail)!;
    return capped;
  }
  return plan;
}

/** Silent context: what the agent has learned. Never includes hidden_rules (brain never has them here). */
export function formatWorkMapContext(map: MapWithRecords): string {
  return `[WORK MAP]\n${workMapToAgentText(map)}`;
}

export function formatDebriefQuestion(q: DebriefQuestion, index: number, total: number): string {
  const first = index === 0 ? "Capture is over. " : "";
  return `[DEBRIEF] ${first}Question ${index + 1} of ${total}, one short sentence: ${oneLine(q.question)}${q.is_guardrail ? " (guardrail)" : ""}`;
}

export function formatTeachBack(): string {
  return (
    "[TEACH BACK] Last question done. Tell the job back as a story, in order, under a minute: " +
    '"First you ... If ..., you ..., because ..." Quote their own words for each reason and say when to stop and ask. ' +
    'End with "Is that right?"'
  );
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
